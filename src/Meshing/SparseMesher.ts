// adapted from a Rust implemenation here 
// https://github.com/bonsairobo/fast-surface-nets-rs/blob/main/src/lib.rs


import { ChunkDimensions } from ".";
import { SignedDistanceField } from "../signedDistanceFields";
import { Vector3 } from "@babylonjs/core";

const sqrt3 = Math.sqrt(3);
const pos1 = new Vector3();
const pos2 = new Vector3();
const pos3 = new Vector3();
const pos4 = new Vector3();
const cellCenter = new Vector3();
const samplePoint = new Vector3();
const cornerOffset: number[] = [];
const cornerDist: number[] = [];

const cellToVertexIndex = new Int16Array(32 * 32 * 32);
const vertexToCellIndex = new Int16Array(32 * 32 * 32);
const cellEdgesToConnect = new Int16Array(32 * 32 * 32);
// flags describing how each cell needs to be connected to it's neigbour
const CONNECTED_CELL =    0b0000000001; // 1
const XZ_FACE_CLOCKWISE = 0b0000000010; // 2
const XY_FACE_CLOCKWISE = 0b0000000100; // 4
const YZ_FACE_CLOCKWISE = 0b0000001000; // 8
const XZ_FACE_ANTICLOCK = 0b0000010000; // 16
const XY_FACE_ANTICLOCK = 0b0000100000; // 32
const YZ_FACE_ANTICLOCK = 0b0001000000; // 64
const X_FACE_BORDER     = 0b0010000000; // 128
const Y_FACE_BORDER     = 0b0100000000; // 256
const Z_FACE_BORDER     = 0b1000000000; // 512
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

let samples: Float32Array;
let markedSamples: Int16Array;
let sampleMarker = 0;
let dims: ChunkDimensions;
let verticies: number[];
let faces: number[];
let field: SignedDistanceField;
let sparseSamples = 0;

function CalcCornerOffsets(): void {
    let cornerNum = 0;
    for (let z = 0; z <= 1; z++) {
        for (let y = 0; y <= 1; y++) {
            for (let x = 0; x <= 1; x++) {
                cornerOffset[cornerNum] = dims.cellIndex(x,y,z);
                cornerNum++;
            }
        }
    }
}

function ExtractSurface (_samples: Float32Array, _dims: ChunkDimensions, _field: SignedDistanceField,
    _verticies: number[], _faces: number[]): boolean {

    samples = _samples;
    // use an array of bytes to mark samples we've already calculated
    if (!markedSamples || markedSamples.length < samples.length) {
        markedSamples = new Int16Array(samples.length);
        sampleMarker = 0;
    }
    // increment the marker value for each extraction
    // then we don't need to clear or reset the markedSamples array
    // unless we get to max value for a byte
    sampleMarker++;
    if (sampleMarker == 65535) {
        // we've run out of unique marker values, 
        // reset the marker and clear the array
        sampleMarker = 1;
        markedSamples.fill(0)
    }
    dims = _dims;
    field = _field;
    CalcCornerOffsets();

    verticies = _verticies;
    faces = _faces;

    verticies.length = 0;
    faces.length = 0;
    sparseSamples = 0;
    SubDivideCell(0,0,0,dims.points);
    ExtractAllFaces();
    return verticies.length > 0;
}



function SubDivideCell(cellX: number, cellY: number, cellZ: number, stride: number) {
    if (stride > 1) {
        // see if any of the surface is in this cell, by checking the distance to the surface from the center
        const halfStride = stride >> 1;
        dims.cellSpaceToWorldSpace(cellX + halfStride, cellY + halfStride, cellZ + halfStride, cellCenter);
        const centerDist = field.sample(cellCenter);
        // the maximum distance a field can be for the cell center
        // and still intersect is half the cell size * sqrt3
        // because the hypotenuese is sqrt(x*x+y*y+z*z)
        // we can work this for x=y=z=1 ie sqrt(3)
        // then just do halfcell*sqrt(3)
        const cellRadius = dims.stepSize * halfStride;
        if (Math.abs(centerDist) > cellRadius * sqrt3)
            return; // the surface is further away than the cell size, quit
        else
        {
            // record this distance, the sub cells can reuse it to skip a sample
            const centerIndex = dims.cellIndex(cellX + halfStride,cellY + halfStride, cellZ + halfStride);
            samples[centerIndex] = centerDist;
            sparseSamples++;
            // mark location as calculated to avoid sampling it again
            markedSamples[centerIndex] = sampleMarker;

            SubDivideCell(cellX,                cellY,                  cellZ, halfStride);
            SubDivideCell(cellX + halfStride,   cellY,                  cellZ, halfStride);
            SubDivideCell(cellX,                cellY + halfStride,     cellZ, halfStride);
            SubDivideCell(cellX + halfStride,   cellY + halfStride,     cellZ, halfStride);
            SubDivideCell(cellX,                cellY,                  cellZ + halfStride, halfStride);
            SubDivideCell(cellX + halfStride,   cellY,                  cellZ + halfStride, halfStride);
            SubDivideCell(cellX,                cellY + halfStride,     cellZ + halfStride, halfStride);
            SubDivideCell(cellX + halfStride,   cellY + halfStride,     cellZ + halfStride, halfStride);
        }
    }
    else
    {
        ExtractCell(cellX,cellY,cellZ);
    }
}

function ExtractCell(cellX: number, cellY: number, cellZ: number) {
    const cellIndex = dims.cellIndex(cellX, cellY, cellZ);
    let connectEdges = ExtractPoint(cellX, cellY, cellZ, cellIndex);
    if (connectEdges > 0) {
        // we have to lookup the vertex that is in that cell
        // note, length divided by 3 because array x y and z stored for each point
        const vertexIndex = (verticies.length / 3) - 1;
        cellToVertexIndex[cellIndex] = vertexIndex;
        // we'll need to find neighboring cells of this point to connect them up
        // so record the cellindex that the point was created for
        vertexToCellIndex[vertexIndex] = cellIndex;
        // record which neighboring cells to connect with.
        // flag if we are on the border between this chunk and the next

        // if (cellX == 0)
        //     connectEdges |= X_FACE_BORDER;
        // if (cellY == 0)
        //     connectEdges |= Y_FACE_BORDER;
        // if (cellZ == 0)
        //     connectEdges |= Z_FACE_BORDER;

        // but remove flags if we are at edge of this chunk so we don't go over the boundary
        // flag if we are on the border between this chunk and the next
        if (cellX == 0)
            connectEdges = RestrictFacesTo(connectEdges, YZ_FACE_CLOCKWISE, YZ_FACE_ANTICLOCK);
        if (cellY == 0)
            connectEdges = RestrictFacesTo(connectEdges, XZ_FACE_CLOCKWISE, XZ_FACE_ANTICLOCK);
        if (cellZ == 0)
            connectEdges = RestrictFacesTo(connectEdges, XY_FACE_CLOCKWISE, XY_FACE_ANTICLOCK);

        cellEdgesToConnect[vertexIndex] = connectEdges;
    }
}

function RestrictFacesTo(connectedEdges: number, face1: number, face2: number): number {
    return connectedEdges & (face1 | face2 | CONNECTED_CELL);
}

function ExtractPoint(cellX: number, cellY: number, cellZ: number, sampleIndex: number) {
    if (cellX > dims.cells - 1 || cellY > dims.cells - 1 || cellZ > dims.cells - 1)
        return 0;
    let negPoints = 0;
    for (let cornerNum = 0; cornerNum < 8; cornerNum++) {
        const cornerIndex = sampleIndex + cornerOffset[cornerNum];
        let dist = samples[cornerIndex];
        // see if the sample is marked as calculated.
        if ( markedSamples[cornerIndex] != sampleMarker) {
            // not calculated, sample the field
            dims.indexToWorldSpace(cornerIndex,samplePoint);
            dist = field.sample(samplePoint);
            samples[cornerIndex] = dist;
            sparseSamples++;
            markedSamples[cornerIndex] = sampleMarker;
        }
        cornerDist[cornerNum] = dist;
        if (cornerDist[cornerNum] < 0)
            negPoints++;
    }
    if (negPoints == 0 || negPoints == 8)
        return 0;

    const edgeMask = CalcCellSurfacePoint();
    dims.cellSpaceToWorldSpace(cellX,cellY,cellZ,samplePoint);
    verticies.push(
        cellCenter.x + samplePoint.x,
        cellCenter.y + samplePoint.y,
        cellCenter.z + samplePoint.z);
    return edgeMask;
}

function ExtractAllFaces() {
    for (let pointNum = 0; pointNum < verticies.length / 3; pointNum++)
    {
        const connectEdges = cellEdgesToConnect[pointNum];

        let cellIndex0 = 0;
        let cellIndex1 = 0;
        let cellIndex2 = 0;
        let cellIndex3 = 0;

        if (connectEdges & XZ_FACE_CLOCKWISE)
        {
            cellIndex0 = vertexToCellIndex[pointNum];
            cellIndex1 = cellIndex0 - dims.zStep;
            cellIndex2 = cellIndex0 - dims.zStep - dims.xStep;
            cellIndex3 = cellIndex0 - dims.xStep;
            ExtractFaces(cellIndex0,cellIndex1,cellIndex2,cellIndex3,connectEdges);
        }
        if (connectEdges & XZ_FACE_ANTICLOCK)
        {
            cellIndex0 = vertexToCellIndex[pointNum];
            cellIndex1 = cellIndex0 - dims.xStep;
            cellIndex2 = cellIndex0 - dims.zStep - dims.xStep;
            cellIndex3 = cellIndex0 - dims.zStep;
            ExtractFaces(cellIndex0,cellIndex1,cellIndex2,cellIndex3,connectEdges);
        }

        if (connectEdges & XY_FACE_CLOCKWISE)
        {
            cellIndex0 = vertexToCellIndex[pointNum];
            cellIndex1 = cellIndex0 - dims.xStep;
            cellIndex2 = cellIndex0 - dims.yStep - dims.xStep;
            cellIndex3 = cellIndex0 - dims.yStep;
            ExtractFaces(cellIndex0,cellIndex1,cellIndex2,cellIndex3,connectEdges);
        }
        if (connectEdges & XY_FACE_ANTICLOCK)
        {
            cellIndex0 = vertexToCellIndex[pointNum];
            cellIndex1 = cellIndex0 - dims.yStep;
            cellIndex2 = cellIndex0 - dims.yStep - dims.xStep;
            cellIndex3 = cellIndex0 - dims.xStep;
            ExtractFaces(cellIndex0,cellIndex1,cellIndex2,cellIndex3,connectEdges);
        }

        if (connectEdges & YZ_FACE_CLOCKWISE)
        {
            cellIndex0 = vertexToCellIndex[pointNum];
            cellIndex1 = cellIndex0 - dims.yStep;
            cellIndex2 = cellIndex0 - dims.zStep - dims.yStep;
            cellIndex3 = cellIndex0 - dims.zStep;
            ExtractFaces(cellIndex0,cellIndex1,cellIndex2,cellIndex3,connectEdges);
        }
        if (connectEdges & YZ_FACE_ANTICLOCK)
        {
            cellIndex0 = vertexToCellIndex[pointNum];
            cellIndex1 = cellIndex0 - dims.zStep;
            cellIndex2 = cellIndex0 - dims.zStep - dims.yStep;
            cellIndex3 = cellIndex0 - dims.yStep;
            ExtractFaces(cellIndex0,cellIndex1,cellIndex2,cellIndex3,connectEdges);
        }

    }
}

function ExtractFaces(cellIndex0: number, cellIndex1: number, cellIndex2: number, cellIndex3: number, connectedEdges: number) {
    const v1 = cellToVertexIndex[cellIndex0];
    const v2 = cellToVertexIndex[cellIndex1];
    const v3 = cellToVertexIndex[cellIndex2];
    const v4 = cellToVertexIndex[cellIndex3];

    if (v1 < 0 || v2 < 0 || v3 < 0 || v4 < 0)
        return;

    pos1.set(verticies[v1 * 3],verticies[v1 * 3 + 1],verticies[v1 * 3 + 2]);
    pos2.set(verticies[v2 * 3],verticies[v2 * 3 + 1],verticies[v2 * 3 + 2]);
    pos3.set(verticies[v3 * 3],verticies[v3 * 3 + 1],verticies[v3 * 3 + 2]);
    pos4.set(verticies[v4 * 3],verticies[v4 * 3 + 1],verticies[v4 * 3 + 2]);
    pos1.subtractInPlace(pos4);
    pos2.subtractInPlace(pos3);
    const dist1 = pos1.x * pos1.x + pos1.y * pos1.y + pos1.z * pos1.z;
    const dist2 = pos2.x * pos2.x + pos2.y * pos2.y + pos2.z * pos2.z;
    // Split the quad along the shorter axis, rather than the longer one.
    if (Math.abs(dist1 - dist2) > 1e-6) {
        faces.push(v1, v2, v3, v3, v4, v1);            
    } else {
        faces.push(v1, v2, v4, v2, v3, v4);           
    }
}

function CalcCellSurfacePoint(): number {
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

    cellCenter.x *= dims.stepSize;
    cellCenter.y *= dims.stepSize;
    cellCenter.z *= dims.stepSize;
    return connectEdges;
}


export {ExtractSurface,sparseSamples}