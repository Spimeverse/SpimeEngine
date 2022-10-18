import { Chunk } from "../";
import { Vector3 } from "@babylonjs/core";


export function TestChunkDimensions() 
{        
    describe('Chunk dimensions ', () => {

        it('calculates how many samples are needed', () => {
        let chunk = new Chunk();
        chunk.setSize({x:16,y:16,z:16},1);
        expect(chunk.getNumSamples()).toBe(18 * 18 * 18);

        chunk = new Chunk();
        chunk.setSize({x:10,y:20,z:30},2);
        expect(chunk.getNumSamples()).toBe(7 * 12 * 17);
    })


    it('converts sample index to world space', () => {
        const chunk = new Chunk();
        chunk.setSize({x:8,y:8,z:8},1);
        chunk.setOrigin({x:10,y:20,z:30});
        const samplePoint = new Vector3();
        chunk.indexToWorldSpace(0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 9 Y: 19 Z: 29}");
        chunk.indexToWorldSpace(1,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y: 19 Z: 29}");
        chunk.indexToWorldSpace(10,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 9 Y: 20 Z: 29}");
        chunk.indexToWorldSpace(100,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 9 Y: 19 Z: 30}");
        chunk.indexToWorldSpace(111,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y: 20 Z: 30}");
    })
    
    it('converts cell space world space', () => {
        const chunk = new Chunk();
        chunk.setSize({x:8,y:8,z:8},1);
        chunk.setOrigin({x:10,y:20,z:30});
        const samplePoint = new Vector3();
        chunk.voxelSpaceToWorldSpace({x:0,y:0,z:0},samplePoint);
        expect(samplePoint.toString()).toBe("{X: 9 Y: 19 Z: 29}");
        chunk.voxelSpaceToWorldSpace({x:1,y:0,z:0},samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y: 19 Z: 29}");
        chunk.voxelSpaceToWorldSpace({x:0,y:1,z:0},samplePoint);
        expect(samplePoint.toString()).toBe("{X: 9 Y: 20 Z: 29}");
        chunk.voxelSpaceToWorldSpace({x:0,y:0,z:1},samplePoint);
        expect(samplePoint.toString()).toBe("{X: 9 Y: 19 Z: 30}");
        chunk.voxelSpaceToWorldSpace({x:2,y:2,z:2},samplePoint);
        expect(samplePoint.toString()).toBe("{X: 11 Y: 21 Z: 31}");
    })

})

}