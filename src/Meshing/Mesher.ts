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
const OVERLAPPING_SEAM  = 0b0010000000; // 128
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
    [0, 1, YZ_FACE_CLOCKWISE, YZ_FACE_ANTICLOCK], // edge 0 
    [0, 2, XZ_FACE_CLOCKWISE, XZ_FACE_ANTICLOCK], // edge 1 
    [0, 4, XY_FACE_CLOCKWISE, XY_FACE_ANTICLOCK], // edge 2 
    [1, 3, 0, 0], // edge 3 
    [1, 5, 0, 0], // edge 4 
    [2, 3, 0, 0], // edge 5 
    [2, 6, 0, 0], // edge 6
    [3, 7, 0, 0], // edge 7 
    [4, 5, 0, 0], // edge 8 
    [4, 6, 0, 0], // edge 9 
    [5, 7, 0, 0], // edge 10 
    [6, 7, 0, 0], // edge 11   
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
    numSurfaceVoxels: number;
    surfaceVoxels: Uint16Array;
    lookupVoxelFromVertex: Uint16Array;
    lookupVertexFromVoxel: Uint16Array;
    connections: Int8Array;
 }

let verticies: number[];
let faces: number[];
let chunk: Chunk;
let field: SignedDistanceField;
let numSamples = 0;
let maxSamples = 0;
let borderSeams = 0;
let borderScale = 1;
let maxVoxels = 0;
let fieldSamples: Float32Array;
const voxelRange = new Vector3();
const origin = new Vector3();
const worldSize = new Vector3();

let xSampleStart = 0;
let xSampleEnd = 0; 
let ySampleStart = 0; 
let ySampleEnd = 0; 
let zSampleStart = 0; 
let zSampleEnd = 0; 

let voxels: Voxels;
let voxelSize = 0;
const sampledPoints: Vector3[] = [];
const sampledLabels: string[] = [];

let totalTime = 0;

let positiveSamples = false;
let negativeSamples = false;

function ExtractSurface (_chunk: Chunk,
    _field: SignedDistanceField,
    _verticies: number[],
    _faces: number[]): boolean 
{
    chunk = _chunk;
    field = _field;
    numSamples = chunk.getNumSamples();

    if (numSamples > maxSamples) {
        fieldSamples = new Float32Array(numSamples);
        maxSamples = numSamples;
    }

    SetupVoxels(numSamples);
    verticies = _verticies;
    faces = _faces;

    borderSeams = chunk.getBorderSeams();
    borderScale = chunk.getBorderScale();
    chunk.copyVoxelRangeTo(voxelRange);
    chunk.copyPositionTo(origin);

    chunk.copyWorldSizeTo(worldSize);
    voxelSize = chunk.getVoxelSize();

    verticies.length = 0;
    faces.length = 0;

    if (SkipChunk())
        return false;

    SetupSampleRange();

    // time this section of code
    const start = performance.now();
    if (SampleChunkField()) {
        CheckAllVoxels(voxelRange);
        ExtractAllFaces();
    }
    const end = performance.now();
    const time = end - start;
    totalTime += time;

    return faces.length > 0;
}

function FieldIntersectsChunk(): boolean{
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

function SampleChunkField (): boolean {
    if (!FieldIntersectsChunk())
        return false;
    positiveSamples = false;
    negativeSamples = false;

    SampleAllPoints(chunk);
    return positiveSamples && negativeSamples;
}

function SetupSampleRange() {
    const seamOverlap = 2;
    xSampleStart = (borderSeams & BORDERS.xMin) ? -seamOverlap : 0;
    xSampleEnd = (borderSeams & BORDERS.xMax) ? voxelRange.x + seamOverlap : voxelRange.x;
    ySampleStart = (borderSeams & BORDERS.yMin) ? -seamOverlap : 0;
    ySampleEnd = (borderSeams & BORDERS.yMax) ? voxelRange.y + seamOverlap : voxelRange.y;
    zSampleStart = (borderSeams & BORDERS.zMin) ? -seamOverlap : 0;
    zSampleEnd = (borderSeams & BORDERS.zMax) ? voxelRange.z + seamOverlap : voxelRange.z;
}

function SampleAllPoints(chunk: Chunk) {
    // note examine voxels <= voxelRange because we need a sample beyond the edge
    for (let voxX = xSampleStart; voxX <= xSampleEnd; voxX++) {
        for (let voxY = ySampleStart; voxY <= ySampleEnd; voxY++) {
            for (let voxZ = zSampleStart; voxZ <= zSampleEnd; voxZ++) {
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
    // note examine voxels < voxelRange
    for (let voxX = xSampleStart; voxX < xSampleEnd; voxX++) {
        for (let voxY = ySampleStart; voxY < ySampleEnd; voxY++) {
            for (let voxZ = zSampleStart; voxZ < zSampleEnd; voxZ++) {
                CheckVoxelIntersection(voxX, voxY, voxZ);
            }
        }
    }
}

function CheckVoxelIntersection(voxX: number, voxY: number, voxZ: number): boolean {
   
    const voxIndex = chunk.voxelIndex(voxX, voxY, voxZ);
    let interiorPoints = 0;

    let edgeMask = 0;

    voxelPosition.set(voxX, voxY, voxZ);
    chunk.voxelSpaceToWorldSpace(voxelPosition, worldPosition, 1);

    for (let cornerNum = 0; cornerNum < 8; cornerNum++) {
        const cornerIndex = chunk.voxelIndex(
            voxX + CUBE_CORNER_OFFSETS[cornerNum].x,
            voxY + CUBE_CORNER_OFFSETS[cornerNum].y,
            voxZ + CUBE_CORNER_OFFSETS[cornerNum].z);
        cornerDist[cornerNum] = fieldSamples[cornerIndex];

        if (cornerDist[cornerNum] < 0)
            interiorPoints++;
    }
    
    if (interiorPoints == 0 || interiorPoints == 8) {
        voxels.connections[voxIndex] = 0;
        return false;
    }
        
    edgeMask = CalcWorldVertex(edgeMask, voxX, voxY, voxZ, voxIndex, 1);
    
    AddDebugMarker(voxX, voxY, voxZ, edgeMask);
    
    AppendVertex(voxIndex, vertexPoint);

    voxels.connections[voxIndex] = edgeMask;

    return true;
}

function AddDebugMarker(voxX: number, voxY: number, voxZ: number, edgeMask: number) {
    if (DebugVox(voxX, voxY, voxZ)) {
        let edges = "";
        if (edgeMask & XZ_FACE_CLOCKWISE) {
            edges += "XZ_CLOCKWISE ";
        }
        if (edgeMask & XZ_FACE_ANTICLOCK) {
            edges += "XZ_ANTICLOCK ";
        }

        if (edgeMask & XY_FACE_CLOCKWISE) {
            edges += "XY_CLOCKWISE ";
        }
        if (edgeMask & XY_FACE_ANTICLOCK) {
            edges += "XY_ANTICLOCK ";
        }

        if (edgeMask & YZ_FACE_CLOCKWISE) {
            edges += "YZ_CLOCKWISE ";
        }
        if (edgeMask & YZ_FACE_ANTICLOCK) {
            edges += "YZ_ANTICLOCK ";
        }
        if (edges == "")
            edges = "???";

        sampledPoints.push(vertexPoint.clone().addInPlaceFromFloats(0, 0.06, 0));
        sampledLabels.push(`seam center ${voxX} ${voxY} ${voxZ} seam ${edges}`);
    }
}

function CalcWorldVertex(edgeMask: number, voxX: number, voxY: number, voxZ: number, voxelIndex: number,scale: number) {
    edgeMask = CalcVoxelVertex(cornerDist, voxelCenter);

    voxelCenter.scaleInPlace(voxelSize * scale);
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

    voxels.surfaceVoxels[voxels.numSurfaceVoxels] = voxelIndex;
    voxels.numSurfaceVoxels++;
    return true;
}

function ExtractAllFaces() {

    for (let i = 0; i < voxels.numSurfaceVoxels; i++)
    {
        // each active voxel contains one vertex
        // calculate vertex for this voxel
        const voxelIndex = voxels.surfaceVoxels[i];
        chunk.voxelIndexToVoxelPosition(voxelIndex,voxelPosition);

        ExtractVoxel(voxels.connections[voxelIndex]);
    }
}

function ExtractVoxel(connectEdges: number) {
    // skip voxels extending beyond the chunk on the min edge
    // the preceding chunk will handle this shared space
    if (voxelPosition.x <= 0)
        connectEdges = 0; 
    if (voxelPosition.y <= 0)
        connectEdges = 0; 
    if (voxelPosition.z <= 0)
        connectEdges = 0;

    const isSeamFace = (connectEdges & OVERLAPPING_SEAM) != 0;

    if (connectEdges & XZ_FACE_CLOCKWISE) {
        ExtractFaces(isSeamFace,voxelPosition, [
            [0, 0, 0], [0, 0, -1], [-1, 0, -1],
            [-1, 0, -1], [-1, 0, 0], [0, 0, 0]
        ]);
    }
    if (connectEdges & XZ_FACE_ANTICLOCK) {
        ExtractFaces(isSeamFace,voxelPosition, [
            [0, 0, 0], [-1, 0, 0], [-1, 0, -1],
            [-1, 0, -1], [0, 0, -1], [0, 0, 0]
        ]);
    }

    if (connectEdges & XY_FACE_CLOCKWISE) {
        ExtractFaces(isSeamFace,voxelPosition, [
            [0, 0, 0], [-1, 0, 0], [-1, -1, 0],
            [-1, -1, 0], [0, -1, 0], [0, 0, 0]
        ]);
    }
    if (connectEdges & XY_FACE_ANTICLOCK) {
        ExtractFaces(isSeamFace,voxelPosition, [
            [0, 0, 0], [0, -1, 0], [-1, -1, 0],
            [-1, -1, 0], [-1, 0, 0], [0, 0, 0]
        ]);
    }

    if (connectEdges & YZ_FACE_CLOCKWISE) {
        ExtractFaces(isSeamFace,voxelPosition, [
            [0, 0, 0], [0, -1, 0], [0, -1, -1],
            [0, -1, -1], [0, 0, -1], [0, 0, 0]
        ]);
    }
    if (connectEdges & YZ_FACE_ANTICLOCK) {
        ExtractFaces(isSeamFace,voxelPosition, [
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

const triVert = new Uint16Array(3);
const faceVertices: Vector3[] = [new Vector3(),new Vector3(),new Vector3()]; 
const minEdgeLength = 0.000001;

function ExtractFaces(isSeamFace: boolean,voxelPosition: Vector3,offsets: number[][]) {

    for (let offsetNum = 0; offsetNum < offsets.length; offsetNum += 3) {
        let skipFace = false;
        for (let i = 0; i < 3; i++) {
            const x = voxelPosition.x + offsets[offsetNum + i][0];
            const y = voxelPosition.y + offsets[offsetNum + i][1];
            const z = voxelPosition.z + offsets[offsetNum + i][2];
            const index = chunk.voxelIndex(x,y,z);
            const edgeMask = voxels.connections[index];
            if (edgeMask == 0 )
                return;
            triVert[i] = voxels.lookupVertexFromVoxel[index];
            const vertIndex = triVert[i] * 3;
            const worldx = verticies[vertIndex];
            const worldy = verticies[vertIndex + 1];
            const worldz = verticies[vertIndex + 2];

            faceVertices[i].set(worldx,worldy,worldz);
        }
        const edgeLength1 = faceVertices[0].subtract(faceVertices[1]).lengthSquared();
        const edgeLength2 = faceVertices[1].subtract(faceVertices[2]).lengthSquared();
        const edgeLength3 = faceVertices[2].subtract(faceVertices[0]).lengthSquared();
        if (edgeLength1 < minEdgeLength || edgeLength2 < minEdgeLength || edgeLength3 < minEdgeLength) {
            skipFace = true;
        }
        // voxels for seams can emit triangles that reuse a vertex
        // only add triangles with 3 unique vertices
        if (!skipFace) {
            faces.push(triVert[0],triVert[1],triVert[2]);
        }
    }
}

function SetupVoxels(numSamples: number) {
    if (numSamples > maxVoxels) {
        voxels = {
            vertexCount: 0,
            numSurfaceVoxels: 0,
            lookupVoxelFromVertex: new Uint16Array(numSamples),
            lookupVertexFromVoxel: new Uint16Array(numSamples),
            surfaceVoxels: new Uint16Array(numSamples),
            connections: new Int8Array(numSamples)
        }
        maxVoxels = numSamples;
    }
    else {
        voxels.vertexCount = 0;
        voxels.numSurfaceVoxels = 0;
    }
}

// selectively skip chunks for debugging
function SkipChunk(): boolean {
    return false;

    const chunkID = chunk.toString();
     const targetChunks = ["Origin: 16,8,24 Size: 8,8,8 VoxelSize: 0.5"];
    // const targetChunks = [
    //     "Origin: -4,6,6 Size: 2,2,2 VoxelSize: 0.125",
    //     "Origin: -2,6,6 Size: 2,2,2 VoxelSize: 0.125",
    //     "Origin: -2,6,4 Size: 2,2,2 VoxelSize: 0.125",
    //     "Origin: -4,6,4 Size: 2,2,2 VoxelSize: 0.125",
    //     "Origin: -6,6,4 Size: 2,2,2 VoxelSize: 0.125",
    //     "Origin: -6,6,6 Size: 2,2,2 VoxelSize: 0.125",
    //     "Origin: -8,4,8 Size: 4,4,4 VoxelSize: 0.25",
    //     "Origin: -4,4,8 Size: 4,4,4 VoxelSize: 0.25"
    // ];

    if (targetChunks.indexOf(chunkID) == -1)
        return true;
    return false;
}

// focus on a subset of voxels for debugging
function DebugVox(voxX: number, voxY: number, voxZ: number) {
    return false;
    if (voxX < 0)
        return false;
    if (voxX > 1)
        return false;
    if (voxY < 6)
        return false;
    if (voxY > 8)
        return false;
    if (voxZ < 10)
        return false;
    if (voxZ > 12)
        return false;
    return true;
}

export {ExtractSurface, 
    CalcVoxelVertex,
    CONNECTED_CELL,
    XZ_FACE_CLOCKWISE,
    XY_FACE_CLOCKWISE,
    YZ_FACE_CLOCKWISE,
    XZ_FACE_ANTICLOCK, 
    XY_FACE_ANTICLOCK,
    YZ_FACE_ANTICLOCK,
    sampledPoints,sampledLabels,totalTime}

