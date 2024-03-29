// originally adapted from a Rust implementation here 
// https://github.com/bonsairobo/fast-surface-nets-rs/blob/main/src/lib.rs


import { SignedDistanceField } from "../signedDistanceFields";
import { Chunk,BORDERS } from ".";
import { Vector3 } from "@babylonjs/core/Maths";
import { systemSettings } from "../SystemSettings";

const voxelCenter = new Vector3();
const samplePoint = new Vector3();
const worldPosition = new Vector3();
const voxelPosition = new Vector3();
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
const CONNECTED_CELL =    0b0000000000001; // 1
const XZ_FACE_CLOCKWISE = 0b0000000000010; // 2
const XY_FACE_CLOCKWISE = 0b0000000000100; // 4
const YZ_FACE_CLOCKWISE = 0b0000000001000; // 8
const XZ_FACE_ANTICLOCK = 0b0000000010000; // 16
const XY_FACE_ANTICLOCK = 0b0000000100000; // 32
const YZ_FACE_ANTICLOCK = 0b0000001000000; // 64
const X_PLUS_EDGE       = 0b0000010000000; // 128
const X_MINUS_EDGE      = 0b0000100000000; // 256
const Y_PLUS_EDGE       = 0b0001000000000; // 512
const Y_MINUS_EDGE      = 0b0010000000000; // 1024
const Z_PLUS_EDGE       = 0b0100000000000; // 2048
const Z_MINUS_EDGE      = 0b1000000000000; // 4096

// CUBE_EDGES defines the 12 edges of the cube, from the start point to the end point
// and also a flag to indicate if a face needs to be output.
// only output a face on when the edge meets the far corner of the cube
// i.e c are the cube voxel corners and v are the vertices in each voxel
// the c1 is the corner to generate a face around.
// each voxel will generate a vertex and faces connecting this cubes
// vertex to the vertex of the voxel to the left (-x), below (-y) or Outwards (-z)
//     
//     |   v--+--v
//     |   |  |  |
//     c --|- c1-|-
//     |   v--+--v
//     |      |
//     c ---- c ----
// 


// only create faces on edges connecting to the voxel to the left (-x), below (-y) or Outwards (-z)
// create a clockwise or anticlockwise face depending on whether the edge goes
// from outside to inside or inside to outside
//
// Corner numbers   // Edge numbers
//                  //      +---11---+
//     6 -----7     //     /|       /|
//    /|     /|     //    /6|9     /7|10
//   2------3 |     //   +----5---+  |
//   | 4----|-5     //   |  !---8-|--!
//   |/     |/      //   1 /      3  /
//   0------1       //   |/2      | /4
//                  //   +----0---!
//                  // 
type Edge = {
    startCorner: number;
    endCorner: number;
    faceNormal: number;
    faceReversed: number;
}

const CUBE_EDGES: Edge[] = [
    {
        startCorner: 0, endCorner: 1,
        faceNormal: YZ_FACE_CLOCKWISE | Z_MINUS_EDGE | Y_MINUS_EDGE,
        faceReversed: YZ_FACE_ANTICLOCK | Z_MINUS_EDGE | Y_MINUS_EDGE
    }, // edge 0
    {
        startCorner: 0, endCorner: 2,
        faceNormal: XZ_FACE_CLOCKWISE | X_MINUS_EDGE | Z_MINUS_EDGE,
        faceReversed: XZ_FACE_ANTICLOCK | X_MINUS_EDGE | Z_MINUS_EDGE
    }, // edge 1
    {
        startCorner: 0, endCorner: 4,
        faceNormal: XY_FACE_CLOCKWISE | X_MINUS_EDGE | Y_MINUS_EDGE,
        faceReversed: XY_FACE_ANTICLOCK | X_MINUS_EDGE | Y_MINUS_EDGE
    }, // edge 2
    {
        startCorner: 1, endCorner: 3,
        faceNormal: X_PLUS_EDGE | Z_MINUS_EDGE,
        faceReversed: X_PLUS_EDGE | Z_MINUS_EDGE
    }, // edge 3
    {   
        startCorner: 1, endCorner: 5,
        faceNormal: X_PLUS_EDGE | Y_MINUS_EDGE,
        faceReversed: X_PLUS_EDGE | Y_MINUS_EDGE
    }, // edge 4
    {
        startCorner: 2, endCorner: 3,
        faceNormal: Z_MINUS_EDGE | Y_PLUS_EDGE,
        faceReversed: Z_MINUS_EDGE | Y_PLUS_EDGE
    }, // edge 5
    {
        startCorner: 2, endCorner: 6,
        faceNormal: X_MINUS_EDGE | Y_PLUS_EDGE,
        faceReversed: X_MINUS_EDGE | Y_PLUS_EDGE
    }, // edge 6
    {
        startCorner: 3, endCorner: 7,
        faceNormal: X_PLUS_EDGE | Y_PLUS_EDGE,
        faceReversed: X_PLUS_EDGE | Y_PLUS_EDGE
    }, // edge 7
    {
        startCorner: 4, endCorner: 5,
        faceNormal: Z_PLUS_EDGE | Y_MINUS_EDGE,
        faceReversed: Z_PLUS_EDGE | Y_MINUS_EDGE
    }, // edge 8
    {
        startCorner: 4, endCorner: 6,
        faceNormal: X_MINUS_EDGE | Z_PLUS_EDGE,
        faceReversed: X_MINUS_EDGE | Z_PLUS_EDGE
    }, // edge 9
    {
        startCorner: 5, endCorner: 7,
        faceNormal: X_PLUS_EDGE | Z_PLUS_EDGE,
        faceReversed: X_PLUS_EDGE | Z_PLUS_EDGE
    }, // edge 10
    {
        startCorner: 6, endCorner: 7,
        faceNormal: Z_PLUS_EDGE | Y_PLUS_EDGE,
        faceReversed: Z_PLUS_EDGE | Y_PLUS_EDGE
    }, // edge 11
];
        
    
    

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
let distances: Float32Array;
let doneDistances: Int8Array;

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
const debugPoints: Vector3[] = [];
const debugLabels: string[] = [];
const debugPointSize: number[] = [];

function ExtractSurface (_chunk: Chunk,
    _field: SignedDistanceField,
    _verticies: number[],
    _faces: number[]): boolean 
{
    chunk = _chunk;
    field = _field;
    numSamples = chunk.getNumSamples();

    if (numSamples > maxSamples) {
        distances = new Float32Array(numSamples);
        doneDistances = new Int8Array(numSamples);
        maxSamples = numSamples;
    }

    doneDistances.fill(0);


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

    SetupSampleRange();

    if (SampleChunkField()) {
        ExtractSurfaceVoxels();
    }

    for (let i = 0; i < voxels.numSurfaceVoxels; i++) {
        // each active voxel contains one vertex
        // calculate vertex for this voxel
        const voxelIndex = voxels.surfaceVoxels[i];
        chunk.voxelIndexToVoxelPosition(voxelIndex, voxelPosition);
    }

    return faces.length > 0;
}

function SampleField(position: Vector3): number {
    systemSettings.debugCounters.totalSamples++;
    return field.sample(position);
}

function SampleChunkField(): boolean {

    SetupSampleRange();
    SampleRange(xSampleStart, xSampleEnd, ySampleStart, ySampleEnd, zSampleStart, zSampleEnd);

    return voxels.numSurfaceVoxels > 0;
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


function SampleRange(x1: number, x2: number, y1: number, y2: number, z1: number, z2: number) {
    // because of odd numbered ranges we can end up dividing too much
    if (x1 == x2 || y1 == y2 || z1 == z2) {
        return;
    }
   
    let voxelIndex = 0;
    let surfaceDist = 0;
    let subdivide = false;

    // check if we need to subdivide
    const xMid = (x1 + x2) >> 1;
    const yMid = (y1 + y2) >> 1;
    const zMid = (z1 + z2) >> 1;

    const reachedMinSize = (x2 - x1) <= 1 && (y2 - y1) <= 1 && (z2 - z1) <= 1;

    if (!reachedMinSize) {
        const xRange = x2 - x1;
        const yRange = y2 - y1;
        const zRange = z2 - z1;

        const middleIndex = chunk.voxelIndex(xMid, yMid, zMid);
        if (!doneDistances[middleIndex]) {
            chunk.voxelSpaceToWorldSpace(xMid, yMid, zMid, worldPosition);
            surfaceDist = SampleField(worldPosition);
            doneDistances[middleIndex] = 1;
            distances[middleIndex] = surfaceDist;
        }
        else {
            surfaceDist = distances[middleIndex];
        }
        
        const distanceThreshold = Math.max(xRange, yRange, zRange) * (chunk.getVoxelSize() / 2) * sqrt3;
        if (Math.abs(surfaceDist) < distanceThreshold) {
            subdivide = true;
        }           
    }
    else {
        // Corner numbers
        //
        //     6 -----7
        //    /|     /|
        //   2------3 |
        //   | 4----|-5
        //   |/     |/
        //   0------1
        //
        // corner 0
        cornerDist[0] = SampleCorner(x1, y1, z1);
        
        // corner 1
        cornerDist[1] = SampleCorner(x2, y1, z1);

        // corner 2
        cornerDist[2] = SampleCorner(x1,y2,z1);

        // corner 3
        cornerDist[3] = SampleCorner(x2,y2,z1);

        // corner 4
        cornerDist[4] = SampleCorner(x1,y1,z2);

        // corner 5
        cornerDist[5] = SampleCorner(x2,y1,z2);

        // corner 6
        cornerDist[6] = SampleCorner(x1,y2,z2);

        // corner 7
        cornerDist[7] = SampleCorner(x2,y2,z2);
                
        let interiorPoints = 0;
        for (let i = 0; i < 8; i++) {
            const dist = cornerDist[i];
            if (dist < 0)
                interiorPoints++;
        }

        if (interiorPoints > 0 && interiorPoints < 8) {
            voxelIndex = chunk.voxelIndex(x1, y1, z1);
            voxels.surfaceVoxels[voxels.numSurfaceVoxels] = voxelIndex;
            voxels.numSurfaceVoxels++;

            const edgeMask = CalcWorldVertex(x1, y1, z1, voxelIndex, 1);
        
            AddDebugMarker(x1, y1, z1, edgeMask);
            
            AppendVertex(voxelIndex, vertexPoint);

            voxels.connections[voxelIndex] = edgeMask;
        }
    }

    if (subdivide) {
        SampleRange(x1, xMid, y1, yMid, z1, zMid);
        SampleRange(xMid, x2, y1, yMid, z1, zMid);
        SampleRange(x1, xMid, yMid, y2, z1, zMid);
        SampleRange(xMid, x2, yMid, y2, z1, zMid);
        SampleRange(x1, xMid, y1, yMid, zMid, z2);
        SampleRange(xMid, x2, y1, yMid, zMid, z2);
        SampleRange(x1, xMid, yMid, y2, zMid, z2);
        SampleRange(xMid, x2, yMid, y2, zMid, z2);
    }

}


function SampleCorner(x: number, y: number, z: number) {
    const cornerIndex = chunk.voxelIndex(x, y, z);
    let surfaceDist = 0;
    if (!doneDistances[cornerIndex]) {
        chunk.voxelSpaceToWorldSpace(x, y, z, worldPosition);
        surfaceDist = SampleField(worldPosition);
        doneDistances[cornerIndex] = 1;
        distances[cornerIndex] = surfaceDist;
    }
    else {
        surfaceDist = distances[cornerIndex];
    }
    return surfaceDist;
}


function AddDebugMarker(voxX: number, voxY: number, voxZ: number, edgeMask: number) {
    if ((systemSettings.showVoxelVertex || systemSettings.showVoxelBounds) && systemSettings.isTargetChunk(chunk)) {
        if (voxX >= systemSettings.showVoxelRange.x1 && voxX <= systemSettings.showVoxelRange.x2 &&
            voxY >= systemSettings.showVoxelRange.y1 && voxY <= systemSettings.showVoxelRange.y2 &&
            voxZ >= systemSettings.showVoxelRange.z1 && voxZ <= systemSettings.showVoxelRange.z2) {
            
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
            if (edgeMask & X_PLUS_EDGE) {
                edges += "X+ ";
            }
            if (edgeMask & X_MINUS_EDGE) {
                edges += "X- ";
            }
            if (edgeMask & Y_PLUS_EDGE) {
                edges += "Y+ ";
            }
            if (edgeMask & Y_MINUS_EDGE) {
                edges += "Y- ";
            }
            if (edgeMask & Z_PLUS_EDGE) {
                edges += "Z+ ";
            }
            if (edgeMask & Z_MINUS_EDGE) {
                edges += "Z- ";
            }
            if (edges == "" && edgeMask & CONNECTED_CELL) {
                edges += "CONNECTED_CELL ";
            }

            if (edges == "")
                edges = "??? " + edgeMask;

            // corner distances to 2 decimal places
            // const cornerDistances = ` x1 ${cornerDist[0].toFixed(2)} x2 ${cornerDist[1].toFixed(2)} y1 ${cornerDist[2].toFixed(2)} y2 ${cornerDist[3].toFixed(2)} z1 ${cornerDist[4].toFixed(2)} z2 ${cornerDist[5].toFixed(2)}`
            
            if (systemSettings.showVoxelVertex) {
                // show the voxel center just slightly above the surface
                debugPoints.push(vertexPoint.clone());
                debugPointSize.push(voxelSize / 8);
                debugLabels.push(`voxelCenter ${voxX} ${voxY} ${voxZ} edges ${edges}`);
            }

            if (systemSettings.showVoxelBounds) {
                const voxelBounds = new Vector3();
                chunk.voxelSpaceToWorldSpace(voxX, voxY, voxZ, voxelBounds);
                debugPoints.push(voxelBounds);
                debugPointSize.push(voxelSize);
                debugLabels.push(`voxelBounds ${voxX} ${voxY} ${voxZ} edges ${edges}`);
            }
    
        }
    }

}

function CalcWorldVertex(voxX: number, voxY: number, voxZ: number, voxelIndex: number,scale: number) {
    const edgeMask = CalcVoxelVertex(cornerDist, voxelCenter);

    voxelCenter.scaleInPlace(voxelSize * scale);
    chunk.voxelSpaceToWorldSpace(voxX,voxY,voxZ, samplePoint);

    vertexPoint.set(
        voxelCenter.x + samplePoint.x,
        voxelCenter.y + samplePoint.y,
        voxelCenter.z + samplePoint.z);

    return edgeMask;
}

function AppendVertex(voxelIndex: number,point: Vector3) {
    const dist = SampleField(point);
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
        offsetDist = SampleField(pointOffset);
        normal.addInPlaceFromFloats(offsetDist,-offsetDist,-offsetDist);

        // k.yyx*f( p + k.yyx*h ) + 
        pointOffset.set(point.x - offset,point.y - offset,point.z + offset);
        offsetDist = SampleField(pointOffset);
        normal.addInPlaceFromFloats(-offsetDist,-offsetDist,offsetDist);

        // k.yxy*f( p + k.yxy*h ) + 
        pointOffset.set(point.x - offset,point.y + offset,point.z - offset);
        offsetDist = SampleField(pointOffset);
        normal.addInPlaceFromFloats(-offsetDist,offsetDist,-offsetDist);
        
        // k.xxx*f( p + k.xxx*h )
        pointOffset.set(point.x + offset,point.y + offset,point.z + offset);
        offsetDist = SampleField(pointOffset);
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

    return true;
}

function ExtractSurfaceVoxels() {

    for (let i = 0; i < voxels.numSurfaceVoxels; i++)
    {
        // each active voxel contains one vertex
        // calculate vertex for this voxel
        const voxelIndex = voxels.surfaceVoxels[i];
        chunk.voxelIndexToVoxelPosition(voxelIndex,worldPosition);

        ExtractVoxel(voxels.connections[voxelIndex]);
    }
}

function ExtractVoxel(connectEdges: number) {
    // skip voxels extending beyond the chunk on the min edge
    // the preceding chunk will handle this shared space
    if (worldPosition.x <= 0)
        return; 
    if (worldPosition.y <= 0)
        return; 
    if (worldPosition.z <= 0)
        return;

    if (connectEdges & XZ_FACE_CLOCKWISE) {
        ExtractFace(worldPosition, [
            [0, 0, 0], [0, 0, -1], [-1, 0, -1],
            [-1, 0, -1], [-1, 0, 0], [0, 0, 0]
        ]);
    }
    if (connectEdges & XZ_FACE_ANTICLOCK) {
        ExtractFace(worldPosition, [
            [0, 0, 0], [-1, 0, 0], [-1, 0, -1],
            [-1, 0, -1], [0, 0, -1], [0, 0, 0]
        ]);
    }

    if (connectEdges & XY_FACE_CLOCKWISE) {
        ExtractFace(worldPosition, [
            [0, 0, 0], [-1, 0, 0], [-1, -1, 0],
            [-1, -1, 0], [0, -1, 0], [0, 0, 0]
        ]);
    }
    if (connectEdges & XY_FACE_ANTICLOCK) {
        ExtractFace(worldPosition, [
            [0, 0, 0], [0, -1, 0], [-1, -1, 0],
            [-1, -1, 0], [-1, 0, 0], [0, 0, 0]
        ]);
    }

    if (connectEdges & YZ_FACE_CLOCKWISE) {
        ExtractFace(worldPosition, [
            [0, 0, 0], [0, -1, 0], [0, -1, -1],
            [0, -1, -1], [0, 0, -1], [0, 0, 0]
        ]);
    }
    if (connectEdges & YZ_FACE_ANTICLOCK) {
        ExtractFace(worldPosition, [
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
        const dist0 = cornerDist[edgeDetails.startCorner];
        const dist1 = cornerDist[edgeDetails.endCorner];
        // if the distance to the surface changes sign
        // then this edge intersects the surface
        const distNeg0 = (dist0 < 0);
        const distNeg1 = (dist1 < 0);
        if (distNeg0 != distNeg1) {
            connectEdges |= CONNECTED_CELL;
            // record edges were crossed which we need to connect up
            // and if they face in or out ( negative to positive distance or positive to negative)
            if (distNeg0) // at this point if distNeg0 is true, distNeg1 must be false or visa versa
                connectEdges |= edgeDetails.faceReversed;
            else
                connectEdges |= edgeDetails.faceNormal;
            edgeCount++;
            const distDiff = dist0 / (dist0 - dist1);
            const inverseDiff = 1 - distDiff;
            const corner0 = CUBE_CORNER_OFFSETS[edgeDetails.startCorner];
            const corner1 = CUBE_CORNER_OFFSETS[edgeDetails.endCorner];
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

function ExtractFace(voxelPosition: Vector3,offsets: number[][]) {

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
            const worldX = verticies[vertIndex];
            const worldY = verticies[vertIndex + 1];
            const worldZ = verticies[vertIndex + 2];

            faceVertices[i].set(worldX,worldY,worldZ);
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
            connections: new Int8Array(numSamples),
        }
        maxVoxels = numSamples;
    }
    else {
        voxels.vertexCount = 0;
        voxels.numSurfaceVoxels = 0;
    }
}


export {
    ExtractSurface,
    ConnectedChunks,
    CalcVoxelVertex,
    CONNECTED_CELL,
    XZ_FACE_CLOCKWISE,
    XY_FACE_CLOCKWISE,
    YZ_FACE_CLOCKWISE,
    XZ_FACE_ANTICLOCK,
    XY_FACE_ANTICLOCK,
    YZ_FACE_ANTICLOCK,
    X_MINUS_EDGE,
    X_PLUS_EDGE,
    Y_MINUS_EDGE,
    Y_PLUS_EDGE,
    Z_MINUS_EDGE,
    Z_PLUS_EDGE,
    debugPoints, debugLabels, debugPointSize
}

