import { Chunk, ExtractSurface} from "../";
import { SdfBox,SdfSphere } from "../";
import { SampleFieldXy, SampleFieldXz, SliceSamplesXy, GreyScale, NumScale, Trim } from "../";
import { Vector3 } from "@babylonjs/core";


export function TestMesher() 
{        
    describe('SDF mesher', () => {

    it('creates a cube mesh', () => {
        const field = new SdfBox(4.5,4.5,4.5)
        const chunk = new Chunk(24,8);
        chunk.setOrigin(-12,-12,-12);
        chunk.sample(field);
        const meshVerticies: number[] = [];
        const meshFaces: number[] = [];
        ExtractSurface(chunk,meshVerticies,meshFaces);
        expect(meshFaces).toEqual([
            3, 2, 0, 0, 1, 3, 5, 1, 0, 0, 4, 5, 6, 4, 0, 0, 2, 6, 8, 3, 1, 1, 7, 8, 9, 7, 1, 1, 5, 9, 10, 8, 
            7, 7, 9, 10, 12, 11, 2, 2, 3, 12, 13, 6, 2, 2, 11, 13, 14, 13, 11, 11, 12, 14, 15, 12, 3, 3, 8, 
            15, 16, 14, 12, 12, 15, 16, 16, 15, 8, 8, 10, 16, 18, 5, 4, 4, 17, 18, 19, 17, 4, 4, 6, 19, 20, 
            18, 17, 17, 19, 20, 21, 9, 5, 5, 18, 21, 22, 21, 18, 18, 20, 22, 22, 10, 9, 9, 21, 22, 23, 19, 
            6, 6, 13, 23, 24, 23, 13, 13, 14, 24, 24, 20, 19, 19, 23, 24, 25, 24, 14, 14, 16, 25, 25, 22, 
            20, 20, 24, 25, 25, 16, 10, 10, 22, 25]);
        const roundedVertices = meshVerticies.map(x => {
            return Math.round(x * 100) / 100;
        });
        expect(roundedVertices.length).toBe(78);
        expect(roundedVertices).toEqual([
            -1.89, -1.89, -1.89, -0, -1.98, -1.98, -1.98, -0, -1.98, -0, -0, -2.25, -1.98, -1.98, -0, -0, -2.25, 
            -0, -2.25, -0, -0, 1.89, -1.89, -1.89, 1.98, -0, -1.98, 1.98, -1.98, -0, 2.25, -0, -0, -1.89, 1.89, 
            -1.89, -0, 1.98, -1.98, -1.98, 1.98, -0, -0, 2.25, -0, 1.89, 1.89, -1.89, 1.98, 1.98, -0, -1.89, -1.89, 
            1.89, -0, -1.98, 1.98, -1.98, -0, 1.98, -0, -0, 2.25, 1.89, -1.89, 1.89, 1.98, -0, 1.98, -1.89, 1.89, 
            1.89, -0, 1.98, 1.98, 1.89, 1.89, 1.89]);
    })

    it('creates a sphere mesh', () => {
        const field = new SdfSphere(4.5);
        const chunk = new Chunk(24,8);
        chunk.setOrigin(-12,-12,-12);
        chunk.sample(field);
        const meshVerticies: number[] = [];
        const meshFaces: number[] = [];
        ExtractSurface(chunk,meshVerticies,meshFaces);
        expect(meshFaces.length).toEqual(144);
        expect(meshFaces).toEqual([
            3, 2, 0, 0, 1, 3, 5, 1, 0, 0, 4, 5, 6, 4, 0, 0, 2, 6, 8, 3, 1, 1, 7, 8, 9, 7, 1, 1, 5, 9, 
            10, 8, 7, 7, 9, 10, 12, 11, 2, 2, 3, 12, 13, 6, 2, 2, 11, 13, 14, 13, 11, 11, 12, 14, 15, 
            12, 3, 3, 8, 15, 16, 14, 12, 12, 15, 16, 16, 15, 8, 8, 10, 16, 18, 5, 4, 4, 17, 18, 19, 17, 
            4, 4, 6, 19, 20, 18, 17, 17, 19, 20, 21, 9, 5, 5, 18, 21, 22, 21, 18, 18, 20, 22, 22, 10, 
            9, 9, 21, 22, 23, 19, 6, 6, 13, 23, 24, 23, 13, 13, 14, 24, 24, 20, 19, 19, 23, 24, 25, 24, 
            14, 14, 16, 25, 25, 22, 20, 20, 24, 25, 25, 16, 10, 10, 22, 25]);
        const roundedVertices = meshVerticies.map(x => {
            return Math.round(x * 100) / 100;
        });
        expect(roundedVertices.length).toEqual(78);
        expect(roundedVertices).toEqual([
            -2.36, -2.36, -2.36, -0, -2.68, -2.68, -2.68, -0, -2.68, -0, -0, -3.65, -2.68, -2.68, -0, -0, 
            -3.65, -0, -3.65, -0, -0, 2.36, -2.36, -2.36, 2.68, -0, -2.68, 2.68, -2.68, -0, 3.65, -0, -0, 
            -2.36, 2.36, -2.36, -0, 2.68, -2.68, -2.68, 2.68, -0, -0, 3.65, -0, 2.36, 2.36, -2.36, 2.68, 2.68, 
            -0, -2.36, -2.36, 2.36, -0, -2.68, 2.68, -2.68, -0, 2.68, -0, -0, 3.65, 2.36, -2.36, 2.36, 2.68, -0, 
            2.68, -2.36, 2.36, 2.36, -0, 2.68, 2.68, 2.36, 2.36, 2.36]);
    })

    it('creates a sphere mesh truncated at the sample boundary', () => {
        const field = new SdfSphere(4.5);
        field.position.x = 14;
        const chunk = new Chunk(24,8);
        chunk.sample(field);
        chunk.setOrigin(-12,-12,-12);
        chunk.sample(field);
        const meshVerticies: number[] = [];
        const meshFaces: number[] = [];
        ExtractSurface(chunk,meshVerticies,meshFaces);
        expect(meshFaces.length).toEqual(24);
        expect(meshFaces).toEqual([
            3, 2, 0, 0, 1, 3, 5, 3, 1, 1, 4, 5, 7, 6, 2, 2, 3, 7, 8, 7, 3, 3, 5, 8]);
        const roundedVertices = meshVerticies.map(x => {
            return Math.round(x * 100) / 100;
        });
        expect(roundedVertices.length).toEqual(27);
        expect(roundedVertices).toEqual([
            11.45, -2.3, -2.3, 11.17, -0, -2.6, 11.17, -2.6, -0, 10.34, -0, -0, 11.45, 
            2.3, -2.3, 11.17, 2.6, -0, 11.45, -2.3, 2.3, 11.17, -0, 2.6, 11.45, 2.3, 2.3]);
    })

})

}