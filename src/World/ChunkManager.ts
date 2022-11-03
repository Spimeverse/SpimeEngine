import { Vector3,Camera, Matrix, Scene } from "@babylonjs/core";
import { AxisAlignedBoxBound } from "./Bounds";
import { SignedDistanceField, Chunk } from "..";
import { SparseOctTree } from "."
import { SdfSphere,SdfUnion } from "..";

const chunkBounds = new AxisAlignedBoxBound(0, 0, 0, 0, 0, 0);
const worldSize = 16384;
const halfWorld = worldSize / 2;
const nearbyChunks = new Set<Chunk>();
const chunkOrigin = new Vector3();
const chunkCenter = new Vector3();
const sqrt3 = Math.sqrt(3);

class ChunkManager {
    private _origin: Vector3 = new Vector3();
    private _distToSdf: Vector3 = new Vector3();
    private _worldBounds: AxisAlignedBoxBound;
    private _chunkTree: SparseOctTree<Chunk>;
    private _fieldTree: SparseOctTree<SignedDistanceField>;
    private _chunkFields = new Set<SignedDistanceField>();
    private _unionFields = new SdfUnion(this._chunkFields);
    private _dirtyChunks = new Set<Chunk>();

    constructor() {
        this._worldBounds = new AxisAlignedBoxBound(-halfWorld,-halfWorld,-halfWorld,halfWorld,halfWorld,halfWorld)
        this._chunkTree = new SparseOctTree<Chunk>(this._worldBounds, 32, 4);
        this._fieldTree = new SparseOctTree<SignedDistanceField>(this._worldBounds, 32, 4);
     }
    
    setViewOrigin(origin: Vector3) {
        this._origin.copyFrom(origin);
    }

    getChunks(chunks: Set<Chunk>) {
        this._chunkTree.getItemsInBox(this._worldBounds, chunks);
    }

    addField(field: SignedDistanceField) {
        // subdivide chunk bounds until it is smaller than the distance to the sdf
        this._createChunksForField(field, -halfWorld, -halfWorld, -halfWorld, halfWorld, halfWorld, halfWorld);
        this._fieldTree.insert(field);
    }

    updateField(field: SignedDistanceField) {
        this._chunkTree.getItemsInSphere(field.currentBounds, this._dirtyChunks);
        // ensure all chunks within the fields current bounds are created and updated
        this._createChunksForField(field, -halfWorld, -halfWorld, -halfWorld, halfWorld, halfWorld, halfWorld);
        this._fieldTree.update(field, field.newBounds);
        // ensure all chunks within the fields new bounds are created and updated
        this._createChunksForField(field, -halfWorld, -halfWorld, -halfWorld, halfWorld, halfWorld, halfWorld);
        this._chunkTree.getItemsInSphere(field.currentBounds, this._dirtyChunks);
        console.log("dirty chunks after: ", this._dirtyChunks.size);
    }

    updateDirtyChunks(scene: Scene, position: Vector3) {
        const chunkFields = this._chunkFields;
        for (const chunk of this._dirtyChunks)
        {
            chunkFields.clear();
            this._fieldTree.getItemsInBox(chunk.currentBounds, chunkFields);
            let emptyChunk = true;
            if (chunkFields.size != 0) {
                emptyChunk = !chunk.updateMesh(this._unionFields, scene);
            }

            if (chunk.toString() == "Origin: -24,0,0 Size: 8,8,8 VoxelSize: 0.5") {
                console.log("chunk bounds: ", chunk.currentBounds.toString());
                console.log("Chunk fields: ", chunkFields.size, " Empty: ", emptyChunk);
            }

            if (emptyChunk) {
                chunk.deleteMesh(scene);
                this._chunkTree.remove(chunk);
            }
        }
        this._dirtyChunks.clear();
    }


    private _createChunksForField(sdf: SignedDistanceField, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
        const voxels = 16;  //Math.max(8,1 << 31 - Math.clz32(32 - (chunkDist / 2)));

        // fast rejection, compare chunk bounds to sdf bounds
        chunkBounds.set(minX, minY, minZ, maxX, maxY, maxZ);
        if (!chunkBounds.overlapSphere(sdf.currentBounds)) {
            // sdf does not overlap chunk bounds so skip it
            return;
        }

        const chunkExtent = chunkBounds.extent;
        // note chunkDist will be negative if origin is inside the chunk
        const chunkDist = chunkBounds.distanceTo(this._origin);

        const scalingFactor = 0.50741;
        const targetSize = Math.max(chunkDist * scalingFactor,2);
        
        const viewPointInChunk = chunkDist < 0;
        // use larger chunks further away
        if (viewPointInChunk || chunkExtent > targetSize) {
            // subdivide chunk bounds until it is smaller than the target scale
            const halfExtent = (maxX - minX) / 2;
            const middleX = minX + halfExtent;
            const middleY = minY + halfExtent;
            const middleZ = minZ + halfExtent;
            this._createChunksForField(sdf, minX, minY, minZ, middleX, middleY, middleZ);
            this._createChunksForField(sdf, middleX, minY, minZ, maxX, middleY, middleZ);
            this._createChunksForField(sdf, minX, middleY, minZ, middleX, maxY, middleZ);
            this._createChunksForField(sdf, middleX, middleY, minZ, maxX, maxY, middleZ);
            this._createChunksForField(sdf, minX, minY, middleZ, middleX, middleY, maxZ);
            this._createChunksForField(sdf, middleX, minY, middleZ, maxX, middleY, maxZ);
            this._createChunksForField(sdf, minX, middleY, middleZ, middleX, maxY, maxZ);
            this._createChunksForField(sdf, middleX, middleY, middleZ, maxX, maxY, maxZ);
        }
        else {
            // chunk bounds is smaller than the target scale, so add the sdf to this chunk
            const newChunk = new Chunk();
            newChunk.setOrigin({ x: chunkBounds.minX, y: chunkBounds.minY, z: chunkBounds.minZ });
            
            const extent = chunkBounds.extent;
            // use fewer voxels per chunk further away
            newChunk.setSize({ x: extent, y: extent, z: extent }, extent / voxels);


            newChunk.updateCurrentBounds();

            // const chunks = [
            //     "Origin: 2048,-1024,0 Size: 1024,1024,1024 VoxelSize: 64",
            //     "Origin: 2048,0,0 Size: 1024,1024,1024 VoxelSize: 64",
            //     "Origin: 3072,-512,0 Size: 512,512,512 VoxelSize: 32",
            //     "Origin: 3072,0,0 Size: 512,512,512 VoxelSize: 32"
            // ];
            // if (!chunks.find(x => newChunk.toString() === x))
            //     return;

            const expandBy = newChunk.getVoxelSize() * 2;
            chunkBounds.expandByScalar(expandBy);
            nearbyChunks.clear();
            this._chunkTree.getItemsInBox(chunkBounds, nearbyChunks);
            for (const chunk of nearbyChunks) {
                               
                chunk.copyOriginTo(chunkOrigin);
                if (chunk.isAtSamePositionAs(newChunk)) {
                    // chunk already exists, so skip it
                    return;
                }
                else
                {                  
                    chunk.updateSharedBorders(newChunk);
                }
            }
            chunkBounds.expandByScalar(-expandBy);

            this._chunkTree.insert(newChunk);
            this._dirtyChunks.add(newChunk);
        }
    }

}

export { ChunkManager };