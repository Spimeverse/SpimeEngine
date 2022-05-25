// adapted from a Rust implementation here 
// https://github.com/bonsairobo/fast-surface-nets-rs/blob/main/src/lib.rs


import { SignedDistanceField, EMPTY_FIELD } from "../signedDistanceFields";
import { Chunk,XYZ,BORDERS } from ".";
import { Vector3 } from "@babylonjs/core/Maths";

const voxelCenter = new Vector3();
const samplePoint = new Vector3();
const voxelPosition = new Vector3();
const voxelOffset = new Vector3();
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

// flags describing how each voxel needs to be connected to it's neighbour
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
// i.e c are the cube voxel corners and v are the vertices in each voxel
// c1 is the corner to generate a face around. 
// each voxel will generate a face which is offset but will meet up with the other faces
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
// only create faces on edges connecting to the voxel to the left (-x), below (-y) or Outwards (-z)
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


interface Voxels {
    vertexCount: number;
    numEdgesVoxels: number;
    edgeVoxels: Uint16Array;
    lookupVoxelFromVertex: Uint16Array;
    lookupVertexFromVoxel: Uint16Array;
    connections: Int8Array;
 }

let verticies: number[];
let faces: number[];
let chunk: Chunk;
let field: SignedDistanceField;
let maxSamples = 0;
let fieldSamples: Float32Array;
let borderSeams = 0;
let borderScale = 1;
const maxVoxels = 0;
const voxelRange = new Vector3();

let positiveSamples = false;
let negativeSamples = false;
let voxels: Voxels;

function ExtractSurface (_chunk: Chunk,
    _field: SignedDistanceField,
    _verticies: number[], _faces: number[]): boolean 
{

    chunk = _chunk;
    field = _field;
    SetupVoxels(chunk.numSamples);
    verticies = _verticies;
    faces = _faces;

    borderSeams = chunk.borderSeams;
    borderScale = chunk.borderScale;
    voxelRange.copyFrom(chunk.voxelRange);

    if (chunk.numSamples > maxSamples) {
        fieldSamples = new Float32Array(chunk.numSamples);
        maxSamples = chunk.numSamples;
    }

    verticies.length = 0;
    faces.length = 0;

    if (SampleChunkField(chunk)) {
        CheckAllVoxels(chunk.voxelRange);
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
    voxelPosition.set(
        origin.x + worldSize.x / 2, 
        origin.y + worldSize.y / 2,
        origin.z + worldSize.z / 2);
    const centerDist = field.sample(voxelPosition);
    // the maximum distance a field can be for the voxel center
    // and still intersect is half the voxel size * sqrt3
    // because the hypotenuse is sqrt(x*x+y*y+z*z)
    // we can work this for x=y=z=1 ie sqrt(3)
    // then just do halfVoxel*sqrt(3)
    if (Math.abs(centerDist) > halfSize * sqrt3)
        return false; // the surface is further away than the voxel size, quit
    return true; 
}

const worldPosition = new Vector3();

function SampleAllPoints(chunk: Chunk) {
    const {voxelRange} = chunk;
    for (let voxX = 0; voxX <= voxelRange.x; voxX++) {
        for (let voxY = 0; voxY <= voxelRange.y; voxY++) {
            for (let voxZ = 0; voxZ <= voxelRange.z; voxZ++) {
                voxelPosition.set(voxX, voxY, voxZ);
                chunk.voxelSpaceToWorldSpace(voxelPosition, worldPosition);
                const surfaceDist = field.sample(worldPosition);
                if (surfaceDist >= 0)
                    positiveSamples = true;
                else
                    negativeSamples = true;
                const voxelIndex = chunk.voxelIndex(voxX, voxY, voxZ);
                fieldSamples[voxelIndex] = surfaceDist;       
            }
        }
    }
}

function CheckAllVoxels(voxelRange: XYZ) {
    for (let voxX = 0; voxX <= voxelRange.x; voxX ++) {
        for (let voxY = 0; voxY <= voxelRange.y; voxY ++) {
            for (let voxZ = 0; voxZ <= voxelRange.z; voxZ ++) {
                CheckVoxelIntersection(voxX, voxY, voxZ);
            }
        }
    }
}

function CheckVoxelIntersection (voxX: number, voxY: number, voxZ: number): boolean {
    const voxIndex = chunk.voxelIndex(voxX, voxY, voxZ);
    let negPoints = 0;

    let edgeMask = 0;
    if (borderSeams == 0 || !BorderTransition(voxX, voxY, voxZ))
    {
        for (let cornerNum = 0; cornerNum < 8; cornerNum++) {
            GetVoxelCornerPosition(cornerNum, voxX, voxY, voxZ, voxelPosition);
            const cornerIndex = chunk.voxelIndex(voxelPosition.x, voxelPosition.y, voxelPosition.z);
            cornerDist[cornerNum] = fieldSamples[cornerIndex];
            if (cornerDist[cornerNum] < 0)
                negPoints++;
        }

        if (negPoints == 0 || negPoints == 8)
            return false;

        edgeMask = CalcWorldVertex(edgeMask, voxX, voxY, voxZ, voxIndex,1);
        if (AppendVertex(voxIndex, vertexPoint))
            voxels.connections[voxIndex] = edgeMask;
    }
    else
    {
        // We are rendering larger voxels on the seams
        // check if the voxel we are processing is the first root voxel of the larger voxel
        const outerX = voxX - voxX % borderScale;
        const outerY = voxY - voxY % borderScale;
        const outerZ = voxZ - voxZ % borderScale;
        if (outerX + borderScale >= voxelRange.x - 1 ||
            outerY + borderScale >= voxelRange.y - 1 ||
            outerZ + borderScale >= voxelRange.z - 1)
            return false;
        const rootVoxIndex = chunk.voxelIndex(
            outerX, 
            outerY, 
            outerZ);

        // if it is the root voxel calc and add the vertex for the whole larger seam voxel...
        if (rootVoxIndex == voxIndex)
        {
            for (let cornerNum = 0; cornerNum < 8; cornerNum++) {
                GetOuterVoxelCornerPosition(cornerNum,borderScale, outerX, outerY, outerZ, voxelPosition);
                const cornerIndex = chunk.voxelIndex(voxelPosition.x, voxelPosition.y, voxelPosition.z);
                cornerDist[cornerNum] = fieldSamples[cornerIndex];
                if (cornerDist[cornerNum] < 0)
                    negPoints++;
            }

            if (negPoints == 0 || negPoints == 8)
                return false;

            edgeMask = CalcWorldVertex(edgeMask, outerX, outerY, outerZ, voxIndex,borderScale);
            if (AppendVertex(voxIndex, vertexPoint))
                voxels.connections[voxIndex] = edgeMask;
        }
        else {
            // if it's not the root voxel just point to the vertex from the root voxel previously created
            voxels.lookupVertexFromVoxel[voxIndex] = voxels.lookupVertexFromVoxel[rootVoxIndex];
            voxels.connections[voxIndex] = voxels.connections[rootVoxIndex];

            voxels.edgeVoxels[voxels.numEdgesVoxels] = voxIndex;
            voxels.numEdgesVoxels++;
        }
    }



    return true;
}

function BorderTransition(voxX: number, voxY: number, voxZ: number) {
    return (borderSeams && voxX >= 4);
    if (borderSeams & BORDERS.xMin && voxX < borderScale)
        return true;
    if (borderSeams & BORDERS.xMax && voxelRange.x - voxX <= borderScale)
        return true;
    if (borderSeams & BORDERS.yMin && voxY < borderScale)
        return true;
    if (borderSeams & BORDERS.yMax && voxelRange.y - voxY < borderScale)
        return true;
    if (borderSeams & BORDERS.zMin && voxZ < borderScale)
        return true;
    if (borderSeams & BORDERS.zMax && voxelRange.z - voxZ < borderScale)
        return true;
    return false;
}

function CalcWorldVertex(edgeMask: number, voxX: number, voxY: number, voxZ: number, voxelIndex: number,scale: number) {
    edgeMask = CalcVoxelVertex(cornerDist, voxelCenter);
    // todo account for this
    voxelCenter.set(0.5,0.5,0.5);
    voxelCenter.scaleInPlace(chunk.voxelSize * scale);
    voxelOffset.set(voxX,voxY,voxZ);
    chunk.voxelSpaceToWorldSpace(voxelOffset, samplePoint);
    vertexPoint.set(
        voxelCenter.x + samplePoint.x,
        voxelCenter.y + samplePoint.y,
        voxelCenter.z + samplePoint.z);

    return edgeMask;
}

function AppendVertex(voxelIndex: number,point: Vector3) {
    const dist = field.sample(point);
    const offset = borderScale / 10000; // h from formula
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

    voxels.lookupVertexFromVoxel[voxelIndex] = voxels.vertexCount;
    // we'll need to find neighboring voxels of this point to connect them up
    // so record the voxel index that the point was created for
    voxels.lookupVoxelFromVertex[voxels.vertexCount] = voxelIndex;
    voxels.vertexCount++;

    voxels.edgeVoxels[voxels.numEdgesVoxels] = voxelIndex;
    voxels.numEdgesVoxels++;
    return true;
}

function ExtractAllFaces() {

    for (let voxEdgeNum = 0; voxEdgeNum < voxels.numEdgesVoxels; voxEdgeNum++)
    {

        // each active voxel contains one vertex
        // calculate vertex for this voxel
        const voxelIndex = voxels.edgeVoxels[voxEdgeNum];
        chunk.voxelIndexToVoxelPosition(voxelIndex,voxelPosition);

        ExtractVoxel(voxels.connections[voxelIndex]);
    }
}

function ExtractVoxel(connectEdges: number) {
    // if (voxelPosition.z >= 2)
    // continue;
    // if (voxelPosition.x >= 2)
    // continue;
    if (voxelPosition.x == 0)
        connectEdges = 0; // RestrictFacesTo(connectEdges, YZ_FACE_CLOCKWISE, YZ_FACE_ANTICLOCK);
    if (voxelPosition.y == 0)
        connectEdges = 0; //RestrictFacesTo(connectEdges, XZ_FACE_CLOCKWISE, XZ_FACE_ANTICLOCK);
    if (voxelPosition.z == 0)
        connectEdges = 0;//RestrictFacesTo(connectEdges, XY_FACE_CLOCKWISE, XY_FACE_ANTICLOCK);

    if (voxelPosition.x >= chunk.voxelRange.x)
        connectEdges = 0;
    if (voxelPosition.y >= chunk.voxelRange.y)
        connectEdges = 0;
    if (voxelPosition.z >= chunk.voxelRange.z)
        connectEdges = 0;

    if (connectEdges & XZ_FACE_CLOCKWISE) {
        ExtractFaces(voxelPosition, [
            [0, 0, 0], [0, 0, -1], [-1, 0, -1],
            [-1, 0, -1], [-1, 0, 0], [0, 0, 0]
        ]);
    }
    if (connectEdges & XZ_FACE_ANTICLOCK) {
        ExtractFaces(voxelPosition, [
            [0, 0, 0], [-1, 0, 0], [-1, 0, -1],
            [-1, 0, -1], [0, 0, -1], [0, 0, 0]
        ]);
    }

    if (connectEdges & XY_FACE_CLOCKWISE) {
        ExtractFaces(voxelPosition, [
            [0, 0, 0], [-1, 0, 0], [-1, -1, 0],
            [-1, -1, 0], [0, -1, 0], [0, 0, 0]
        ]);
    }
    if (connectEdges & XY_FACE_ANTICLOCK) {
        ExtractFaces(voxelPosition, [
            [0, 0, 0], [0, -1, 0], [-1, -1, 0],
            [-1, -1, 0], [-1, 0, 0], [0, 0, 0]
        ]);
    }

    if (connectEdges & YZ_FACE_CLOCKWISE) {
        ExtractFaces(voxelPosition, [
            [0, 0, 0], [0, -1, 0], [0, -1, -1],
            [0, -1, -1], [0, 0, -1], [0, 0, 0]
        ]);
    }
    if (connectEdges & YZ_FACE_ANTICLOCK) {
        ExtractFaces(voxelPosition, [
            [0, 0, 0], [0, 0, -1], [0, -1, -1],
            [0, -1, -1], [0, -1, 0], [0, 0, 0]
        ]);
    }
}


function CalcVoxelVertex(cornerDist: Float32Array,voxelCenter: Vector3): number {
    voxelCenter.set(0,0,0);
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
            voxelCenter.x += (corner1.x * distDiff) + (corner0.x * inverseDiff);
            voxelCenter.y += (corner1.y * distDiff) + (corner0.y * inverseDiff);
            voxelCenter.z += (corner1.z * distDiff) + (corner0.z * inverseDiff);
        }
    }
    voxelCenter.x /= edgeCount;
    voxelCenter.y /= edgeCount;
    voxelCenter.z /= edgeCount;

    return connectEdges;
}

function RestrictFacesTo(connectedEdges: number, face1: number, face2: number): number {
    return connectedEdges & (face1 | face2 | CONNECTED_CELL);
}


const triVert = new Uint16Array(3);

function ExtractFaces(voxelPosition: Vector3,offsets: number[][]) {
    //console.log('start vox',voxelPosition.x,voxelPosition.y,voxelPosition.z);
    for (let offsetNum = 0; offsetNum < offsets.length; offsetNum += 3) {
        let overlap = false;
        for (let i = 0; i < 3; i++) {
            const x = voxelPosition.x + offsets[offsetNum + i][0];
            const y = voxelPosition.y + offsets[offsetNum + i][1];
            const z = voxelPosition.z + offsets[offsetNum + i][2];
            const index = chunk.voxelIndex(x,y,z);
            triVert[i] = voxels.lookupVertexFromVoxel[index];
            const vertIndex = triVert[i] * 3;
            const vx = verticies[vertIndex];
            const vy = verticies[vertIndex + 1];
            const vz = verticies[vertIndex + 2];
            //console.log('voxel',x,y,z,'vindex',vertIndex,'pos',vx,vy,vz);
            if (vx < chunk.origin.x)
                overlap = true;
        }
        // voxels for seams can emit triangles that reuse a vertex
        // only add triangles with 3 unique vertices
        if (!overlap && triVert[0] != triVert[1] && triVert[1] != triVert[2] && triVert[0] != triVert[2])
            faces.push(triVert[0],triVert[1],triVert[2]);
    }
   
}


function SetupVoxels(numSamples: number) {
    if (numSamples > maxVoxels) {
        voxels = {
            vertexCount: 0,
            numEdgesVoxels: 0,
            lookupVoxelFromVertex: new Uint16Array(numSamples),
            lookupVertexFromVoxel: new Uint16Array(numSamples),
            edgeVoxels: new Uint16Array(numSamples),
            connections: new Int8Array(numSamples)
        }
    }
    else
        voxels.vertexCount = 0;
}


function GetVoxelCornerPosition(cornerNum: number, voxX: number, voxY: number, voxZ: number, voxelPosition: Vector3) {
    voxelPosition.set(
        voxX + CUBE_CORNER_OFFSETS[cornerNum].x, 
        voxY + CUBE_CORNER_OFFSETS[cornerNum].y, 
        voxZ + CUBE_CORNER_OFFSETS[cornerNum].z);
}   

function GetOuterVoxelCornerPosition(cornerNum: number,scale: number, voxX: number, voxY: number, voxZ: number, voxelPosition: Vector3) {
    voxelPosition.set(
        voxX + CUBE_CORNER_OFFSETS[cornerNum].x * scale, 
        voxY + CUBE_CORNER_OFFSETS[cornerNum].y * scale, 
        voxZ + CUBE_CORNER_OFFSETS[cornerNum].z * scale);
}   
 

export {ExtractSurface, 
    CalcVoxelVertex,
    GetVoxelCornerPosition,
    GetOuterVoxelCornerPosition
    ,CONNECTED_CELL,
    XZ_FACE_CLOCKWISE,
    XY_FACE_CLOCKWISE,
    YZ_FACE_CLOCKWISE,
    XZ_FACE_ANTICLOCK, 
    XY_FACE_ANTICLOCK,
    YZ_FACE_ANTICLOCK}

