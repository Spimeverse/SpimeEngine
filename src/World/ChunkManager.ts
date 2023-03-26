import { Vector3,Scene } from "@babylonjs/core";
import { AxisAlignedBoxBound, Bounds } from "./Bounds";
import { SignedDistanceField, Chunk, DistanceCache } from "..";
import { SparseOctTree } from "."
import { SdfUnion } from "..";
import { LinkedList, LinkedListNode } from "../Collection/LinkedList";
import { totalTime } from "..";

const chunkBounds = new AxisAlignedBoxBound(0, 0, 0, 0, 0, 0);
const worldSize = 16384;
const halfWorld = worldSize / 2;
const nearbyChunks = new Set<Chunk>();
let maxUpdatesPerFrame = 10000;

class ChunkManager {
    private _viewOrigin: Vector3 = new Vector3();
    private _newOrigin: Vector3 = new Vector3();
    private _worldBounds: AxisAlignedBoxBound;
    private _chunkTree: SparseOctTree<Chunk>;
    private _fieldTree: SparseOctTree<SignedDistanceField>;
    private _chunkFields = new Set<SignedDistanceField>();
    private _unionFields = new SdfUnion(this._chunkFields);
    private _dirtyChunks = new Set<Chunk>();
    private _rescaleChunks = new Set<Chunk>();
    private _updateChunkQueue = new LinkedList<Chunk>();
    private _changedFields = new Set<SignedDistanceField>();
    private _nextUpdateChunk: LinkedListNode<Chunk> | null = null;
    private _viewOriginUpdates: Vector3[] = [];
    private _updatesPending = false;

    constructor() {
        this._worldBounds = new AxisAlignedBoxBound(-halfWorld,-halfWorld,-halfWorld,halfWorld,halfWorld,halfWorld)
        this._chunkTree = new SparseOctTree<Chunk>(this._worldBounds, 32, 4);
        this._fieldTree = new SparseOctTree<SignedDistanceField>(this._worldBounds, 32, 4);
        let scale = worldSize;
        while (scale >= 1) {
            this._viewOriginUpdates.push(new Vector3());
            scale /= 2;
        }
     }
    

    setViewOrigin(origin: Vector3) {
        this._newOrigin.copyFrom(origin);
        if (this._chunkTree.rootNode.totalItems === 0) {
            this._viewOrigin.copyFrom(origin);
            for (let i = 0; i < this._viewOriginUpdates.length; i++) {
                this._viewOriginUpdates[i].copyFrom(origin);
            }
        }
    }

    private static _viewDelta = new Vector3();
    private static _viewDeltaBounds = new AxisAlignedBoxBound(0, 0, 0, 0, 0, 0);

    private _checkIfViewOriginChangesChunkScales() {

        if (this._newOrigin.equalsWithEpsilon(this._viewOrigin, 0.0001))
            return;
 
        const viewDelta = ChunkManager._viewDelta;
        let scale = worldSize;
        let i = this._viewOriginUpdates.length - 1;
        while (scale >= 1) {
            viewDelta.copyFrom(this._newOrigin);
            viewDelta.subtractInPlace(this._viewOriginUpdates[i]);
            if (viewDelta.length() > scale / 2) {
                this._viewOriginUpdates[i].copyFrom(this._newOrigin);
                break;
            }
            scale /= 2;
            i--;
        }
        // reset all smaller view deltas
        while (i >= 0) {
            this._viewOriginUpdates[i].copyFrom(this._newOrigin);
            i--;
        }

        if (scale > 1) {
            this._rescaleChunks.clear();
            ChunkManager._viewDeltaBounds.set(
                this._viewOrigin.x - scale, this._viewOrigin.y - scale, this._viewOrigin.z - scale,
                this._viewOrigin.x + scale, this._viewOrigin.y + scale, this._viewOrigin.z + scale);
            this._chunkTree.getItemsInBox(ChunkManager._viewDeltaBounds, this._rescaleChunks);
            // console.log("old bounds", ChunkManager._viewDeltaBounds.toString(),
            //     "view origin", this._viewOrigin.toString(),
            //     "rescale chunks", this._rescaleChunks.size);

            ChunkManager._viewDeltaBounds.set(
                this._newOrigin.x - scale, this._newOrigin.y - scale, this._newOrigin.z - scale,
                this._newOrigin.x + scale, this._newOrigin.y + scale, this._newOrigin.z + scale);
            this._chunkTree.getItemsInBox(ChunkManager._viewDeltaBounds, this._rescaleChunks);
            // console.log("new bounds", ChunkManager._viewDeltaBounds.toString(),
            //     "new origin", this._newOrigin.toString(),
            //     "rescale chunks", this._rescaleChunks.size);

            this._viewOrigin.copyFrom(this._newOrigin);

            // examine chunks that have changed scale
            for (const chunk of this._rescaleChunks) {
                const chunkDist = chunk.currentBounds.distanceTo(this._viewOrigin);
                const targetSize = Math.max(this._targetChunkSizeForDistance(chunkDist),3);
                // round target size down to nearest power of 2
                const targetScale = Math.pow(2, Math.floor(Math.log2(targetSize)));

                //console.log("rescale, ",chunk.currentBounds.extent != targetScale,"chunk, ", chunk.toString(), " extent, ", chunk.currentBounds.extent, " target scale, ", targetScale);
                if (chunk.currentBounds.extent != targetScale) {
                    // console.log("rescale chunk", chunk.toString(), chunk.currentBounds.extent, targetScale);
                    chunk.markForRemoval();
                    this._dirtyChunks.add(chunk);
                    this._createChunksForBounds(chunk.currentBounds, -halfWorld, -halfWorld, -halfWorld, halfWorld, halfWorld, halfWorld);
                }
            }
        }
    }

    getChunks(chunks: Set<Chunk>) {
        this._chunkTree.getItemsInBox(this._worldBounds, chunks);
    }

    addField(field: SignedDistanceField) {
        // TODO add and update field could be one function?
        // do we need to do anything with the field tree at this point?
        this._createChunksForBounds(field.currentBounds, -halfWorld, -halfWorld, -halfWorld, halfWorld, halfWorld, halfWorld);
        this._fieldTree.insert(field);
        this._changedFields.add(field);
    }

    updateField(field: SignedDistanceField) {
        this._changedFields.add(field);
    }

    static debugUpdates = 2;

    updateChangedMeshes(scene: Scene, showChunkBounds: boolean) {
        if (!this._updatesPending) {
            this._checkIfViewOriginChangesChunkScales();

            this._processFieldChanges();

            this._queueDirtyChunks();

            if (this._updateChunkQueue.count != 0) {
                this._updatesPending = true;
            }
        } 

        if (this._updateChunkQueue.count > 0) {
            const updateComplete = this._updateDirtyChunkMeshes();
            if (updateComplete) {
                console.log("update complete",totalTime / 1000, "seconds");
                this._showUpdatedMeshes(scene, showChunkBounds);

                maxUpdatesPerFrame = 1;
                this._updatesPending = false;
            }
        }
    }


    private _showUpdatedMeshes(scene: Scene, showChunkBounds: boolean) {
        let chunkNode = this._updateChunkQueue.first;
        while (chunkNode != null) {
            const chunk = chunkNode.value;
            chunk.swapMeshes(scene,showChunkBounds);
            if (chunk.isMarkedForRemoval()) {
                this._chunkTree.remove(chunk);
            }
            chunkNode = chunkNode.next;
        }
        this._updateChunkQueue.clear();
        this._nextUpdateChunk = null;
    }

    private _updateDirtyChunkMeshes(): boolean {
        const chunkFields = this._chunkFields;

        let updates = maxUpdatesPerFrame;
        while (updates > 0 && this._nextUpdateChunk != null) {
            const chunk = this._nextUpdateChunk.value;

            let emptyChunk = true;

            if (!chunk.isMarkedForRemoval()) {
                this._checkBordersWithNeighbours(chunk);
                chunkFields.clear();
                this._fieldTree.getItemsInBox(chunk.currentBounds, chunkFields);
                if (chunkFields.size != 0) {
                    emptyChunk = !chunk.updateMesh(this._unionFields);
                    updates--;
                }
            }

            if (emptyChunk) {
                chunk.markForRemoval();
            }
            this._nextUpdateChunk = this._nextUpdateChunk.next;
        }

        if (this._nextUpdateChunk == null) {
            return true;
        }
        return false;
    }

    private _checkBordersWithNeighbours(chunk: Chunk) {
        chunkBounds.copy(chunk.currentBounds);
        chunkBounds.expandByScalar(0.1);
        nearbyChunks.clear();
        this._chunkTree.getItemsInBox(chunkBounds, nearbyChunks);
        for (const nearChunk of nearbyChunks) {
            if (!nearChunk.isMarkedForRemoval()) {
                chunk.updateSharedBorders(nearChunk);
            }
        }
    }

    private _processFieldChanges() {
        for (const field of this._changedFields) {
            field.commitUpdate();
        }
        for (const field of this._changedFields) {
            // mark any existing chunks within the fields current bounds as dirty
            this._chunkTree.getItemsInSphere(field.currentBounds, this._dirtyChunks);
            // ensure all chunks within the fields current bounds are created and updated
            this._createChunksForBounds(field.currentBounds, -halfWorld, -halfWorld, -halfWorld, halfWorld, halfWorld, halfWorld);

            // move the field to it's new position and new bounds
            this._fieldTree.update(field, field.newBounds);

            // ensure all chunks within the fields new bounds are created and updated
            this._createChunksForBounds(field.currentBounds, -halfWorld, -halfWorld, -halfWorld, halfWorld, halfWorld, halfWorld);
            // ensure any existing chunks within the fields new bounds are marked as dirty
            this._chunkTree.getItemsInSphere(field.currentBounds, this._dirtyChunks);
        }
        this._changedFields.clear();
    }

    private _queueDirtyChunks() {
        for (const chunk of this._dirtyChunks) {
            chunk.resetBorders();
            this._updateChunkQueue.append(chunk);
        }
        this._nextUpdateChunk = this._updateChunkQueue.first;
        this._dirtyChunks.clear();
    }

    private _createChunksForBounds(bounds: Bounds, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
        const voxels = 16;  //Math.max(8,1 << 31 - Math.clz32(32 - (chunkDist / 2)));

        // fast rejection, compare chunk bounds to sdf bounds
        chunkBounds.set(minX, minY, minZ, maxX, maxY, maxZ);
        if (!chunkBounds.overlaps(bounds)) {
            // sdf does not overlap chunk bounds so skip it
            return;
        }

        const chunkExtent = chunkBounds.extent;
        // note chunkDist will be negative if origin is inside the chunk
        const chunkDist = chunkBounds.distanceTo(this._viewOrigin);

        const targetSize = this._targetChunkSizeForDistance(chunkDist);
        
        const viewPointInChunk = chunkDist < 0;
        // use larger chunks further away
        if (viewPointInChunk || chunkExtent > targetSize) {
            // subdivide chunk bounds until it is smaller than the target scale
            const halfExtent = (maxX - minX) / 2;
            const middleX = minX + halfExtent;
            const middleY = minY + halfExtent;
            const middleZ = minZ + halfExtent;
            this._createChunksForBounds(bounds, minX, minY, minZ, middleX, middleY, middleZ);
            this._createChunksForBounds(bounds, middleX, minY, minZ, maxX, middleY, middleZ);
            this._createChunksForBounds(bounds, minX, middleY, minZ, middleX, maxY, middleZ);
            this._createChunksForBounds(bounds, middleX, middleY, minZ, maxX, maxY, middleZ);
            this._createChunksForBounds(bounds, minX, minY, middleZ, middleX, middleY, maxZ);
            this._createChunksForBounds(bounds, middleX, minY, middleZ, maxX, middleY, maxZ);
            this._createChunksForBounds(bounds, minX, middleY, middleZ, middleX, maxY, maxZ);
            this._createChunksForBounds(bounds, middleX, middleY, middleZ, maxX, maxY, maxZ);
        }
        else {
            // chunk bounds is smaller than the target scale, so add the sdf to this chunk
            const newChunk = new Chunk();
            newChunk.setPosition({ x: chunkBounds.minX, y: chunkBounds.minY, z: chunkBounds.minZ });
            
            const extent = chunkBounds.extent;
            // use fewer voxels per chunk further away
            newChunk.setSize({ x: extent, y: extent, z: extent }, extent / voxels);

            const sampleCache = new DistanceCache(newChunk.getVoxelSize());
            newChunk.setDistanceCache(sampleCache);

            newChunk.updateCurrentBounds();
         
            nearbyChunks.clear();

            let log = false;
    if (newChunk.toString() == "Origin: -8,0,8 Size: 8,8,8 VoxelSize: 0.5")
                log = true;
            if (log) {
                console.log("---- ");
                console.log("newChunk: " + newChunk.toString());
            }

            this._chunkTree.getItemsInBox(chunkBounds, nearbyChunks);
            for (const nearChunk of nearbyChunks) {
                if (!nearChunk.isMarkedForRemoval()) {
                    if (nearChunk.currentBounds.extent == newChunk.currentBounds.extent &&
                        nearChunk.isAtSamePositionAs(newChunk) &&
                        !nearChunk.isMarkedForRemoval()) {
                        // new chunk is same as existing chunk, so skip it
                        if (log) {
                            console.log("already exists: " + newChunk.toString());
                        }
                        return;
                    }
                    else {
                        if (log) {
                            console.log("overlaps: " + newChunk.toString());
                        }

                        let markForRemoval = false;
                        const nearChunkSampleCache = nearChunk.getDistanceCache();
                        if (nearChunkSampleCache) {
                            if (nearChunk.currentBounds.contains(newChunk.currentBounds)) {
                                if (log) {
                                    console.log("parent: " + nearChunk.toString());
                                }
                                sampleCache.addParent(nearChunkSampleCache);
                                if (!nearChunk.isMarkedForRemoval())
                                    markForRemoval = true;
                            }
                            if (newChunk.currentBounds.contains(nearChunk.currentBounds)) {
                                if (log) {
                                    console.log("child: " + nearChunk.toString());
                                }
                                sampleCache.addChild(nearChunkSampleCache);
                                if (!nearChunk.isMarkedForRemoval())
                                    markForRemoval = true;                            }
                        }

                        // mark existing chunk for removal
                        if (markForRemoval) {
                            nearChunk.markForRemoval();
                            this._dirtyChunks.add(nearChunk);
                        }
                    }
                }
                else {
                    if (log) {
                        console.log("already marked for removal: " + newChunk.toString());
                    }
                }
            }

            this._chunkTree.insert(newChunk);
            this._dirtyChunks.add(newChunk);
        }
    }


    private _targetChunkSizeForDistance(chunkDist: number) {
        const scalingFactor = 0.50741;
        const targetSize = Math.max(chunkDist * scalingFactor, 5);
        return targetSize;
    }
}

export { ChunkManager };