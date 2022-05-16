import { Vector2,Vector3 } from "@babylonjs/core/Maths";

const voxelPosition = new Vector3();
const voxelCenter = new Vector3();
const voxelOffset = {x:0,y:0,z:0};
    

enum CORNERS {
    leftBottomFront = 0,
    rightBottomFront = 1,
    leftTopFront = 2, 
    rightTopFront = 3,
    leftBottomBack = 4,
    rightBottomBack = 5,
    leftTopBack = 6, 
    rightTopBack = 7
}

interface XYZ { x: number; y: number; z: number}
interface XY { x: number; y: number;}

/**
 * Make working with a 1 dimensional array work like a 3d array
 * by working out the index in the 1d array
 * Doesn't actually reference the array itself
 */
class Chunk {
    /**
     * the extent of the chunk in world coordinate space
     */
    worldSize = new Vector3();
    /**
     * the number of voxels in the chunk along each axis
     */
    voxelRange = new Vector3();
    /**
     * stride use to convert 1 dimensional array index to 3 dimensional array
     * e.g. index = x + y*stride.x + z*stride.y
     */
    stride = new Vector3();
    /**
     * number of distance samples in the chunk
     */
    numSamples = 0;
    maxSamples = 0;
    /**
     * origin of the chunk in world coordinate space
     */
    origin = new Vector3();
    /**
     * the size of one voxel in the chunk in world coordinate space
     */
    voxelSize = 0;

    constructor () {
        this.maxSamples = 0;
    }

    setSize(size: XYZ, voxelSize: number) {
        // one more point needed than each voxel
        // e.g. 4 point, = 3 voxels
        // points marked 'x' and voxels marked 'c'
        //  X   X   X   X
        //    c   c   c 
        //  X   X   X   X
        //    c   c   c
        //  X   X   X   X
        //    c   c   c
        //  X   X   X   X
        //
        // one more voxel needed to cover overlap with next chunk
        // so points = subdivisions + 2;
        CopyXyz(size,this.worldSize)
        this.voxelRange.x = (size.x / voxelSize);
        this.voxelRange.y = (size.y / voxelSize);
        this.voxelRange.z = (size.z / voxelSize);
        this.stride.x = this.voxelRange.x + 1;
        this.stride.y = this.stride.x * (this.voxelRange.y + 1);
        this.numSamples = this.stride.y * (this.voxelRange.z + 1);
        if (this.numSamples > 65536) throw "chunk resolution exceeds 65536. aborting";

        this.voxelSize = voxelSize;
    }

    /**
     * 
     * @param origin of the chunk in world coordinates
     */
    setOrigin(origin: XYZ) {
        CopyXyz(origin,this.origin);
    }

    voxelIndexToVoxelPosition(voxelIndex: number, voxelPosition: XYZ) {
        let index = voxelIndex;
        voxelPosition.x = voxelIndex % this.stride.x;
        index -= voxelPosition.x;
        voxelPosition.y = (index % this.stride.y) / this.stride.x;
        index -= voxelPosition.y * this.stride.x;
        voxelPosition.z = index / this.stride.y;
    }
    
    indexToWorldSpace(index: number, samplePoint: XYZ) {
        this.voxelIndexToVoxelPosition(index,voxelPosition);
        this.voxelSpaceToWorldSpace(voxelPosition, samplePoint);
    }

    // get the index of array at this coordinate
    voxelIndex(x: number, y: number, z: number): number {
        return x + (y * this.stride.x) + (z * this.stride.y);
    }
    
    voxelSpaceToWorldSpace(voxel: XYZ, samplePoint: XYZ) {
        samplePoint.x = this.origin.x + (voxel.x * this.voxelSize);
        samplePoint.y = this.origin.y + (voxel.y * this.voxelSize);
        samplePoint.z = this.origin.z + (voxel.z * this.voxelSize);
    }


}

function CopyXyz (src: XYZ, dest: XYZ) {
    dest.x = src.x;
    dest.y = src.y;
    dest.z = src.z;
}

function CopyXy (src: XY, dest: XY) {
    dest.x = src.x;
    dest.y = src.y;
}

export {Chunk, CORNERS, XYZ,XY,CopyXyz,CopyXy}

