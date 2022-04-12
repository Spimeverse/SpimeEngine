import { Chunk, ExtractSurface } from "../";
import { SampleFieldXy, SampleFieldXz, SliceSamplesXy, GreyScale, NumScale, Trim } from "../signedDistanceFields/SdfHelper";
import { Vector3 } from "@babylonjs/core";


export function TestChunkDimensions() 
{        
    describe('Chunk dimensions ', () => {

    it('calculates how many samples are needed', () => {
        let chunk = new Chunk();
        chunk.setSize(7,16);
        expect(chunk.numSamples).toBe(17 * 17 * 17);

        chunk = new Chunk();
        chunk.setSize(3,32);
        expect(chunk.numSamples).toBe(33 * 33 * 33);
    })

    it('converts cell position to sample index', () => {
        const chunk = new Chunk();
        chunk.setSize(7.5,16);
        chunk.setOrigin(10,20,30);
        expect(chunk.cellIndex(0,0,0)).toBe(0);
        expect(chunk.cellIndex(1,0,0)).toBe(1);
        expect(chunk.cellIndex(0,1,0)).toBe(16);
        expect(chunk.cellIndex(0,0,1)).toBe(16 * 16);
        expect(chunk.cellIndex(2,2,2)).toBe(546);
    })

    it('converts sample index to world space', () => {
        const chunk = new Chunk();
        chunk.setSize(16,16);
        chunk.setOrigin(10,20,30);
        const samplePoint = new Vector3();
        chunk.indexToWorldSpace(0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:20 Z:30}");
        chunk.indexToWorldSpace(1,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 11 Y:20 Z:30}");
        chunk.indexToWorldSpace(289,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:21 Z:30}");
        chunk.indexToWorldSpace(4913,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:20 Z:31}");
    })
    
    it('converts cell space world space', () => {
        const chunk = new Chunk();
        chunk.setSize(16,16);
        chunk.setOrigin(10,20,30);
        const samplePoint = new Vector3();
        chunk.cellSpaceToWorldSpace(0,0,0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:20 Z:30}");
        chunk.cellSpaceToWorldSpace(1,0,0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 11 Y:20 Z:30}");
        chunk.cellSpaceToWorldSpace(0,1,0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:21 Z:30}");
        chunk.cellSpaceToWorldSpace(0,0,1,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:20 Z:31}");
        chunk.cellSpaceToWorldSpace(2,2,2,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 12 Y:22 Z:32}");
    })

        
    it('overlaps cell space so meshes can be seamless', () => {
        const chunk = new Chunk();
        chunk.setSize(7.5,16);
        chunk.setOrigin(10,20,30);
        const samplePoint = new Vector3();
        // one more point needed than each cell
        // and one more cell needed to overlap with the next sample space
        // therefore cells = points -2
        expect(chunk.cells).toBe(15); 
        expect(chunk.points).toBe(16);

        chunk.cellSpaceToWorldSpace(14,14,14,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 17 Y:27 Z:37}");
        chunk.cellSpaceToWorldSpace(16,16,16,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 18 Y:28 Z:38}");

        // max cell space
        chunk.cellSpaceToWorldSpace(14,0,0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 17 Y:20 Z:30}");
        // max point coordinate overlaps next space
        chunk.cellSpaceToWorldSpace(16,0,0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 18 Y:20 Z:30}");

        // move to the next world space +7 on the X axis from the previous
        chunk.setOrigin(10 + 7,20,30);
        chunk.cellSpaceToWorldSpace(0,0,0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 17 Y:20 Z:30}");
    })

})

}