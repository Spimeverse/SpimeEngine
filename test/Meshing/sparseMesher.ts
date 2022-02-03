import { SampleDimensions, ExtractSurface , SdfSampler } from "../../src/Meshing";
import { SdfBox,SdfSphere } from "../../src/signedDistanceFields";
import { SampleFieldXy, SampleFieldXz, SliceSamplesXy, GreyScale, NumScale, Trim } from "../signedDistanceFields/SdfHelper";
import { Vector3 } from "@babylonjs/core";


export function TestSparseMesher() 
{        
    describe('sparse SDF mesher', () => {

    it('creates a cube mesh', () => {
        const field = new SdfBox(1,1,1)
        const dims = new SampleDimensions().set(3,4,-1.5,-1.5,-1.5);
        const fieldArray = new Float32Array(dims.samples);
        const meshVerticies: number[] = [];
        const meshFaces: number[] = [];
        const extracted = ExtractSurface(fieldArray,dims,field,meshVerticies,meshFaces);
        expect(extracted).toBe(true);

        expect(meshFaces).toEqual([
            3, 2, 1, 2, 0, 1, 
            5, 1, 4, 1, 0, 4, 
            6, 4, 2, 4, 0, 2, 
            7, 6, 3, 6, 2, 3, 
            7, 5, 6, 5, 4, 6, 
            7, 3, 5, 3, 1, 5]);
        const roundedVertices = meshVerticies.map(x => {
            return Math.round(x * 100) / 100;
        });
        expect(roundedVertices).toEqual([
            -0.17, -0.17, -0.17, 
            0.17, -0.17, -0.17, 
            -0.17, 0.17, -0.17, 
            0.17, 0.17, -0.17, 
            -0.17, -0.17, 0.17, 
            0.17, -0.17, 0.17, 
            -0.17, 0.17, 0.17, 
            0.17, 0.17, 0.17]);
    })

    it('creates a sphere mesh', () => {
        const field = new SdfSphere(4.5);
        const dims = new SampleDimensions().set(24,8,-12,-12,-12);
        const fieldArray = new Float32Array(dims.samples);
        const meshVerticies: number[] = [];
        const meshFaces: number[] = [];
        const extracted = ExtractSurface(fieldArray,dims,field,meshVerticies,meshFaces);
        expect(extracted).toBe(true);
        expect(meshFaces.length).toEqual(180);
        expect(meshFaces).toEqual([
            3, 2, 0, 0, 1, 3, 7, 5, 4, 4, 6, 7, 11, 10, 8, 8, 9, 11, 13, 1, 12, 1, 0, 12, 13, 12, 
            4, 4, 5, 13, 14, 9, 12, 9, 8, 12, 14, 12, 0, 0, 2, 14, 15, 14, 3, 14, 2, 3, 15, 3, 13, 
            3, 1, 13, 16, 12, 8, 8, 10, 16, 16, 6, 12, 6, 4, 12, 17, 7, 16, 7, 6, 16, 17, 13, 7, 
            13, 5, 7, 18, 11, 14, 11, 9, 14, 18, 16, 11, 16, 10, 11, 21, 15, 13, 13, 20, 21, 22, 
            20, 13, 13, 17, 22, 23, 19, 15, 15, 21, 23, 23, 22, 19, 22, 17, 19, 23, 21, 22, 21, 
            20, 22, 25, 24, 14, 14, 15, 25, 26, 18, 14, 14, 24, 26, 27, 26, 25, 26, 24, 25, 27, 
            19, 18, 18, 26, 27, 27, 25, 19, 25, 15, 19, 29, 17, 16, 16, 28, 29, 30, 28, 16, 16, 18, 
            30, 31, 30, 19, 30, 18, 19, 31, 29, 30, 29, 28, 30, 31, 19, 17, 17, 29, 31]);
        const roundedVertices = meshVerticies.map(x => {
            return Math.round(x * 100) / 100;
        });
        expect(roundedVertices.length).toEqual(96);
        expect(roundedVertices).toEqual([
            -0.4, -0.4, -4.17, 0.4, -0.4, -4.17, -0.4, 0.4, -4.17, 0.4, 0.4, -4.17, -0.4, -4.17, -0.4, 
            0.4, -4.17, -0.4, -0.4, -4.17, 0.4, 0.4, -4.17, 0.4, -4.17, -0.4, -0.4, -4.17, 0.4, -0.4, 
            -4.17, -0.4, 0.4, -4.17, 0.4, 0.4, -1.74, -1.74, -1.74, 1.74, -1.74, -1.74, -1.74, 1.74, 
            -1.74, 1.74, 1.74, -1.74, -1.74, -1.74, 1.74, 1.74, -1.74, 1.74, -1.74, 1.74, 1.74, 1.74, 
            1.74, 1.74, 4.17, -0.4, -0.4, 4.17, 0.4, -0.4, 4.17, -0.4, 0.4, 4.17, 0.4, 0.4, -0.4, 4.17, 
            -0.4, 0.4, 4.17, -0.4, -0.4, 4.17, 0.4, 0.4, 4.17, 0.4, -0.4, -0.4, 4.17, 0.4, -0.4, 4.17, 
            -0.4, 0.4, 4.17, 0.4, 0.4, 4.17]);
    })

    it('creates a sphere mesh truncated at the sample boundary', () => {
        const field = new SdfSphere(4.5);
        field.position.x = 16;
        const dims = new SampleDimensions().set(24,8,-12,-12,-12);
        const fieldArray = new Float32Array(dims.samples);
        const meshVerticies: number[] = [];
        const meshFaces: number[] = [];
        const extracted = ExtractSurface(fieldArray,dims,field,meshVerticies,meshFaces);
        expect(extracted).toBe(true);
        expect(meshFaces.length).toEqual(54);
        expect(meshFaces).toEqual([
            6, 5, 4, 5, 3, 4, 6, 4, 1, 4, 0, 1, 10, 4, 9, 4, 3, 9, 10, 8, 
            4, 8, 2, 4, 11, 9, 5, 9, 3, 5, 12, 11, 6, 11, 5, 6, 12, 10, 
            11, 10, 9, 11, 13, 12, 6, 6, 7, 13, 15, 14, 12, 14, 10, 12]);
        const roundedVertices = meshVerticies.map(x => {
            return Math.round(x * 100) / 100;
        });
        expect(roundedVertices.length).toEqual(48);
        expect(roundedVertices).toEqual([
            15.6, -0.4, -4.17, 15.6, 0.4, -4.17, 15.6, -4.17, -0.4, 11.83, 
            -0.4, -0.4, 14.26, -1.74, -1.74, 11.83, 0.4, -0.4, 14.26, 1.74, 
            -1.74, 15.6, 4.17, -0.4, 15.6, -4.17, 0.4, 11.83, -0.4, 0.4, 14.26, 
            -1.74, 1.74, 11.83, 0.4, 0.4, 14.26, 1.74, 1.74, 15.6, 4.17, 
            0.4, 15.6, -0.4, 4.17, 15.6, 0.4, 4.17]);
    })

})

}