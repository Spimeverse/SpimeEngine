// adapted from a Rust implementation here 
// https://github.com/bonsairobo/fast-surface-nets-rs/blob/main/src/lib.rs


import { Chunk, } from ".";
import { Vector3 } from "@babylonjs/core/Maths";

const zeroVector = new Vector3();
const corner0 = new Vector3();
const corner1 = new Vector3();
const cellCenter = new Vector3();
const samplePoint = new Vector3();
const cellPosition = new Vector3();
const outerCellPosition = new Vector3();
const cornerPosition = new Vector3();
const cornerDist: Float32Array = new Float32Array(8);
const outerCornerDist: Float32Array = new Float32Array(8);
const cornerPositions: Vector3[] = [
    new Vector3(), // 0
    new Vector3(), // 1
    new Vector3(), // 2
    new Vector3(), // 3
    new Vector3(), // 4
    new Vector3(), // 5
    new Vector3(), // 6
    new Vector3(), // 7
];
const outerCornerPositions: Vector3[] = [
    new Vector3(), // 0
    new Vector3(), // 1
    new Vector3(), // 2
    new Vector3(), // 3
    new Vector3(), // 4
    new Vector3(), // 5
    new Vector3(), // 6
    new Vector3(), // 7
];
const CUBE_CORNER_OFFSETS: Vector3[] = [
    new Vector3(0.0, 0.0, 0.0), // 0
    new Vector3(1.0, 0.0, 0.0), // 1
    new Vector3(0.0, 1.0, 0.0), // 2
    new Vector3(1.0, 1.0, 0.0), // 3
    new Vector3(0.0, 0.0, 1.0), // 4
    new Vector3(1.0, 0.0, 1.0), // 5
    new Vector3(0.0, 1.0, 1.0), // 6
    new Vector3(1.0, 1.0, 1.0), // 7
];

// flags describing how each cell needs to be connected to it's neighbour
const CONNECTED_CELL =    0b0000000001; // 1
const XZ_FACE_CLOCKWISE = 0b0000000010; // 2
const XY_FACE_CLOCKWISE = 0b0000000100; // 4
const YZ_FACE_CLOCKWISE = 0b0000001000; // 8
const XZ_FACE_ANTICLOCK = 0b0000010000; // 16
const XY_FACE_ANTICLOCK = 0b0000100000; // 32
const YZ_FACE_ANTICLOCK = 0b0001000000; // 64
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

/**
 * lookup which axis each edge aligns with
 */
const CUBE_EDGE_AXIS: Vector3[] = [];

for (let edge = 0; edge < CUBE_EDGES.length; edge++) {
    CUBE_EDGE_AXIS[edge] = new Vector3();
    CUBE_EDGE_AXIS[edge].copyFrom(CUBE_CORNER_OFFSETS[CUBE_EDGES[edge][EDGE_END_CORNER]]);
    CUBE_EDGE_AXIS[edge].subtractInPlace(CUBE_CORNER_OFFSETS[CUBE_EDGES[edge][EDGE_START_CORNER]]);
}


interface Cells {
    count: number;
    lookupCellFromVertex: Int16Array;
    lookupVertexFromCell: Int16Array;
    connections: Int8Array;
 }

let verticies: number[];
let faces: number[];
let chunk: Chunk;
let fieldSamples: Float32Array;
let scale: number[];
let isMixedScale = false;
let maxScale = 1;
const maxCells = 0;

let cells: Cells;

function ExtractSurface (_chunk: Chunk,
    _scale: number[],
    _verticies: number[], _faces: number[]): boolean 
{

    chunk = _chunk;
    fieldSamples = chunk.fieldSamples;
    SetupCells(chunk.numSamples);
    verticies = _verticies;
    faces = _faces;

    scale = _scale;
    maxScale = Math.max(...scale);
    isMixedScale = maxScale > 1;

    verticies.length = 0;
    faces.length = 0;
    CheckAllCells();
    ExtractAllFaces();
    return verticies.length > 0;
}

function CheckAllCells() {
    const subdivisions = chunk.subdivisions;
    for (let cellX = 0; cellX <= subdivisions; cellX ++) {
        for (let cellY = 0; cellY <= subdivisions; cellY ++) {
            for (let cellZ = 0; cellZ <= subdivisions; cellZ ++) {
                CheckCellIntersection(cellX, cellY, cellZ);
            }
        }
    }
}

function CheckCellIntersection (cellX: number, cellY: number, cellZ: number): boolean {
    const cellIndex = chunk.cellIndex(cellX, cellY, cellZ);
    let negPoints = 0;
    if (maxScale > 1) {
        // interpolate the distance from the 8 corners of the larger 'outer' cell
        const c000 = GetOuterDist(0,0,0,cellX, cellY, cellZ);
        const c001 = GetOuterDist(0,0,1,cellX, cellY, cellZ);
        const c010 = GetOuterDist(0,1,0,cellX, cellY, cellZ);
        const c011 = GetOuterDist(0,1,1,cellX, cellY, cellZ);
        const c100 = GetOuterDist(1,0,0,cellX, cellY, cellZ);
        const c101 = GetOuterDist(1,0,1,cellX, cellY, cellZ);
        const c110 = GetOuterDist(1,1,0,cellX, cellY, cellZ);
        const c111 = GetOuterDist(1,1,1,cellX, cellY, cellZ);
        GetOuterCell(cellX, cellY, cellZ, outerCellPosition);

        for (let cornerNum = 0; cornerNum < 8; cornerNum++) {
            GetCellCornerPosition(cornerNum, cellX, cellY, cellZ, cellPosition);

            // https://en.wikipedia.org/wiki/Trilinear_interpolation
            const xd = (cellPosition.x - outerCellPosition.x) / maxScale;
            const yd = (cellPosition.y - outerCellPosition.y) / maxScale;
            const zd = (cellPosition.z - outerCellPosition.z) / maxScale;

            const c00 = c000 * (1 - xd) + c100 * xd;
            const c01 = c001 * (1 - xd) + c101 * xd;
            const c10 = c010 * (1 - xd) + c110 * xd;
            const c11 = c011 * (1 - xd) + c111 * xd;

            const c0 = c00 * (1 - yd) + c10 * yd;
            const c1 = c01 * (1 - yd) + c11 * yd;

            const dist = c0 * (1 - zd) + c1 * zd;

            cornerDist[cornerNum] = dist;

            if (dist < 0)
                negPoints++;
        }
    }
    else {
        for (let cornerNum = 0; cornerNum < 8; cornerNum++) {
            GetCellCornerPosition(cornerNum, cellX, cellY, cellZ, cellPosition);
            cornerDist[cornerNum] = SampleField(cellPosition.x, cellPosition.y, cellPosition.z);
            if (cornerDist[cornerNum] < 0)
                negPoints++;
        }
    }
    if (negPoints == 0 || negPoints == 8)
        return false;

    const edgeMask = CalcCellSurfacePoint();
    cells.connections[cells.count] = edgeMask;
    chunk.cellSpaceToWorldSpace(cellPosition.x,cellPosition.y,cellPosition.z,samplePoint);
    verticies.push(
        cellCenter.x + samplePoint.x,
        cellCenter.y + samplePoint.y,
        cellCenter.z + samplePoint.z);

    cells.lookupVertexFromCell[cellIndex] = cells.count;
    // we'll need to find neighboring cells of this point to connect them up
    // so record the cell index that the point was created for
    cells.lookupCellFromVertex[cells.count] = cellIndex;
    cells.count++;

    return true;
}

function SampleField(cellX: number, cellY: number, cellZ: number) {
    const cellIndex = chunk.cellIndex(cellX, cellY, cellZ);
    return fieldSamples[cellIndex];
}

function ExtractAllFaces() {

    for (let vertexNum = 0; vertexNum < cells.count; vertexNum++)
    {

        // each active cell contains one vertex
        // calculate vertex for this cell
        const cellIndex = cells.lookupCellFromVertex[vertexNum];
        chunk.cellIndexToCellPosition(cellIndex,cellPosition);

        ExtractCell(cells.connections[vertexNum]);
    }
}

function ExtractCell(connectEdges: number) {
    // if (cellPosition.z >= 2)
    // continue;
    // if (cellPosition.x >= 2)
    // continue;
    if (cellPosition.x == 0)
        connectEdges = RestrictFacesTo(connectEdges, YZ_FACE_CLOCKWISE, YZ_FACE_ANTICLOCK);
    if (cellPosition.y == 0)
        connectEdges = RestrictFacesTo(connectEdges, XZ_FACE_CLOCKWISE, XZ_FACE_ANTICLOCK);
    if (cellPosition.z == 0)
        connectEdges = RestrictFacesTo(connectEdges, XY_FACE_CLOCKWISE, XY_FACE_ANTICLOCK);

    if (connectEdges & XZ_FACE_CLOCKWISE) {
        ExtractFaces(cellPosition, [
            [0, 0, 0], [0, 0, -1], [-1, 0, -1],
            [-1, 0, -1], [-1, 0, 0], [0, 0, 0]
        ]);
    }
    if (connectEdges & XZ_FACE_ANTICLOCK) {
        ExtractFaces(cellPosition, [
            [0, 0, 0], [-1, 0, 0], [-1, 0, -1],
            [-1, 0, -1], [0, 0, -1], [0, 0, 0]
        ]);
    }

    if (connectEdges & XY_FACE_CLOCKWISE) {
        ExtractFaces(cellPosition, [
            [0, 0, 0], [-1, 0, 0], [-1, -1, 0],
            [-1, -1, 0], [0, -1, 0], [0, 0, 0]
        ]);
    }
    if (connectEdges & XY_FACE_ANTICLOCK) {
        ExtractFaces(cellPosition, [
            [0, 0, 0], [0, -1, 0], [-1, -1, 0],
            [-1, -1, 0], [-1, 0, 0], [0, 0, 0]
        ]);
    }

    if (connectEdges & YZ_FACE_CLOCKWISE) {
        ExtractFaces(cellPosition, [
            [0, 0, 0], [0, -1, 0], [0, -1, -1],
            [0, -1, -1], [0, 0, -1], [0, 0, 0]
        ]);
    }
    if (connectEdges & YZ_FACE_ANTICLOCK) {
        ExtractFaces(cellPosition, [
            [0, 0, 0], [0, 0, -1], [0, -1, -1],
            [0, -1, -1], [0, -1, 0], [0, 0, 0]
        ]);
    }
}

function ExtractVertex(cellPosition: Vector3) {
    let negDistance = 0;
    for (let cornerNum = 0; cornerNum < 8; cornerNum++) {
        GetCellCornerPosition(cornerNum,cellPosition.x,cellPosition.y,cellPosition.z,cornerPosition);
        const cornerIndex = chunk.cellIndex(cornerPosition.x,cornerPosition.y, cornerPosition.z);      
        cornerDist[cornerNum] = fieldSamples[cornerIndex];

        if (cornerDist[cornerNum] < 0)
            negDistance++;

        if (isMixedScale)
        {
            cornerPositions[cornerNum].copyFrom(cornerPosition);
            GetOuterDist(cornerNum,cellPosition.x,cellPosition.y,cellPosition.z,cornerPosition);
            const cornerIndex = chunk.cellIndex(cornerPosition.x,cornerPosition.y, cornerPosition.z);      
            outerCornerDist[cornerNum] = fieldSamples[cornerIndex];
            outerCornerPositions[cornerNum].copyFrom(cornerPosition);
        }
    }

    console.assert(negDistance != 0 && negDistance != 8,
        {
            negativeDistances:negDistance,
            cell:cellPosition,
            message:"there should be a mix of positive and negative distances"
        });

    const edgeMask = CalcCellSurfacePoint();
    chunk.cellSpaceToWorldSpace(cellPosition.x,cellPosition.y,cellPosition.z,samplePoint);
    verticies.push(
        cellCenter.x + samplePoint.x,
        cellCenter.y + samplePoint.y,
        cellCenter.z + samplePoint.z);
    return edgeMask;
}

function CalcMergeCellSurfacePoint(cellPosition: Vector3): number {
    cellCenter.set(0,0,0);
    let edgeCount = 0;
    let connectEdges = 0;
    for (let edgeNum = 0; edgeNum < 12; edgeNum++) {
        const edgeDetails = CUBE_EDGES[edgeNum];       

        const edgeStartCorner = edgeDetails[EDGE_START_CORNER];
        const edgeEndCorner = edgeDetails[EDGE_END_CORNER];

        let dist0 = cornerDist[edgeStartCorner];
        let dist1 = cornerDist[edgeEndCorner];
        const outerDistStart = outerCornerDist[edgeStartCorner];
        const outerDistEnd = outerCornerDist[edgeEndCorner];

        if (maxScale > 1) {
            const outerDistStart = outerCornerDist[edgeStartCorner];
            const outerDistEnd = outerCornerDist[edgeEndCorner];
            const axis = CUBE_EDGE_AXIS[edgeNum];
            const weightStart = OuterCornerWeight(axis,
                cornerPositions[edgeStartCorner],outerCornerPositions[edgeStartCorner],maxScale);
            const weightEnd = OuterCornerWeight(axis,
                cornerPositions[edgeEndCorner],outerCornerPositions[edgeEndCorner],maxScale);

            const distDiff = outerDistEnd - outerDistStart;
            dist0 = outerDistStart + distDiff * (1 - weightStart);
            dist1 = outerDistEnd - distDiff * (1 - weightEnd);

            // console.log(
            //     'weight start',weightStart,' weight end',weightEnd, '\n',
            //     'distDiff',distDiff, '\n',
            // 'outerDistStart',outerDistStart,'outerDistEnd',outerDistEnd, '\n',
            // 'dist0',dist0,'dist1',dist1);
        }
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
            const corner0 = CUBE_CORNER_OFFSETS[edgeDetails[0]];
            const corner1 = CUBE_CORNER_OFFSETS[edgeDetails[1]];
            cellCenter.x += (corner1.x * distDiff) + (corner0.x * inverseDiff);
            cellCenter.y += (corner1.y * distDiff) + (corner0.y * inverseDiff);
            cellCenter.z += (corner1.z * distDiff) + (corner0.z * inverseDiff);
        }
    }
    cellCenter.x /= edgeCount;
    cellCenter.y /= edgeCount;
    cellCenter.z /= edgeCount;

    cellCenter.x *= chunk.stepSize;
    cellCenter.y *= chunk.stepSize;
    cellCenter.z *= chunk.stepSize;
    return connectEdges;
}

function OuterCornerWeight(axis: Vector3, innerCorner: Vector3, outerCorner: Vector3, scale: number): number {
    cornerPosition.copyFrom(innerCorner);
    cornerPosition.subtractInPlace(outerCorner);
    cornerPosition.multiplyInPlace(axis);
    const weight = Math.max(Math.abs(cornerPosition.x), Math.abs(cornerPosition.y), Math.abs(cornerPosition.z));
    return 1 - (weight / scale);
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
            const corner0 = CUBE_CORNER_OFFSETS[edgeDetails[0]];
            const corner1 = CUBE_CORNER_OFFSETS[edgeDetails[1]];
            cellCenter.x += (corner1.x * distDiff) + (corner0.x * inverseDiff);
            cellCenter.y += (corner1.y * distDiff) + (corner0.y * inverseDiff);
            cellCenter.z += (corner1.z * distDiff) + (corner0.z * inverseDiff);
        }
    }
    cellCenter.x /= edgeCount;
    cellCenter.y /= edgeCount;
    cellCenter.z /= edgeCount;

    cellCenter.x *= chunk.stepSize;
    cellCenter.y *= chunk.stepSize;
    cellCenter.z *= chunk.stepSize;
    return connectEdges;
}

function RestrictFacesTo(connectedEdges: number, face1: number, face2: number): number {
    return connectedEdges & (face1 | face2 | CONNECTED_CELL);
}


function ExtractFaces(cellPosition: Vector3,offsets: number[][]) {
    for (let offsetNum = 0; offsetNum < offsets.length; offsetNum++) {
        const x = cellPosition.x + offsets[offsetNum][0];
        const y = cellPosition.y + offsets[offsetNum][1];
        const z = cellPosition.z + offsets[offsetNum][2];
        const index = chunk.cellIndex(x,y,z);
        const vert = cells.lookupVertexFromCell[index];
        //chunk.cellToVertexIndex[index];
        //const marked = chunk.markedSamples[index] == chunk.sampleMarker;
       faces.push(vert);
    }
   
}


function SetupCells(numSamples: number) {
    if (numSamples > maxCells) {
        cells = {
            count: 0,
            lookupCellFromVertex: new Int16Array(numSamples),
            lookupVertexFromCell: new Int16Array(numSamples),
            connections: new Int8Array(numSamples)
        }
    }
    else
        cells.count = 0;
}


function GetCellCornerPosition(cornerNum: number, cellX: number, cellY: number, cellZ: number, cellPosition: Vector3) {
    cellPosition.set(
        cellX + CUBE_CORNER_OFFSETS[cornerNum].x, 
        cellY + CUBE_CORNER_OFFSETS[cornerNum].y, 
        cellZ + CUBE_CORNER_OFFSETS[cornerNum].z);
}   

function GetOuterCell(cellX: number, cellY: number, cellZ: number, cellPosition: Vector3) {
    cellPosition.set(
        (cellX - cellX % maxScale),
        (cellY - cellY % maxScale),
        (cellZ - cellZ % maxScale));
}  

function GetOuterDist(
    offsetX: number,offsetY: number, offsetZ: number,
    cellX: number, cellY: number, cellZ: number) {
    const x = (cellX - cellX % maxScale) + (offsetX * maxScale);
    const y = (cellY - cellY % maxScale) + (offsetY * maxScale);
    const z = (cellZ - cellZ % maxScale) + (offsetZ * maxScale);
    const cellIndex = chunk.cellIndex(x,y,z);
    return fieldSamples[cellIndex];
}   

export {ExtractSurface, OuterCornerWeight}