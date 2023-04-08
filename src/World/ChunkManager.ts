import { Vector3,Scene } from "@babylonjs/core";
import { AxisAlignedBoxBound, Bounds } from "./Bounds";
import { SignedDistanceField, Chunk, BORDERS } from "..";
import { SparseOctTree } from "."
import { SdfUnion } from "..";
import { LinkedList, LinkedListNode } from "../Collection/LinkedList";
import { systemSettings } from "../SystemSettings";

const chunkBounds = new AxisAlignedBoxBound(0, 0, 0, 0, 0, 0);
const worldSize = 16384;
const halfWorld = worldSize / 2;
const nearbyChunks = new Set<Chunk>();
let maxUpdatesPerFrame = 10000;
const connectedBounds = new AxisAlignedBoxBound();

let logTime = 0;
let lastLogTime = 0;

function LogChunkQueueLength(length: number) {
    if (systemSettings.showChunkQueueLength && logTime > lastLogTime + 1000) {
        console.log((logTime / 1000).toLocaleString(), "chunk queue length", length);
        lastLogTime = logTime;
    }
}

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
        // view origin updates are used to track when chunks need to be rescaled
        // we need to track the view origin at different scales
        // so we can detect when the view origin has moved more than half a chunk
        // at that scale
        while (scale >= 1) {
            this._viewOriginUpdates.push(new Vector3());
            scale /= 2;
        }
     }
    

    setViewOrigin(origin: Vector3) {
        this._newOrigin.copyFrom(origin);
        // if there are no chunks, we need to set the view origin
        // to it's initial value
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
            // check if the view origin has moved more than half a chunk at this scale
            viewDelta.copyFrom(this._newOrigin);
            viewDelta.subtractInPlace(this._viewOriginUpdates[i]);
            if (viewDelta.length() > scale / 2) {
                this._viewOriginUpdates[i].copyFrom(this._newOrigin);
                break;
            }
            scale /= 2;
            i--;
        }
        // reset the view origin updates for scales smaller than the current scale
        while (i >= 0) {
            this._viewOriginUpdates[i].copyFrom(this._newOrigin);
            i--;
        }

        if (scale > 1) {
            this._rescaleChunks.clear();
            // get all chunks that are in range of the old and new view origins at the current scale
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
                    systemSettings.debugOnChunk(chunk);
                    const chunkNeighbours = this._checkBordersWithNeighbours(chunk);
                    chunk.markForRemoval();
                    this._dirtyChunks.add(chunk);
                    connectedBounds.copy(chunk.currentBounds);
                    // there's an edge case where neighboring chunks might need to be created when a chunk is rescaled
                    // so we expand the bounds by half a chunk if it's not already fully surrounded by chunks
                    if (systemSettings.isTargetChunk(chunk)) {
                        systemSettings.logDetails = true;
                        console.log(`origin update bounds ${connectedBounds.toDetailedString()}`);
                    }
                    if (chunkNeighbours != BORDERS.fullySurrounded) {
                        const offset = chunk.currentBounds.extent;
                        if (!(chunkNeighbours & BORDERS.xMax)) {
                            connectedBounds.minX -= offset;
                            if (systemSettings.logDetails) {
                                console.log(`- X ${connectedBounds.toDetailedString()}`);
                            }
                        }
                        if (!(chunkNeighbours & BORDERS.xMin)) {
                            connectedBounds.maxX += offset;
                            if (systemSettings.logDetails) {
                                console.log(`+ X ${connectedBounds.toDetailedString()}`);
                            }
                        }
                        if (!(chunkNeighbours & BORDERS.yMax)) {
                            connectedBounds.minY -= offset;
                            if (systemSettings.logDetails) {
                                console.log(`- Y ${connectedBounds.toDetailedString()}`);
                            }
                        }
                        if (!(chunkNeighbours & BORDERS.yMin)) {
                            connectedBounds.maxY += offset;
                            if (systemSettings.logDetails) {
                                console.log(`+ Y ${connectedBounds.toDetailedString()}`);
                            }
                        }
                        if (!(chunkNeighbours & BORDERS.zMax)) {
                            connectedBounds.minZ -= offset;
                            if (systemSettings.logDetails) {
                                console.log(`- Z ${connectedBounds.toDetailedString()}`);
                            }
                        }
                        if (!(chunkNeighbours & BORDERS.zMin)) {
                            connectedBounds.maxZ += offset;
                            if (systemSettings.logDetails) {
                                console.log(`+ Z ${connectedBounds.toDetailedString()}`);
                            }
                        }
                    }

                    this._createChunksForBounds(connectedBounds,
                        -halfWorld, -halfWorld, -halfWorld, halfWorld, halfWorld, halfWorld);
                    systemSettings.logDetails = false;
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

    updateChangedMeshes(scene: Scene, deltaTime: number) {
        if (deltaTime)
            logTime += deltaTime;
        
        if (!this._updatesPending) {
            this._checkIfViewOriginChangesChunkScales();

            this._processFieldChanges();

            this._queueDirtyChunks();

            if (this._updateChunkQueue.count != 0) {
                this._updatesPending = true;
                LogChunkQueueLength(this._updateChunkQueue.count);
            }
        } 

        if (this._updateChunkQueue.count > 0) {
            const updateComplete = this._updateDirtyChunkMeshes();
            if (updateComplete) {
                this._showUpdatedMeshes(scene);

                maxUpdatesPerFrame = 1;
                this._updatesPending = false;
            }
        }
        LogChunkQueueLength(this._updateChunkQueue.count);

    }


    private _showUpdatedMeshes(scene: Scene) {
        let chunkNode = this._updateChunkQueue.first;
        while (chunkNode != null) {
            const chunk = chunkNode.value;
            chunk.swapMeshes(scene);
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
                // check if we need to overlap with neighbours if they are at a different scale
                this._checkBordersWithNeighbours(chunk);
                // this is for updating the mesh when a field changes
                chunkFields.clear();
                this._fieldTree.getItemsInBox(chunk.currentBounds, chunkFields);
                if (chunkFields.size != 0) {
                    emptyChunk = !chunk.updateMesh(this._unionFields);
                    updates--;
                }
            }

            if (emptyChunk) {
                systemSettings.debugCounters.emptyChunks++;
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
        chunk.resetBorders();
        chunkBounds.copy(chunk.currentBounds);
        chunkBounds.expandByScalar(0.1);
        nearbyChunks.clear();
        this._chunkTree.getItemsInBox(chunkBounds, nearbyChunks);
        let neighbours = 0;
        for (const nearChunk of nearbyChunks) {
            if (!nearChunk.isMarkedForRemoval()) {
                neighbours |= chunk.updateSharedBorders(nearChunk);
            }
        }
        return neighbours;
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
        systemSettings.debugCounters.dirtyChunks += this._dirtyChunks.size;
        for (const chunk of this._dirtyChunks) {
            chunk.resetBorders();
            this._updateChunkQueue.append(chunk);
        }
        this._nextUpdateChunk = this._updateChunkQueue.first;
        this._dirtyChunks.clear();
    }


    private _createChunksForBounds(bounds: Bounds, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
        const voxels = 16;  //Math.max(8,1 << 31 - Math.clz32(32 - (chunkDist / 2)));
        
        // if (systemSettings.logDetails) {
        //     if (minX <= -8 && maxX >= -8 &&
        //         minY <= 8 && maxY >= 8 &&
        //         minZ <= -32 && maxZ >= -32)
        //         debugger;
        // }
        // fast rejection, compare chunk bounds to bounds
        chunkBounds.set(minX, minY, minZ, maxX, maxY, maxZ);
        if (!chunkBounds.overlaps(bounds)) {
            // sdf does not overlap chunk bounds so skip it
            return;
        }

        const chunkExtent = chunkBounds.extent;

        // note chunkDist will be negative if origin is inside the chunk
        const chunkDist = chunkBounds.distanceTo(this._viewOrigin);

        const targetSize = this._targetChunkSizeForDistance(chunkDist);
        
        const halfExtent = (maxX - minX) / 2;
        const viewPointInChunk = chunkDist < 0;
        // use larger chunks further away
        if ((viewPointInChunk && halfExtent > 1) || chunkExtent > targetSize) {
            // subdivide chunk bounds until it is smaller than the target scale
            const middleX = minX + halfExtent;
            const middleY = minY + halfExtent;
            const middleZ = minZ + halfExtent;
            this._createChunksForBounds(bounds,
                minX,       minY,      minZ,
                middleX,    middleY,   middleZ);
            this._createChunksForBounds(bounds,
                middleX,    minY,       minZ,
                maxX,       middleY,    middleZ);
            this._createChunksForBounds(bounds,
                minX,       middleY,    minZ,
                middleX,    maxY,       middleZ);
            this._createChunksForBounds(bounds,
                middleX,    middleY,    minZ,
                maxX,       maxY,       middleZ);
            this._createChunksForBounds(bounds,
                minX,       minY,       middleZ,
                middleX,    middleY,    maxZ);
            this._createChunksForBounds(bounds,
                middleX,    minY,       middleZ,
                maxX,       middleY,    maxZ);
            this._createChunksForBounds(bounds,
                minX,       middleY,    middleZ,
                middleX,    maxY,       maxZ);
            this._createChunksForBounds(bounds,
                middleX,    middleY,    middleZ,
                maxX,       maxY,       maxZ);
        }
        else {
            // chunk bounds is smaller than the target scale, so create this chunk
            systemSettings.debugCounters.chunksCreated++;
            
            const extent = chunkBounds.extent;
            // use fewer voxels per chunk further away
            const newChunk = new Chunk();
            newChunk.setPosition({ x: chunkBounds.minX, y: chunkBounds.minY, z: chunkBounds.minZ });
            newChunk.setSize({ x: extent, y: extent, z: extent }, extent / voxels);

            newChunk.updateCurrentBounds();
         
            systemSettings.debugOnChunk(newChunk);

            nearbyChunks.clear();

            const log = systemSettings.logDetails;
            if (log) {
                console.log("---- ");
                console.log("newChunk: " + newChunk.toString());
            }

            this._chunkTree.getItemsInBox(chunkBounds, nearbyChunks);
            for (const nearChunk of nearbyChunks) {
                if (nearChunk.currentBounds.extent == newChunk.currentBounds.extent &&
                    nearChunk.isAtSamePositionAs(newChunk) &&
                    !nearChunk.isMarkedForRemoval()) {
                        systemSettings.debugCounters.chunksSkipped++;
                    //---- Debug code to log when a chunk is skipped
                    // new chunk is same as existing chunk, so skip it
                    if (log) {
                        console.log("already exists: " + newChunk.toString());
                    }
                    //---- End debug code
                    return;
                }
                else {
                    //---- Debug code to log when a chunk overlaps
                    if (log) {
                        console.log("overlaps: " + newChunk.toString());
                    }
                    //---- End debug code

                    let markForRemoval = false;
                    if (nearChunk.currentBounds.contains(newChunk.currentBounds)) {
                        //---- Debug code to log when a chunk is a parent
                        if (log) {
                            console.log("parent: " + nearChunk.toString());
                        }
                        //---- End debug code
                        if (!nearChunk.isMarkedForRemoval())
                            markForRemoval = true;
                    }
                    if (newChunk.currentBounds.contains(nearChunk.currentBounds)) {
                        //---- Debug code to log when a chunk is a child
                        if (log) {
                            console.log("child: " + nearChunk.toString());
                        }
                        //---- End debug code
                        if (!nearChunk.isMarkedForRemoval())
                            markForRemoval = true;
                    }

                    // mark existing chunk for removal
                    if (markForRemoval) {
                        nearChunk.markForRemoval();
                        this._dirtyChunks.add(nearChunk);
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