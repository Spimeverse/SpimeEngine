import { ChunkDimensions, Mesher, SdfSampler } from "../../src";
import { SampleFieldXy, SampleFieldXz, SliceSamplesXy, GreyScale, NumScale, Trim } from "../signedDistanceFields/SdfHelper";
import { Vector3 } from "@babylonjs/core";


export function TestChunkDimensions() 
{        
    describe('Chunk dimensions ', () => {

    it('calculates how many samples are needed', () => {
        const dims = new ChunkDimensions().set(7,16,10,20,30);
        expect(dims.samples).toBe(16 * 16 * 16);

        dims.set(3,32,0,0,0);
        expect(dims.samples).toBe(32 * 32 * 32);
    })

    it('converts cell position to sample index', () => {
        const dims = new ChunkDimensions().set(7,16,10,20,30);
        expect(dims.cellIndex(0,0,0)).toBe(0);
        expect(dims.cellIndex(1,0,0)).toBe(1);
        expect(dims.cellIndex(0,1,0)).toBe(16);
        expect(dims.cellIndex(0,0,1)).toBe(16 * 16);
        expect(dims.cellIndex(2,2,2)).toBe(546);
    })

    it('converts sample index to world space', () => {
        const dims = new ChunkDimensions().set(7,16,10,20,30);
        const samplePoint = new Vector3();
        dims.indexToWorldSpace(0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:20 Z:30}");
        dims.indexToWorldSpace(1,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10.5 Y:20 Z:30}");
        dims.indexToWorldSpace(16,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:20.5 Z:30}");
        dims.indexToWorldSpace(546,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 11 Y:21 Z:31}");
    })
    
    it('converts cell space world space', () => {
        const dims = new ChunkDimensions().set(7,16,10,20,30);
        const samplePoint = new Vector3();
        dims.cellSpaceToWorldSpace(0,0,0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:20 Z:30}");
        dims.cellSpaceToWorldSpace(1,0,0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10.5 Y:20 Z:30}");
        dims.cellSpaceToWorldSpace(0,1,0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:20.5 Z:30}");
        dims.cellSpaceToWorldSpace(0,0,1,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 10 Y:20 Z:30.5}");
        dims.cellSpaceToWorldSpace(2,2,2,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 11 Y:21 Z:31}");
    })

        
    it('overlaps cell space so meshes can be seamless', () => {
        const dims = new ChunkDimensions().set(7,16,10,20,30);
        const samplePoint = new Vector3();
        // one more point needed than each cell
        // and one more cell needed to overlap with the next sample space
        // therefore cells = points -2
        expect(dims.cells).toBe(14); 
        expect(dims.points).toBe(16);

        dims.cellSpaceToWorldSpace(14,14,14,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 17 Y:27 Z:37}");
        dims.cellSpaceToWorldSpace(16,16,16,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 18 Y:28 Z:38}");

        // max cell space
        dims.cellSpaceToWorldSpace(14,0,0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 17 Y:20 Z:30}");
        // max point coordinate overlaps next space
        dims.cellSpaceToWorldSpace(16,0,0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 18 Y:20 Z:30}");

        // move to the next world space +7 on the X axis from the previous
        dims.set(7,16,10 + 7,20,30);
        dims.cellSpaceToWorldSpace(0,0,0,samplePoint);
        expect(samplePoint.toString()).toBe("{X: 17 Y:20 Z:30}");
    })

})

}