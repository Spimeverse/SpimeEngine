import { Chunk, ExtractSurface, CalcCellVertex, GetCellCornerPosition, GetOuterCellCornerPosition} from "../";
import { CONNECTED_CELL, XZ_FACE_ANTICLOCK, XY_FACE_ANTICLOCK, YZ_FACE_ANTICLOCK} from "../";
import { SdfBox,SdfSphere } from "../";
import { SampleFieldXy, SampleFieldXz, SliceSamplesXy, GreyScale, NumScale, Trim } from "../";
import { Vector3 } from "@babylonjs/core";


export function TestMesher() 
{        

    describe("Corner positions", () =>{

        it ("corner 0 xyz 0,0,0 = {X: 0 Y:0 Z:0} and {X: 0 Y:0 Z:0}",()=>{
            const innerPos: Vector3 = new Vector3();
            const outerPos: Vector3 = new Vector3();
            GetCellCornerPosition(0,0,0,0,innerPos);
            GetOuterCellCornerPosition(0,2,0,0,0,outerPos);
            expect(innerPos.toString()).toEqual("{X: 0 Y:0 Z:0}");
            expect(outerPos.toString()).toEqual("{X: 0 Y:0 Z:0}");
        })

        it ("corner 0 xyz 1,0,0 = {X: 1 Y:0 Z:0} and {X: 0 Y:0 Z:0}",()=>{
            const innerPos: Vector3 = new Vector3();
            const outerPos: Vector3 = new Vector3();
            GetCellCornerPosition(0,1,0,0,innerPos);
            GetOuterCellCornerPosition(0,2,1,0,0,outerPos);
            expect(innerPos.toString()).toEqual("{X: 1 Y:0 Z:0}");
            expect(outerPos.toString()).toEqual("{X: 0 Y:0 Z:0}");
        })

        it ("corner 1 xyz 0,0,0 = {X: 1 Y:0 Z:0} and {X: 2 Y:0 Z:0}",()=>{
            const innerPos: Vector3 = new Vector3();
            const outerPos: Vector3 = new Vector3();
            GetCellCornerPosition(1,0,0,0,innerPos);
            GetOuterCellCornerPosition(1,2,0,0,0,outerPos);
            expect(innerPos.toString()).toEqual("{X: 1 Y:0 Z:0}");
            expect(outerPos.toString()).toEqual("{X: 2 Y:0 Z:0}");
        })

        it ("corner 1 xyz 1,0,0 = {X: 2 Y:0 Z:0} and {X: 2 Y:0 Z:0}",()=>{
            const innerPos: Vector3 = new Vector3();
            const outerPos: Vector3 = new Vector3();
            GetCellCornerPosition(1,1,0,0,innerPos);
            GetOuterCellCornerPosition(1,2,1,0,0,outerPos);
            expect(innerPos.toString()).toEqual("{X: 2 Y:0 Z:0}");
            expect(outerPos.toString()).toEqual("{X: 2 Y:0 Z:0}");
        })

        
        it ("corner 1 xyz 2,0,0 = {X: 3 Y:0 Z:0} and {X: 4 Y:0 Z:0}",()=>{
            const innerPos: Vector3 = new Vector3();
            const outerPos: Vector3 = new Vector3();
            GetCellCornerPosition(1,2,0,0,innerPos);
            GetOuterCellCornerPosition(1,2,2,0,0,outerPos);
            expect(innerPos.toString()).toEqual("{X: 3 Y:0 Z:0}");
            expect(outerPos.toString()).toEqual("{X: 4 Y:0 Z:0}");
        })

    });

// Corner numbers
//
//     6 -----7
//    /|     /|
//   2------3 |
//   | 4 ---|-5
//   |/     |/
//   0 -----1
//
    describe("calcCellVertex", () => {

        it('calcs a cell vertex', () => {
            // corner 0 inside a cube other corners outside
            const cornerDist: Float32Array = new Float32Array([-1,1,1,1.41421356237,1,1.41421356237,1.41421356237,1.732050807568877]);
            const vertex = new Vector3();
            const edges = CalcCellVertex(cornerDist,vertex);
            expect(RoundVert(vertex)).toEqual("0.17, 0.17 0.17");
            expect(edges).toEqual(CONNECTED_CELL | XZ_FACE_ANTICLOCK | XY_FACE_ANTICLOCK | YZ_FACE_ANTICLOCK)
        })
    });

    describe('SDF mesher', () => {

    it('creates a cube mesh', () => {
        const field = new SdfBox(4.5,4.5,4.5)
        const chunk = new Chunk();
        chunk.setSize({x:24,y:24,z:24},3);
        chunk.setOrigin({x:-12,y:-12,z:-12});
        chunk.sample(field);
        const meshVerticies: number[] = [];
        const meshFaces: number[] = [];
        const scales = [1,1,1,1,1,1,1,1];
        ExtractSurface(chunk,scales,meshVerticies,meshFaces);
        expect(meshFaces).toEqual([
            3, 1, 0, 0, 2, 3, 5, 4, 0, 0, 1, 5, 6, 2, 0, 0, 4, 6, 7, 3, 2, 2, 6, 7, 7, 5, 1, 1, 3, 7, 7, 6, 4, 4, 5, 7]);
        const roundedVertices = meshVerticies.map(x => {
            return Math.round(x * 100) / 100;
        });
        expect(roundedVertices.length).toBe(24);
        expect(roundedVertices).toEqual([
            -0.75, -0.75, -0.75, -0.75, -0.75, 0.75, -0.75, 0.75, 
            -0.75, -0.75, 0.75, 0.75, 0.75, -0.75, -0.75, 0.75, 
            -0.75, 0.75, 0.75, 0.75, -0.75, 0.75, 0.75, 0.75]);
    })

    it('creates a sphere mesh', () => {
        const field = new SdfSphere(2);
        const chunk = new Chunk();
        chunk.setSize({x:4,y:4,z:4},1);
        chunk.setOrigin({x:-2,y:-2,z:-2});
        chunk.sample(field);
        const meshVerticies: number[] = [];
        const meshFaces: number[] = [];
        const scales = [1,1,1,1,1,1,1,1];
        ExtractSurface(chunk,scales,meshVerticies,meshFaces);
        const facesResults = meshFaces.map(x => x.toString()).join();
        expect(facesResults).toEqual(
            '5,1,0,0,4,5,6,2,1,1,5,6,7,3,2,2,6,7,9,5,4,4,8,9,10,6,5,5,9,10,11,7,6,6,10,11,13,9,8,8,12,13,14,' +
            '10,9,9,13,14,15,11,10,10,14,15,17,16,0,0,1,17,18,17,1,1,2,18,19,18,2,2,3,19,20,4,0,0,16,20,21,19,' +
            '3,3,7,21,22,8,4,4,20,22,23,21,7,7,11,23,24,12,8,8,22,24,25,13,12,12,24,25,26,14,13,13,25,26,27,15,' +
            '14,14,26,27,27,23,11,11,15,27,29,28,16,16,17,29,30,29,17,17,18,30,31,30,18,18,19,31,32,20,16,16,28,' +
            '32,33,31,19,19,21,33,34,22,20,20,32,34,35,33,21,21,23,35,36,24,22,22,34,36,37,25,24,24,36,37,38,26,' +
            '25,25,37,38,39,27,26,26,38,39,39,35,23,23,27,39,41,40,28,28,29,41,42,41,29,29,30,42,43,42,30,30,31,' +
            '43,44,32,28,28,40,44,45,44,40,40,41,45,46,45,41,41,42,46,47,43,31,31,33,47,47,46,42,42,43,47,48,34,' +
            '32,32,44,48,49,48,44,44,45,49,50,49,45,45,46,50,51,47,33,33,35,51,51,50,46,46,47,51,52,36,34,34,48,' +
            '52,53,37,36,36,52,53,53,52,48,48,49,53,54,38,37,37,53,54,54,53,49,49,50,54,55,39,38,38,54,55,55,51,' +
            '35,35,39,55,55,54,50,50,51,55');
        const roundedVertices = meshVerticies.map(x => x.toFixed(2).toString()).join();
        expect(roundedVertices).toEqual('-1.12,-1.12,-1.12,-1.27,-1.27,-0.50,-1.27,-1.27,0.50,-1.12,-1.12,1.12,-1.27,-0.50,-1.27,-1.70,-0.50,-0.50,-1.70,-0.50,0.50,-1.27,-0.50,1.27,-1.27,0.50,-1.27,-1.70,0.50,-0.50,-1.70,0.50,0.50,-1.27,0.50,1.27,-1.12,1.12,-1.12,-1.27,1.27,-0.50,-1.27,1.27,0.50,-1.12,1.12,1.12,-0.50,-1.27,-1.27,-0.50,-1.70,-0.50,-0.50,-1.70,0.50,-0.50,-1.27,1.27,-0.50,-0.50,-1.70,-0.50,-0.50,1.70,-0.50,0.50,-1.70,-0.50,0.50,1.70,-0.50,1.27,-1.27,-0.50,1.70,-0.50,-0.50,1.70,0.50,-0.50,1.27,1.27,0.50,-1.27,-1.27,0.50,-1.70,-0.50,0.50,-1.70,0.50,0.50,-1.27,1.27,0.50,-0.50,-1.70,0.50,-0.50,1.70,0.50,0.50,-1.70,0.50,0.50,1.70,0.50,1.27,-1.27,0.50,1.70,-0.50,0.50,1.70,0.50,0.50,1.27,1.27,1.12,-1.12,-1.12,1.27,-1.27,-0.50,1.27,-1.27,0.50,1.12,-1.12,1.12,1.27,-0.50,-1.27,1.70,-0.50,-0.50,1.70,-0.50,0.50,1.27,-0.50,1.27,1.27,0.50,-1.27,1.70,0.50,-0.50,1.70,0.50,0.50,1.27,0.50,1.27,1.12,1.12,-1.12,1.27,1.27,-0.50,1.27,1.27,0.50,1.12,1.12,1.12');
    })

    it('creates a sphere mesh truncated at the sample boundary', () => {
        const field = new SdfSphere(2);
        field.position.x = 2;
        const chunk = new Chunk();
        chunk.setSize({x:4,y:4,z:4},1);
        chunk.setOrigin({x:-2,y:-2,z:-2});
        chunk.sample(field);
        const meshVerticies: number[] = [];
        const meshFaces: number[] = [];
        const scales = [1,1,1,1,1,1,1,1];
        ExtractSurface(chunk,scales,meshVerticies,meshFaces);
        const facesResults = meshFaces.map(x => x.toString()).join();
        expect(facesResults).toEqual(
            '5,1,0,0,4,5,6,2,1,1,5,6,7,3,2,2,6,7,9,5,4,4,8,9,10,6,5,5,9,10,11,7,6,6,10,11,13,9,8,8,12,13,14,10,9,9,13,14,' +
            '15,11,10,10,14,15,17,16,0,0,1,17,18,17,1,1,2,18,19,18,2,2,3,19,20,4,0,0,16,20,21,19,3,3,7,21,22,8,4,4,20,22,23,' +
            '21,7,7,11,23,24,12,8,8,22,24,25,13,12,12,24,25,26,14,13,13,25,26,27,15,14,14,26,27,27,23,11,11,15,27');
        const roundedVertices = meshVerticies.map(x => x.toFixed(2).toString()).join();
        expect(roundedVertices).toEqual('0.88,-1.12,-1.12,0.73,-1.27,-0.50,0.73,-1.27,0.50,0.88,-1.12,1.12,0.73,-0.50,-1.27,0.30,-0.50,-0.50,0.30,-0.50,0.50,0.73,-0.50,1.27,0.73,0.50,-1.27,0.30,0.50,-0.50,0.30,0.50,0.50,0.73,0.50,1.27,0.88,1.12,-1.12,0.73,1.27,-0.50,0.73,1.27,0.50,0.88,1.12,1.12,1.50,-1.27,-1.27,1.50,-1.70,-0.50,1.50,-1.70,0.50,1.50,-1.27,1.27,1.50,-0.50,-1.70,1.50,-0.50,1.70,1.50,0.50,-1.70,1.50,0.50,1.70,1.50,1.27,-1.27,1.50,1.70,-0.50,1.50,1.70,0.50,1.50,1.27,1.27,2.07,-1.24,-1.24,2.14,-1.43,-0.50,2.14,-1.43,0.50,2.07,-1.24,1.24,2.13,-0.50,-1.43,2.34,-0.50,-0.50,2.34,-0.50,0.50,2.13,-0.50,1.43,2.12,0.50,-1.43,2.32,0.50,-0.50,2.32,0.50,0.50,2.12,0.50,1.43,2.06,1.24,-1.24,2.12,1.43,-0.50,2.12,1.43,0.50,2.06,1.24,1.24');
    })

})

}

function RoundVert(vertex: Vector3): string {
    return `${vertex.x.toFixed(2)}, ${vertex.y.toFixed(2)} ${vertex.z.toFixed(2)}`;
}