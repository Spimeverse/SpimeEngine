import { Vector3 } from "@babylonjs/core";
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
        const voxels = 16;  //Math.max(8,1 << 31 - Math.clz32(32 - (chunkDist / 2)));

        const offset = (maxX - minX) / voxels;
        chunkBounds.set(minX, minY, minZ, maxX + offset, maxY + offset, maxZ + offset);
        if (!chunkBounds.overlapSphere(sdf.currentBounds)) {
            // sdf does not overlap chunk bounds so skip it
            return;
        }
        chunkBounds.set(minX, minY, minZ, maxX, maxY, maxZ);
        
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
            newChunk.setSize({ x: extent, y: extent, z: extent }, extent / voxels);

            // TODO remove this debug code
            const chunks = [
                "Origin: -64,-128,-64 Size: 64,64,64 VoxelSize: 4"]
 
            const filterChunks = [
                "Origin: 16,0,16 Size: 16,16,16 VoxelSize: 1",
                "Origin: 0,0,32 Size: 32,32,32 VoxelSize: 2"
            ]
            // if (!filterChunks.includes(newChunk.toString())) {
            //     return;
            // }

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
            chunkBounds.expandByScalar(-expandBy);

            this._chunkTree.insert(newChunk);

            console.log(`Added chunk at, ${chunkBounds.minX}, ${chunkBounds.minY}, ${chunkBounds.minZ}, with extent ${extent}, nearby chunks ${nearbyChunks.length}`);

        }
    }

}

function TreeState(tree: SparseOctTree<Chunk>): string {
    return NodeState(tree.rootNode,1);
}

function NodeState(node: SparseOctTreeNode<Chunk>,depth: number): string {
    if (node.children.length > 0 || node.items.length > 0 || node.totalItems > 0)
    {
        let s = '\n' + '##'.repeat(depth) + node.bounds.toString() + " - " + node.totalItems;
        // sort node items by name for consistent output
        node.items.sort((a, b) => {
            const aName = a.toString();
            const bName = b.toString();
            if (aName < bName) return -1;
            if (aName > bName) return 1;
            return 0;
        });
        for (let i = 0; i < node.items.length; i++)
        {
            s += '\n' + '..'.repeat(depth) + node.items[i].toString() + " - " + node.items[i].currentBounds.toString();
        }
        for (let i = 0; i < node.children.length; i++)
        {
            s += NodeState(node.children[i],depth + 1);
        }
        return s;
    }
    return "";
}

export { ChunkManager };