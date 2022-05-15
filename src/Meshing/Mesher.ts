// adapted from a Rust implementation here 
// https://github.com/bonsairobo/fast-surface-nets-rs/blob/main/src/lib.rs


import { SignedDistanceField, EMPTY_FIELD } from "../signedDistanceFields";
import { Chunk,XYZ } from ".";
import { Vector3 } from "@babylonjs/core/Maths";

const cellCenter = new Vector3();
const samplePoint = new Vector3();
const cellPosition = new Vector3();
const cellOffset = new Vector3();
const vertexPoint = new Vector3();
const normal = new Vector3();
const pointOffset = new Vector3();
const cornerDist: Float32Array = new Float32Array(8);
const sqrt3 = Math.sqrt(3);

// Corner numbers
//
//     6 -----7
//    /|     /|
//   2------3 |
//   | 4----|-5
//   |/     |/
//   0------1
//
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
// 
// Edge numbers
//      +---11---+
//     /|       /|
//    /6|9     /7|10
//   +---5----+  |
//   |  !---8-|--!
//   1 /      3  /
//   |/2      | /4
//   +----0---!
//
const CUBE_EDGES = [
    [0, 1, YZ_FACE_CLOCKWISE, YZ_FACE_ANTICLOCK], // 0
    [0, 2, XZ_FACE_CLOCKWISE, XZ_FACE_ANTICLOCK], // 1
    [0, 4, XY_FACE_CLOCKWISE, XY_FACE_ANTICLOCK], // 2
    [1, 3, 0, 0], // 3
    [1, 5, 0, 0], // 4
    [2, 3, 0, 0], // 5
    [2, 6, 0, 0], // 6 
    [3, 7, 0, 0], // 7
    [4, 5, 0, 0], // 8
    [4, 6, 0, 0], // 9
    [5, 7, 0, 0], // 10
    [6, 7, 0, 0], // 11 
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
    vertexCount: number;
    lookupCellFromVertex: Uint16Array;
    lookupVertexFromCell: Uint16Array;
    connections: Int8Array;
 }

let verticies: number[];
let faces: number[];
let chunk: Chunk;
let field: SignedDistanceField;
let maxSamples = 0;
let fieldSamples: Float32Array;
let scale: number[];
let isMixedScale = false;
let maxScale = 1;
const maxCells = 0;

let positiveSamples = false;
let negativeSamples = false;
let cells: Cells;

function ExtractSurface (_chunk: Chunk,
    _field: SignedDistanceField,
    _scale: number[],
    _verticies: number[], _faces: number[]): boolean 
{

    chunk = _chunk;
    field = _field;
    SetupCells(chunk.numSamples);
    verticies = _verticies;
    faces = _faces;

    scale = _scale;
    maxScale = Math.max(...scale);
    isMixedScale = maxScale > 1;

    if (chunk.numSamples > maxSamples) {
        fieldSamples = new Float32Array(chunk.numSamples);
        maxSamples = chunk.numSamples;
    }


    verticies.length = 0;
    faces.length = 0;
    if (SampleChunkField(chunk)) {
        CheckAllCells(chunk.cellRange);
        ExtractAllFaces();
    }
    return verticies.length > 0;
}

function SampleChunkField (chunk: Chunk): boolean {
    if (!FieldIntersectsChunk(chunk))
        return false;
    positiveSamples = false;
    negativeSamples = false;

    SampleAllPoints(chunk);
    return positiveSamples && negativeSamples;
}

function FieldIntersectsChunk(chunk: Chunk): boolean{
    const {worldSize, origin} = chunk;
    const halfSize = Math.max(worldSize.x / 2,worldSize.y / 2,worldSize.z / 2);
    cellPosition.set(
        origin.x + worldSize.x / 2, 
        origin.y + worldSize.y / 2,
        origin.z + worldSize.z / 2);
    const centerDist = field.sample(cellPosition);
    // the maximum distance a field can be for the cell center
    // and still intersect is half the cell size * sqrt3
    // because the hypotenuse is sqrt(x*x+y*y+z*z)
    // we can work this for x=y=z=1 ie sqrt(3)
    // then just do halfCell*sqrt(3)
    if (Math.abs(centerDist) > halfSize * sqrt3)
        return false; // the surface is further away than the cell size, quit
    return true; 
}

const worldPosition = new Vector3();

function SampleAllPoints(chunk: Chunk) {
    const {cellRange} = chunk;
    for (let cellX = 0; cellX <= cellRange.x; cellX++) {
        for (let cellY = 0; cellY <= cellRange.y; cellY++) {
            for (let cellZ = 0; cellZ <= cellRange.z; cellZ++) {
                cellPosition.set(cellX, cellY, cellZ);
                chunk.cellSpaceToWorldSpace(cellPosition, worldPosition);
                const surfaceDist = field.sample(worldPosition);
                if (surfaceDist >= 0)
                    positiveSamples = true;
                else
                    negativeSamples = true;
                const cellIndex = chunk.cellIndex(cellX, cellY, cellZ);
                fieldSamples![cellIndex] = surfaceDist;       
            }
        }
    }
}

function CheckAllCells(cellRange: XYZ) {
    for (let cellX = 0; cellX <= cellRange.x; cellX ++) {
        for (let cellY = 0; cellY <= cellRange.y; cellY ++) {
            for (let cellZ = 0; cellZ <= cellRange.z; cellZ ++) {
                CheckCellIntersection(cellX, cellY, cellZ);
            }
        }
    }
}

function CheckCellIntersection (cellX: number, cellY: number, cellZ: number): boolean {
    const cellIndex = chunk.cellIndex(cellX, cellY, cellZ);
    let negPoints = 0;

    let edgeMask = 0;
    if (maxScale == 1 || cellX >= maxScale) {
        for (let cornerNum = 0; cornerNum < 8; cornerNum++) {
            GetCellCornerPosition(cornerNum, cellX, cellY, cellZ, cellPosition);
            const cornerIndex = chunk.cellIndex(cellPosition.x, cellPosition.y, cellPosition.z);
            cornerDist[cornerNum] = fieldSamples[cornerIndex];
            if (cornerDist[cornerNum] < 0)
                negPoints++;
        }

        if (negPoints == 0 || negPoints == 8)
            return false;

        edgeMask = CalcWorldVertex(edgeMask, cellX, cellY, cellZ, cellIndex,1);
    }
    else
    {
        // We are rendering larger cells on the seams
        // check if the cell we are processing is the first root cell of the larger cell
        const rootCellIndex = chunk.cellIndex(
            cellX - cellX % maxScale, 
            cellY - cellY % maxScale, 
            cellZ - cellZ % maxScale);

        // if it is the root cell calc and add the vertex for the whole larger seam cell...
        if (rootCellIndex == cellIndex)
        {
            for (let cornerNum = 0; cornerNum < 8; cornerNum++) {
                GetOuterCellCornerPosition(cornerNum,maxScale, cellX, cellY, cellZ, cellPosition);
                const cornerIndex = chunk.cellIndex(cellPosition.x, cellPosition.y, cellPosition.z);
                cornerDist[cornerNum] = fieldSamples[cornerIndex];
                if (cornerDist[cornerNum] < 0)
                    negPoints++;
            }

            if (negPoints == 0 || negPoints == 8)
                return false;

            edgeMask = CalcWorldVertex(edgeMask, cellX, cellY, cellZ, cellIndex,maxScale);
        }
        else {
            // if it's not the root cell just point to the vertex from the root cell previously created
            cells.lookupVertexFromCell[cellIndex] = cells.lookupVertexFromCell[rootCellIndex];
        }
    }


    return true;
}

function CalcWorldVertex(edgeMask: number, cellX: number, cellY: number, cellZ: number, cellIndex: number,scale: number) {
    edgeMask = CalcCellVertex(cornerDist, cellCenter);
    //cellCenter.set(0.5,0.5,0.5);
    cellCenter.scaleInPlace(chunk.cellSize * scale);
    cellOffset.set(cellX - cellX % scale,
        cellY - cellY % scale,
        cellZ - cellZ % scale);
    chunk.cellSpaceToWorldSpace(cellOffset, samplePoint);
    vertexPoint.set(
        cellCenter.x + samplePoint.x,
        cellCenter.y + samplePoint.y,
        cellCenter.z + samplePoint.z);
    if (AppendVertex(cellIndex, vertexPoint))
        cells.connections[cells.vertexCount - 1] = edgeMask;
    return edgeMask;
}

function AppendVertex(cellIndex: number,point: Vector3) {
    const dist = field.sample(point);
    const offset = maxScale / 10000; // h from formula
    if (Math.abs(dist) > offset) {
        let offsetDist = 0;
        normal.set(0,0,0);

        // calculate normal using the Tetrahedron technique
        // https://iquilezles.org/articles/normalsSDF/#:~:text=following%20three%20evaluations%3A-,Tetrahedron%20technique,-There%27s%20a%20nice
        // Tetrahedron technique
        //     const float h = 0.0001; // replace by an appropriate value
        // const vec2 k = vec2(1,-1);
        // return normalize( k.xyy*f( p + k.xyy*h ) + 
        //                   k.yyx*f( p + k.yyx*h ) + 
        //                   k.yxy*f( p + k.yxy*h ) + 
        //                   k.xxx*f( p + k.xxx*h ) );

        // k.xyy*f( p + k.xyy*h ) +
        pointOffset.set(point.x + offset,point.y - offset,point.z - offset);
        offsetDist = field.sample(pointOffset);
        normal.addInPlaceFromFloats(offsetDist,-offsetDist,-offsetDist);

        // k.yyx*f( p + k.yyx*h ) + 
        pointOffset.set(point.x - offset,point.y - offset,point.z + offset);
        offsetDist = field.sample(pointOffset);
        normal.addInPlaceFromFloats(-offsetDist,-offsetDist,offsetDist);

        // k.yxy*f( p + k.yxy*h ) + 
        pointOffset.set(point.x - offset,point.y + offset,point.z - offset);
        offsetDist = field.sample(pointOffset);
        normal.addInPlaceFromFloats(-offsetDist,offsetDist,-offsetDist);
        
        // k.xxx*f( p + k.xxx*h )
        pointOffset.set(point.x + offset,point.y + offset,point.z + offset);
        offsetDist = field.sample(pointOffset);
        normal.addInPlaceFromFloats(offsetDist,offsetDist,offsetDist);

        normal.normalize();
        normal.scaleInPlace(-dist);

        point.addInPlace(normal);
    }
    
    verticies.push(point.x,point.y,point.z);

    cells.lookupVertexFromCell[cellIndex] = cells.vertexCount;
    // we'll need to find neighboring cells of this point to connect them up
    // so record the cell index that the point was created for
    cells.lookupCellFromVertex[cells.vertexCount] = cellIndex;
    cells.vertexCount++;
    return true;
}

function ExtractAllFaces() {

    for (let vertexNum = 0; vertexNum < cells.vertexCount; vertexNum++)
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
        connectEdges = 0; // RestrictFacesTo(connectEdges, YZ_FACE_CLOCKWISE, YZ_FACE_ANTICLOCK);
    if (cellPosition.y == 0)
        connectEdges = 0; //RestrictFacesTo(connectEdges, XZ_FACE_CLOCKWISE, XZ_FACE_ANTICLOCK);
    if (cellPosition.z == 0)
        connectEdges = 0;//RestrictFacesTo(connectEdges, XY_FACE_CLOCKWISE, XY_FACE_ANTICLOCK);

    if (cellPosition.x >= chunk.cellRange.x)
        connectEdges = 0;
    if (cellPosition.y >= chunk.cellRange.y)
        connectEdges = 0;
    if (cellPosition.z >= chunk.cellRange.z)
        connectEdges = 0;

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


function CalcCellVertex(cornerDist: Float32Array,cellCenter: Vector3): number {
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

    return connectEdges;
}

function RestrictFacesTo(connectedEdges: number, face1: number, face2: number): number {
    return connectedEdges & (face1 | face2 | CONNECTED_CELL);
}


const triVert = new Uint16Array(3);

function ExtractFaces(cellPosition: Vector3,offsets: number[][]) {
    for (let offsetNum = 0; offsetNum < offsets.length; offsetNum += 3) {
        let overlap = false;
        for (let i = 0; i < 3; i++) {
            const x = cellPosition.x + offsets[offsetNum + i][0];
            const y = cellPosition.y + offsets[offsetNum + i][1];
            const z = cellPosition.z + offsets[offsetNum + i][2];
            const index = chunk.cellIndex(x,y,z);
            triVert[i] = cells.lookupVertexFromCell[index];
            const vx = verticies[triVert[i] * 3];
            if (vx < chunk.origin.x)
                overlap = true;
        }
        // cells for seams can emit triangles that reuse a vertex
        // only add triangles with 3 unique vertices
        if (!overlap && triVert[0] != triVert[1] && triVert[1] != triVert[2] && triVert[0] != triVert[2])
            faces.push(triVert[0],triVert[1],triVert[2]);
    }
   
}


function SetupCells(numSamples: number) {
    if (numSamples > maxCells) {
        cells = {
            vertexCount: 0,
            lookupCellFromVertex: new Uint16Array(numSamples),
            lookupVertexFromCell: new Uint16Array(numSamples),
            connections: new Int8Array(numSamples)
        }
    }
    else
        cells.vertexCount = 0;
}


function GetCellCornerPosition(cornerNum: number, cellX: number, cellY: number, cellZ: number, cellPosition: Vector3) {
    cellPosition.set(
        cellX + CUBE_CORNER_OFFSETS[cornerNum].x, 
        cellY + CUBE_CORNER_OFFSETS[cornerNum].y, 
        cellZ + CUBE_CORNER_OFFSETS[cornerNum].z);
}   

function GetOuterCellCornerPosition(cornerNum: number,scale: number, cellX: number, cellY: number, cellZ: number, cellPosition: Vector3) {
    cellPosition.set(
        (cellX - cellX % scale) + CUBE_CORNER_OFFSETS[cornerNum].x * scale, 
        (cellY - cellY % scale) + CUBE_CORNER_OFFSETS[cornerNum].y * scale, 
        (cellZ - cellZ % scale) + CUBE_CORNER_OFFSETS[cornerNum].z * scale);
}   
 

export {ExtractSurface, 
    CalcCellVertex,
    GetCellCornerPosition,
    GetOuterCellCornerPosition
    ,CONNECTED_CELL,
    XZ_FACE_CLOCKWISE,
    XY_FACE_CLOCKWISE,
    YZ_FACE_CLOCKWISE,
    XZ_FACE_ANTICLOCK, 
    XY_FACE_ANTICLOCK,
    YZ_FACE_ANTICLOCK}