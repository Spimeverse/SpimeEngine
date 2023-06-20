import { Chunk, ExtractSurface, CalcVoxelVertex,SetSeamExtra} from "..";
import { CONNECTED_CELL, XZ_FACE_ANTICLOCK, XY_FACE_ANTICLOCK, YZ_FACE_ANTICLOCK, X_MINUS_EDGE,Y_MINUS_EDGE,Z_MINUS_EDGE} from "..";
import { MakeSdfBox } from "..";
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
            expect(edges).toEqual(
                CONNECTED_CELL |
                XZ_FACE_ANTICLOCK |
                XY_FACE_ANTICLOCK |
                YZ_FACE_ANTICLOCK |
                X_MINUS_EDGE |
                Z_MINUS_EDGE |
                Y_MINUS_EDGE)
        })
    });

    describe('SDF mesher', () => {

        it('creates a cube mesh', () => {
            SetSeamExtra(3);
            const field = MakeSdfBox(5, 5, 5)
            const chunk = new Chunk();
            chunk.setSize({ x: 10, y: 10, z: 10 }, 1);
            chunk.setPosition({ x: -5, y: -5, z: -5 });
            const meshVerticies: number[] = [];
            const meshFaces: number[] = [];
            ExtractSurface(chunk, field, meshVerticies, meshFaces);
            expect(meshFaces.length).toBe(900)
            expect(meshVerticies.length).toBe(456);
        })

    })

}

function RoundVert(vertex: Vector3): string {
    return `${vertex.x.toFixed(2)}, ${vertex.y.toFixed(2)} ${vertex.z.toFixed(2)}`;
}