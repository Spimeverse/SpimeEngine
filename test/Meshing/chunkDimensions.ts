import { Chunk } from "../";
import { Vector3 } from "@babylonjs/core";


export function TestChunkDimensions() 
{        
    describe('Chunk dimensions ', () => {

        it('calculates how many samples are needed', () => {
        let chunk = new Chunk();
        chunk.setSize({ x: 5, y: 5, z: 5 }, 1);
        expect(chunk.getNumSamples()).toBe(10 * 10 * 10);

        chunk = new Chunk();
        chunk.setSize({x:10,y:20,z:30},2);
        expect(chunk.getNumSamples()).toBe(10 * 15 * 20);
    })


    it('converts sample index to world space', () => {
        const chunk = new Chunk();
        chunk.setSize({ x: 5, y: 5, z: 5 }, 1);
        chunk.setPosition({ x: 2.5, y: 4.5, z: 6.5 });
        const samplePoint = new Vector3();
        chunk.indexToWorldSpace(0, samplePoint);
        expect(samplePoint.toString()).toBe("{X: 0 Y: 2 Z: 4}");
        chunk.indexToWorldSpace(1, samplePoint);
        expect(samplePoint.toString()).toBe("{X: 1 Y: 2 Z: 4}");
        chunk.indexToWorldSpace(10, samplePoint);
        expect(samplePoint.toString()).toBe("{X: 0 Y: 3 Z: 4}");
        chunk.indexToWorldSpace(100, samplePoint);
        expect(samplePoint.toString()).toBe("{X: 0 Y: 2 Z: 5}");
        chunk.indexToWorldSpace(111, samplePoint);
        expect(samplePoint.toString()).toBe("{X: 1 Y: 3 Z: 5}");
    })
    
        it('converts cell space world space', () => {
            const chunk = new Chunk();
            chunk.setSize({ x: 5, y: 5, z: 5 }, 1);
            chunk.setPosition({ x: 2.5, y: 4.5, z: 6.5 });
            const samplePoint = new Vector3();
            chunk.voxelSpaceToWorldSpace({ x: 0, y: 0, z: 0 }, samplePoint);
            expect(samplePoint.toString()).toBe("{X: 2 Y: 4 Z: 6}");
            chunk.voxelSpaceToWorldSpace({ x: 1, y: 0, z: 0 }, samplePoint);
            expect(samplePoint.toString()).toBe("{X: 3 Y: 4 Z: 6}");
            chunk.voxelSpaceToWorldSpace({ x: 0, y: 1, z: 0 }, samplePoint);
            expect(samplePoint.toString()).toBe("{X: 2 Y: 5 Z: 6}");
            chunk.voxelSpaceToWorldSpace({ x: 0, y: 0, z: 1 }, samplePoint);
            expect(samplePoint.toString()).toBe("{X: 2 Y: 4 Z: 7}");
            chunk.voxelSpaceToWorldSpace({ x: 2, y: 2, z: 2 }, samplePoint);
            expect(samplePoint.toString()).toBe("{X: 4 Y: 6 Z: 8}");
        })

})

}