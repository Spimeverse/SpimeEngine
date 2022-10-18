import { Vector3 } from "@babylonjs/core";
import { ChunkManager, SdfSphere } from ".."

export function TestChunkManager() {
        
    describe('ChunkManager', () => {

        it('adding an object creates a chunk', () => {
            const chunkManager = new ChunkManager();
            const sphere = new SdfSphere(0.4);
            sphere.setPosition(0.5, 0.5, 0.5);
            chunkManager.addField(sphere);
            expect(ChunkState(chunkManager)).toBe(
                "\nOrigin: 0,0,0 Size: 4,4,4 VoxelSize: 0.25");
        });

        it('adding an object can create multiple chunks', () => {
            const chunkManager = new ChunkManager();
            const sphere = new SdfSphere(1);
            sphere.setPosition(1, 1, 0);
            chunkManager.addField(sphere);
            expect(ChunkState(chunkManager)).toBe(
                "\nOrigin: 0,0,-4 Size: 4,4,4 VoxelSize: 0.25" +
                "\nOrigin: 0,0,0 Size: 4,4,4 VoxelSize: 0.25");
        });

        it('adding an object creates a chunk at the right position', () => {
            const chunkManager = new ChunkManager();
            const sphere = new SdfSphere(0.5);
            sphere.setPosition(9, 1, 1);
            chunkManager.addField(sphere);
            expect(ChunkState(chunkManager)).toBe(
                "\nOrigin: 8,0,0 Size: 8,8,8 VoxelSize: 0.5");
        });

        it('Creates larger chunks further away from origin', () => {
            const chunkManager = new ChunkManager();
            const sphere = new SdfSphere(0.5);
            sphere.setPosition(66, 3, 3);
            chunkManager.addField(sphere);
            expect(ChunkState(chunkManager)).toBe(
                "\nOrigin: 64,0,0 Size: 64,64,64 VoxelSize: 4");
        });
        
    });

}

function ChunkState(chunkManager: ChunkManager) {
    let result = "";
    const chunks = chunkManager.getChunks();
    // copy chunks to array
    const chunkArray = [];
    for (const chunk of chunks) {
        chunkArray.push(chunk);
    }
    // sort chunks by position
    chunkArray.sort((a, b) => {
        const aOrigin = new Vector3();
        const bOrigin = new Vector3();
        a.copyOriginTo(aOrigin);
        b.copyOriginTo(bOrigin);
        if (aOrigin.x < bOrigin.x) return -1;
        if (aOrigin.x > bOrigin.x) return 1;
        if (aOrigin.y < bOrigin.y) return -1;
        if (aOrigin.y > bOrigin.y) return 1;
        if (aOrigin.z < bOrigin.z) return -1;
        if (aOrigin.z > bOrigin.z) return 1;
        return 0;
    });
    for (let i = 0; i < chunkArray.length; i++) {
        result += "\n" + chunkArray[i].toString();
    }
    return result;
}