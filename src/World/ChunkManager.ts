import { Vector3 } from "@babylonjs/core";
import { AxisAlignedBoxBound } from "./Bounds";
import { SignedDistanceField, Chunk } from "..";
import { SparseOctTree } from "."

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
        this._chunkTree = new SparseOctTree<Chunk>(this._worldBounds, 32, 4)
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
        chunkBounds.set(minX, minY, minZ, maxX, maxY, maxZ);
        if (!chunkBounds.overlapSphere(sdf.currentBounds)) {
            // sdf does not overlap chunk bounds so skip it
            return;
        }
        const chunkExtent = chunkBounds.extent;
        const chunkDist = chunkBounds.distanceTo(this._origin);
        const target = 4 + chunkDist;
        // use larger chunks further away
        if ((chunkDist < 0 || chunkExtent > target) && chunkExtent > 1) {
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
            const voxels = Math.max(8,1 << 31 - Math.clz32(32 - (chunkDist / 2)));
            newChunk.setSize({ x: extent, y: extent, z: extent }, extent / voxels);
            newChunk.updateCurrentBounds();
            const expandBy = chunkBounds.extent * 0.1;
            chunkBounds.expandByScalar(expandBy);
            this._chunkTree.getItemsInBounds(chunkBounds, nearbyChunks);
            for (const chunk of nearbyChunks) {
                chunk.copyOriginTo(chunkOrigin);
                if (chunk.isAtSamePositionAs(newChunk)) {
                    // chunk already exists, so skip it
                    console.log(`Chunk already exists at, ${chunkBounds.minX}, ${chunkBounds.minY}, ${chunkBounds.minZ}`);
                    return;
                }
                else
                {
                    chunk.updateSharedBorders(newChunk);
                }
            }
            this._chunkTree.insert(newChunk);
            chunkBounds.expandByScalar(-expandBy);
            console.log(`Added chunk at, ${chunkBounds.minX}, ${chunkBounds.minY}, ${chunkBounds.minZ}, with extent ${extent}, nearby chunks ${nearbyChunks.length}`);
        }
    }

    snapToNeighbours(chunkBounds: AxisAlignedBoxBound, snapScale: number) {
        // snap chunk bounds to nearest snapScale
        chunkBounds.minX = Math.floor(chunkBounds.minX / snapScale) * snapScale;
        chunkBounds.minY = Math.floor(chunkBounds.minY / snapScale) * snapScale;
        chunkBounds.minZ = Math.floor(chunkBounds.minZ / snapScale) * snapScale;
        chunkBounds.maxX = Math.ceil(chunkBounds.maxX / snapScale) * snapScale;
        chunkBounds.maxY = Math.ceil(chunkBounds.maxY / snapScale) * snapScale;
        chunkBounds.maxZ = Math.ceil(chunkBounds.maxZ / snapScale) * snapScale;
    }

}

export { ChunkManager };