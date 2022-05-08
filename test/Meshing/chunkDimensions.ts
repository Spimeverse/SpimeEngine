import { Chunk, ExtractSurface } from "../";
import { SampleFieldXy, SampleFieldXz, SliceSamplesXy, GreyScale, NumScale, Trim } from "../signedDistanceFields/SdfHelper";
import { Vector3 } from "@babylonjs/core";


export function TestChunkDimensions() 
{        
    describe('Chunk dimensions ', () => {

    it('calculates how many samples are needed', () => {
        let chunk = new Chunk();
        chunk.setSize({x:16,y:16,z:16},1);
        expect(chunk.numSamples).toBe(17 * 17 * 17);

        chunk = new Chunk();
        chunk.setSize({x:10,y:20,z:30},2);
        expect(chunk.numSamples).toBe(6 * 11 * 16);
    })

    it('converts cell position to sample index', () => {
        const chunk = new Chunk();
        chunk.setSize({x:10,y:20,z:30},2);
        chunk.setOrigin({x:10,y:20,z:30});
        expect(chunk.cellIndex(0,0,0)).toBe(0);
        expect(chunk.cellIndex(1,0,0)).toBe(1);
        expect(chunk.cellIndex(0,1,0)).toBe(6);
        expect(chunk.cellIndex(0,0,1)).toBe(6 * 11);
        expect(chunk.cellIndex(2,2,2)).toBe(2 + (6 * 2) + (66 * 2));
    })

    it('converts sample index to world space', () => {
        const chunk = new Chunk();
        chunk.setSize({x:9,y:9,z:9},1);
        chunk.setOrigin({x:10,y:20,z:30});
        const samplePoint = new Vector3();
        chunk.indexToWorldSpace(0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:20 Z:30}");
        chunk.indexToWorldSpace(1,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 11 Y:20 Z:30}");
        chunk.indexToWorldSpace(10,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:21 Z:30}");
        chunk.indexToWorldSpace(100,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:20 Z:31}");
        chunk.indexToWorldSpace(111,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 11 Y:21 Z:31}");
    })
    
    it('converts cell space world space', () => {
        const chunk = new Chunk();
        chunk.setSize({x:9,y:9,z:9},1);
        chunk.setOrigin({x:10,y:20,z:30});
        const samplePoint = new Vector3();
        chunk.cellSpaceToWorldSpace({x:0,y:0,z:0},samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:20 Z:30}");
        chunk.cellSpaceToWorldSpace({x:1,y:0,z:0},samplePoint);
        expect(samplePoint.toString()).toBe("{X: 11 Y:20 Z:30}");
        chunk.cellSpaceToWorldSpace({x:0,y:1,z:0},samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:21 Z:30}");
        chunk.cellSpaceToWorldSpace({x:0,y:0,z:1},samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:20 Z:31}");
        chunk.cellSpaceToWorldSpace({x:2,y:2,z:2},samplePoint);
        expect(samplePoint.toString()).toBe("{X: 12 Y:22 Z:32}");
    })

})

}