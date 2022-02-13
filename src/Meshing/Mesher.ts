// adapted from a Rust implemenation here 
// https://github.com/bonsairobo/fast-surface-nets-rs/blob/main/src/lib.rs


import { ChunkDimensions } from "./";
import { SignedDistanceField,EmptyField } from "../signedDistanceFields";
import { FloatArray, Vector3 } from "@babylonjs/core";

const pos1 = new Vector3();
const pos2 = new Vector3();
const pos3 = new Vector3();
const pos4 = new Vector3();
const cellCenter = new Vector3();
const samplePoint = new Vector3();
const emptyArray: FloatArray = [];
const cornerOffset: number[] = [];
const cornerDist: number[] = [];
const cellToVertexIndex: number[] = [];
const vertexToCellIndex: number[] = [];
const cellEdgesToConnect: number[] = [];
// flags describing how each cell needs to be connected to it's neigbour
const CONNECTED_CELL =      0b00000001; // 1
const XZ_FACE_CLOCKWISE =   0b00000010; // 2
const XY_FACE_CLOCKWISE =   0b00000100; // 4
const YZ_FACE_CLOCKWISE =   0b00001000; // 8
const XZ_FACE_ANTICLOCK =   0b00010000; // 16
const XY_FACE_ANTICLOCK =   0b00100000; // 32
const YZ_FACE_ANTICLOCK =   0b01000000; // 64
// CUBE_EDGES defines the 12 edges of the cube, from the start point to the end point
// and also a flag to indicate if a face needs to be output.
// only output a face on when the edge meets the far corner of the cube
// i.e c are the cube cell corners and v are the vertices in each cell
// c1 is the corner to generate a face around. 
// each cell will generate a face which is offset but will meet up with the other faces
//     
//     |   v--+--v
//     |   |  |  |
//     c --|- c1-|-
//     |   v--+--v
//     |      |
//     c ---- c ----
// 
const EDGE_START_CORNER = 0;
const EDGE_END_CORNER = 1;
const EDGE_FACE_NORMAL = 2;
const EDGE_FACE_REVERSED = 3;
// only create faces on edges connecting to the cell to the left (-x), below (-y) or Outwards (-z)
// create a clockwise or anticlockwise face depending on whether the edge goes 
// from outside to inside or inside to outside
const CUBE_EDGES = [
    [0, 1, YZ_FACE_CLOCKWISE, YZ_FACE_ANTICLOCK],
    [0, 2, XZ_FACE_CLOCKWISE, XZ_FACE_ANTICLOCK],
    [0, 4, XY_FACE_CLOCKWISE, XY_FACE_ANTICLOCK],
    [1, 3, 0, 0],
    [1, 5, 0, 0],
    [2, 3, 0, 0],
    [2, 6, 0, 0],
    [3, 7, 0, 0],
    [4, 5, 0, 0],
    [4, 6, 0, 0],
    [5, 7, 0, 0],
    [6, 7, 0, 0],
];
const CUBE_CORNER_VECTORS: Vector3[] = [
    new Vector3(0.0, 0.0, 0.0), // 0
    new Vector3(1.0, 0.0, 0.0), // 1
    new Vector3(0.0, 1.0, 0.0), // 2
    new Vector3(1.0, 1.0, 0.0), // 3
    new Vector3(0.0, 0.0, 1.0), // 4
    new Vector3(1.0, 0.0, 1.0), // 5
    new Vector3(0.0, 1.0, 1.0), // 6
    new Vector3(1.0, 1.0, 1.0), // 7
];

class Mesher {
    samples: FloatArray = emptyArray;
    dims: ChunkDimensions = new ChunkDimensions();
    verticies: number[] = [];
    faces: number[] = [];

    set(samples: FloatArray, dims: ChunkDimensions)
    {
        this.samples = samples;
        this.dims = dims;
        this._calcCornerOffsets();
        return this;
    }

    private _calcCornerOffsets(): void {
        let cornerNum = 0;
        const dims = this.dims;
        for (let z = 0; z <= 1; z++) {
            for (let y = 0; y <= 1; y++) {
                for (let x = 0; x <= 1; x++) {
                    cornerOffset[cornerNum] = dims.cellIndex(x,y,z);
                    cornerNum++;
                }
            }
        }
    }

    extractSurface (verticies: number[], faces: number[]): boolean {
        verticies.length = 0;
        faces.length = 0;
        this.verticies = verticies;
        this.faces = faces;
        cellToVertexIndex.length = 0;
        vertexToCellIndex.length = 0;
        cellEdgesToConnect.length = 0;
        this._extractAllCellPoints();
        this._extractAllFaces();
        return true;
    }


    private _extractAllCellPoints() {
        const dims = this.dims;
        for (let cellZ = 0; cellZ <= dims.cells; cellZ++) {
            for (let cellY = 0; cellY <= dims.cells; cellY++) {
                for (let cellX = 0; cellX <= dims.cells; cellX++) {
                    const cellIndex = dims.cellIndex(cellX, cellY, cellZ);
                    let connectEdges = this._extractCellPoint(cellX, cellY, cellZ, cellIndex);
                    if (connectEdges > 0)
                    {
                        // we'll need to find neighboring cells of this point to connect them up
                        // so record the cellindex that the point was created for
                        vertexToCellIndex.push(cellIndex);
                        // then we have to lookup the vertex that is in that cell
                        // note, length divided by 3 because array x y and z stored for each point
                        const vertexIndex = (this.verticies.length / 3) - 1; 
                        cellToVertexIndex[cellIndex] = vertexIndex;
                        // record which neighboring cells to connect with.
                        // but remove flags if we are at edge of this chunk so we don't go over the boundary
                        if (cellX == 0)
                            connectEdges = this._restrictFacesTo(connectEdges,YZ_FACE_CLOCKWISE, YZ_FACE_ANTICLOCK);
                        if (cellY == 0)
                            connectEdges = this._restrictFacesTo(connectEdges,XZ_FACE_CLOCKWISE, XZ_FACE_ANTICLOCK);
                        if (cellZ == 0)
                            connectEdges = this._restrictFacesTo(connectEdges,XY_FACE_CLOCKWISE, XY_FACE_ANTICLOCK);
                        cellEdgesToConnect.push(connectEdges);
                    }
                    else
                        cellToVertexIndex[cellIndex] = -1;
                }
            }
        }
    }

    private _restrictFacesTo(connectedEdges: number, face1: number, face2: number): number {
        return connectedEdges & (face1 | face2 | CONNECTED_CELL);
    }

    private _extractCellPoint(cellX: number, cellY: number, cellZ: number, sampleIndex: number) {
        let negPoints = 0;
        for (let cornerNum = 0; cornerNum < 8; cornerNum++) {
            const cornerIndex = sampleIndex + cornerOffset[cornerNum];
            cornerDist[cornerNum] = this.samples[cornerIndex];
            if (cornerDist[cornerNum] < 0)
                negPoints++;
        }
        if (negPoints == 0 || negPoints == 8)
            return 0;

        const edgeMask = this._calcCellCenter();
        this.dims.cellSpaceToWorldSpace(cellX,cellY,cellZ,samplePoint);
        this.verticies.push(
            cellCenter.x + samplePoint.x,
            cellCenter.y + samplePoint.y,
            cellCenter.z + samplePoint.z);
        return edgeMask;
    }
    
    private _extractAllFaces() {
        for (let pointNum = 0; pointNum < this.verticies.length / 3; pointNum++)
        {
            const connectEdges = cellEdgesToConnect[pointNum];
 
            let cellIndex0 = 0;
            let cellIndex1 = 0;
            let cellIndex2 = 0;
            let cellIndex3 = 0;

            if (connectEdges & XZ_FACE_CLOCKWISE)
            {
                cellIndex0 = vertexToCellIndex[pointNum];
                cellIndex1 = cellIndex0 - this.dims.zStep;
                cellIndex2 = cellIndex0 - this.dims.zStep - this.dims.xStep;
                cellIndex3 = cellIndex0 - this.dims.xStep;
                this._extractFaces(cellIndex0,cellIndex1,cellIndex2,cellIndex3);
            }
            if (connectEdges & XZ_FACE_ANTICLOCK)
            {
                cellIndex0 = vertexToCellIndex[pointNum];
                cellIndex1 = cellIndex0 - this.dims.xStep;
                cellIndex2 = cellIndex0 - this.dims.zStep - this.dims.xStep;
                cellIndex3 = cellIndex0 - this.dims.zStep;
                this._extractFaces(cellIndex0,cellIndex1,cellIndex2,cellIndex3);
            }

            if (connectEdges & XY_FACE_CLOCKWISE)
            {
                cellIndex0 = vertexToCellIndex[pointNum];
                cellIndex1 = cellIndex0 - this.dims.xStep;
                cellIndex2 = cellIndex0 - this.dims.yStep - this.dims.xStep;
                cellIndex3 = cellIndex0 - this.dims.yStep;
                this._extractFaces(cellIndex0,cellIndex1,cellIndex2,cellIndex3);
            }
            if (connectEdges & XY_FACE_ANTICLOCK)
            {
                cellIndex0 = vertexToCellIndex[pointNum];
                cellIndex1 = cellIndex0 - this.dims.yStep;
                cellIndex2 = cellIndex0 - this.dims.yStep - this.dims.xStep;
                cellIndex3 = cellIndex0 - this.dims.xStep;
                this._extractFaces(cellIndex0,cellIndex1,cellIndex2,cellIndex3);
            }

            if (connectEdges & YZ_FACE_CLOCKWISE)
            {
                cellIndex0 = vertexToCellIndex[pointNum];
                cellIndex1 = cellIndex0 - this.dims.yStep;
                cellIndex2 = cellIndex0 - this.dims.zStep - this.dims.yStep;
                cellIndex3 = cellIndex0 - this.dims.zStep;
                this._extractFaces(cellIndex0,cellIndex1,cellIndex2,cellIndex3);
            }
            if (connectEdges & YZ_FACE_ANTICLOCK)
            {
                cellIndex0 = vertexToCellIndex[pointNum];
                cellIndex1 = cellIndex0 - this.dims.zStep;
                cellIndex2 = cellIndex0 - this.dims.zStep - this.dims.yStep;
                cellIndex3 = cellIndex0 - this.dims.yStep;
                this._extractFaces(cellIndex0,cellIndex1,cellIndex2,cellIndex3);
            }

        }
    }
    private _extractFaces(cellIndex0: number, cellIndex1: number, cellIndex2: number, cellIndex3: number) {
        const v1 = cellToVertexIndex[cellIndex0];
        const v2 = cellToVertexIndex[cellIndex1];
        const v3 = cellToVertexIndex[cellIndex2];
        const v4 = cellToVertexIndex[cellIndex3];

        if (v1 < 0 || v2 < 0 || v3 < 0 || v4 < 0)
            return;

        const verticies = this.verticies;
        pos1.set(verticies[v1 * 3],verticies[v1 * 3 + 1],verticies[v1 * 3 + 2]);
        pos2.set(verticies[v2 * 3],verticies[v2 * 3 + 1],verticies[v2 * 3 + 2]);
        pos3.set(verticies[v3 * 3],verticies[v3 * 3 + 1],verticies[v3 * 3 + 2]);
        pos4.set(verticies[v4 * 3],verticies[v4 * 3 + 1],verticies[v4 * 3 + 2]);
        pos1.subtractInPlace(pos4);
        pos2.subtractInPlace(pos3);
        const dist1 = pos1.x * pos1.x + pos1.y * pos1.y + pos1.z * pos1.z;
        const dist2 = pos2.x * pos2.x + pos2.y * pos2.y + pos2.z * pos2.z;
        // Split the quad along the shorter axis, rather than the longer one.
        if (dist1 < dist2) {
            this.faces.push(v1, v2, v3, v3, v4, v1);            
        } else {
            this.faces.push(v1, v2, v4, v2, v3, v4);           
        }
    }

    private _calcCellCenter(): number {
        cellCenter.set(0,0,0);
        let edgeCount = 0;
        let connectEdges = 0;
        for (let edgeNum = 0; edgeNum < 12; edgeNum++) {
            const edgeDetails = CUBE_EDGES[edgeNum];         
            const dist0 = cornerDist[edgeDetails[EDGE_START_CORNER]];
            const dist1 = cornerDist[edgeDetails[EDGE_END_CORNER]];
            // if the distance to the surface changes sign
            // then this edge intersects the surface
            const distNeg0 = (dist0 < 0);
            const distNeg1 = (dist1 < 0);
            if (distNeg0 != distNeg1) {
                connectEdges |= CONNECTED_CELL;
                // record edges were crossed which we need to connect up
                // and if they face in or out ( negative to positive distance or positive to negative)
                if (distNeg0) // at this point if distNeg0 is true, distNeg1 must be false or visa versa
                    connectEdges |= edgeDetails[EDGE_FACE_REVERSED];
                else
                    connectEdges |= edgeDetails[EDGE_FACE_NORMAL];
                edgeCount++;
                const distDiff = dist0 / (dist0 - dist1);
                const inverseDiff = 1 - distDiff;
                const corner0 = CUBE_CORNER_VECTORS[edgeDetails[0]];
                const corner1 = CUBE_CORNER_VECTORS[edgeDetails[1]];
                cellCenter.x += (corner1.x * distDiff) + (corner0.x * inverseDiff);
                cellCenter.y += (corner1.y * distDiff) + (corner0.y * inverseDiff);
                cellCenter.z += (corner1.z * distDiff) + (corner0.z * inverseDiff);
            }
        }
        cellCenter.x /= edgeCount;
        cellCenter.y /= edgeCount;
        cellCenter.z /= edgeCount;

        cellCenter.x *= this.dims.stepSize;
        cellCenter.y *= this.dims.stepSize;
        cellCenter.z *= this.dims.stepSize;
        return connectEdges;
    }



}


export {Mesher}