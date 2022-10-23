import { Vector3,Camera, Matrix } from "@babylonjs/core";
import { AxisAlignedBoxBound } from "./Bounds";
import { SignedDistanceField, Chunk } from "..";
import { SparseOctTree, SparseOctTreeNode } from "."

const chunkBounds = new AxisAlignedBoxBound(0, 0, 0, 0, 0, 0);
const worldSize = 16384;
const halfWorld = worldSize / 2;
const nearbyChunks: Chunk[] = [];
const chunkOrigin = new Vector3();

class ChunkManager {

    private _origin: Vector3 = new Vector3();
    private _distToSdf: Vector3 = new Vector3();
    private _worldBounds: AxisAlignedBoxBound;
    private _chunkTree: SparseOctTree<Chunk>;

    constructor() {
        this._worldBounds = new AxisAlignedBoxBound(-halfWorld,-halfWorld,-halfWorld,halfWorld,halfWorld,halfWorld)
        this._chunkTree = new SparseOctTree<Chunk>(this._worldBounds, 32, 4);
     }
    
    setViewOrigin(origin: Vector3) {
        this._origin.copyFrom(origin);
    }

    getChunks(): IterableIterator<Chunk> {
        const chunks: Chunk[] = [];
        this._chunkTree.getItemsInBounds(this._worldBounds, chunks);
        return chunks[Symbol.iterator]();
    }

    addField(sdf: SignedDistanceField) {
        // subdivide chunk bounds until it is smaller than the distance to the sdf
         this._addObjectToChunks(sdf, -halfWorld,-halfWorld,-halfWorld, halfWorld, halfWorld, halfWorld);
    }

    private _addObjectToChunks(sdf: SignedDistanceField, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
        const voxels = 16;  //Math.max(8,1 << 31 - Math.clz32(32 - (chunkDist / 2)));

        // TODO not sure why this was needed, probably should take it out altogether
        // const offset = Math.abs(maxX - minX) / voxels;
        // chunkBounds.set(minX, minY, minZ, maxX + offset, maxY + offset, maxZ + offset);
        chunkBounds.set(minX, minY, minZ, maxX, maxY, maxZ);
        if (!chunkBounds.overlapSphere(sdf.currentBounds)) {
            // sdf does not overlap chunk bounds so skip it
            return;
        }
        //chunkBounds.set(minX, minY, minZ, maxX, maxY, maxZ);
        
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
            this._addObjectToChunks(sdf, minX, minY, minZ, middleX, middleY, middleZ);
            this._addObjectToChunks(sdf, middleX, minY, minZ, maxX, middleY, middleZ);
            this._addObjectToChunks(sdf, minX, middleY, minZ, middleX, maxY, middleZ);
            this._addObjectToChunks(sdf, middleX, middleY, minZ, maxX, maxY, middleZ);
            this._addObjectToChunks(sdf, minX, minY, middleZ, middleX, middleY, maxZ);
            this._addObjectToChunks(sdf, middleX, minY, middleZ, maxX, middleY, maxZ);
            this._addObjectToChunks(sdf, minX, middleY, middleZ, middleX, maxY, maxZ);
            this._addObjectToChunks(sdf, middleX, middleY, middleZ, maxX, maxY, maxZ);
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
            this._chunkTree.getItemsInBounds(chunkBounds, nearbyChunks);
            for (const chunk of nearbyChunks) {
                console.log("Chunk: ", chunk.toString(), "near ", newChunk.toString());
                                
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

        }
    }

}

export { ChunkManager };