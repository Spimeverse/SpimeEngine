import { SampleDimensions, Mesher, SdfSampler } from "../../src/Meshing";
import { SdfBox,SdfSphere } from "../../src/signedDistanceFields";
import { SampleFieldXy, SampleFieldXz, SliceSamplesXy, GreyScale, NumScale, Trim } from "../signedDistanceFields/SdfHelper";
import { Vector3 } from "@babylonjs/core";


export function TestMesher() 
{        
    describe('SDF mesher', () => {

    it('creates a cube mesh', () => {
        const mesher = new Mesher();
        const field = new SdfBox(1,1,1)
        const dims = new SampleDimensions().set(3,4,-1.5,-1.5,-1.5);
        const fieldArray = new Float32Array(dims.samples);
        SdfSampler(field,dims,fieldArray)
        mesher.set(fieldArray,dims);
        const meshVerticies: number[] = [];
        const meshFaces: number[] = [];
        mesher.extractSurface(meshVerticies,meshFaces);
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
        const mesher = new Mesher();
        const field = new SdfSphere(4.5);
        const dims = new SampleDimensions().set(24,8,-12,-12,-12);
        const fieldArray = new Float32Array(dims.samples);
        SdfSampler(field,dims,fieldArray)
        mesher.set(fieldArray,dims);
        const meshVerticies: number[] = [];
        const meshFaces: number[] = [];
        mesher.extractSurface(meshVerticies,meshFaces);
        expect(meshFaces.length).toEqual(180);
        expect(meshFaces).toEqual([
            3, 2, 1, 2, 0, 1, 8, 1, 7, 1, 0, 7, 8, 7, 5, 7, 4, 5, 11, 10, 7, 10, 6, 7, 11, 
            7, 2, 7, 0, 2, 12, 11, 3, 11, 2, 3, 12, 3, 8, 3, 1, 8, 13, 12, 8, 8, 9, 13, 15, 
            14, 12, 14, 11, 12, 17, 5, 16, 5, 4, 16, 19, 7, 18, 7, 6, 18, 19, 16, 7, 16, 4, 
            7, 20, 17, 19, 17, 16, 19, 20, 8, 17, 8, 5, 17, 21, 9, 20, 9, 8, 20, 22, 18, 10, 
            18, 6, 10, 23, 22, 11, 22, 10, 11, 23, 19, 22, 19, 18, 22, 25, 24, 12, 12, 13, 
            25, 25, 21, 24, 21, 20, 24, 25, 13, 21, 13, 9, 21, 26, 23, 11, 11, 14, 26, 27, 
            26, 15, 26, 14, 15, 27, 24, 23, 23, 26, 27, 27, 15, 24, 15, 12, 24, 29, 20, 19, 
            19, 28, 29, 30, 28, 23, 28, 19, 23, 31, 30, 24, 30, 23, 24, 31, 29, 30, 29, 28, 
            30, 31, 24, 20, 20, 29, 31]);
        const roundedVertices = meshVerticies.map(x => {
            return Math.round(x * 100) / 100;
        });
        expect(roundedVertices.length).toEqual(96);
        expect(roundedVertices).toEqual([
            -0.4, -0.4, -4.17, 0.4, -0.4, -4.17, -0.4, 0.4, -4.17, 0.4, 0.4, -4.17, -0.4, -4.17, 
            -0.4, 0.4, -4.17, -0.4, -4.17, -0.4, -0.4, -1.74, -1.74, -1.74, 1.74, -1.74, -1.74, 
            4.17, -0.4, -0.4, -4.17, 0.4, -0.4, -1.74, 1.74, -1.74, 1.74, 1.74, -1.74, 4.17, 0.4, 
            -0.4, -0.4, 4.17, -0.4, 0.4, 4.17, -0.4, -0.4, -4.17, 0.4, 0.4, -4.17, 0.4, -4.17, 
            -0.4, 0.4, -1.74, -1.74, 1.74, 1.74, -1.74, 1.74, 4.17, -0.4, 0.4, -4.17, 0.4, 0.4, 
            -1.74, 1.74, 1.74, 1.74, 1.74, 1.74, 4.17, 0.4, 0.4, -0.4, 4.17, 0.4, 0.4, 4.17, 0.4, 
            -0.4, -0.4, 4.17, 0.4, -0.4, 4.17, -0.4, 0.4, 4.17, 0.4, 0.4, 4.17]);
    })

    it('creates a sphere mesh truncated at the sample boundary', () => {
        const mesher = new Mesher();
        const field = new SdfSphere(4.5);
        field.position.x = 16;
        const dims = new SampleDimensions().set(24,8,-12,-12,-12);
        const fieldArray = new Float32Array(dims.samples);
        SdfSampler(field,dims,fieldArray)
        mesher.set(fieldArray,dims);
        const meshVerticies: number[] = [];
        const meshFaces: number[] = [];
        mesher.extractSurface(meshVerticies,meshFaces);
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