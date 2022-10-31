import { Chunk, ExtractSurface, CalcVoxelVertex} from "..";
import { CONNECTED_CELL, XZ_FACE_ANTICLOCK, XY_FACE_ANTICLOCK, YZ_FACE_ANTICLOCK} from "..";
import { SdfBox,SdfSphere } from "..";
import { Vector3 } from "@babylonjs/core";


export function TestMesher() 
{        


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
            const edges = CalcVoxelVertex(cornerDist,vertex);
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
        const meshVerticies: number[] = [];
        const meshFaces: number[] = [];
        ExtractSurface(chunk,field,meshVerticies,meshFaces);
        expect(meshFaces).toEqual([
            3, 1, 0, 0, 2, 3, 5, 4, 0, 0, 1, 5, 6, 2, 0, 0, 4, 6, 7, 3, 2, 2, 6, 7, 7, 5, 1, 1, 3, 7, 7, 6, 4, 4, 5, 7]);
        const roundedVertices = meshVerticies.map(x => {
            return Math.round(x * 100) / 100;
        });
        expect(roundedVertices.length).toBe(24);
        expect(roundedVertices).toEqual([
            -1.62, -1.62, -1.62, -0.75,
            -0.75, 0.75, -0.75, 0.75, -0.75,
            -1.62, 1.62, 1.62, 0.75, -0.75,
            -0.75, 1.62, -1.62, 1.62, 1.62,
            1.62, -1.62, 0.75, 0.75, 0.75]);
    })



})

}

function RoundVert(vertex: Vector3): string {
    return `${vertex.x.toFixed(2)}, ${vertex.y.toFixed(2)} ${vertex.z.toFixed(2)}`;
}