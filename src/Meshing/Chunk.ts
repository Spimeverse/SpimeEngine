import { Vector2,Vector3 } from "@babylonjs/core/Maths";

const cellPosition = new Vector3();
const cellCenter = new Vector3();
const cellOffset = {x:0,y:0,z:0};
    

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
     * the number of cells in the chunk along each axis
     */
    cellRange = new Vector3();
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
     * the size of one cell in the chunk in world coordinate space
     */
    cellSize = 0;

    constructor () {
        this.maxSamples = 0;
    }

    setSize(size: XYZ, cellSize: number) {
        // one more point needed than each cell
        // e.g. 4 point, = 3 cells
        // points marked 'x' and cells marked 'c'
        //  X   X   X   X
        //    c   c   c 
        //  X   X   X   X
        //    c   c   c
        //  X   X   X   X
        //    c   c   c
        //  X   X   X   X
        //
        // one more cell needed to cover overlap with next chunk
        // so points = subdivisions + 2;
        CopyXyz(size,this.worldSize)
        this.cellRange.x = (size.x / cellSize);
        this.cellRange.y = (size.y / cellSize);
        this.cellRange.z = (size.z / cellSize);
        this.stride.x = this.cellRange.x + 1;
        this.stride.y = this.stride.x * (this.cellRange.y + 1);
        this.numSamples = this.stride.y * (this.cellRange.z + 1);
        if (this.numSamples > 65536) throw "chunk resolution exceeds 65536. aborting";

        this.cellSize = cellSize;
    }

    /**
     * 
     * @param origin of the chunk in world coordinates
     */
    setOrigin(origin: XYZ) {
        CopyXyz(origin,this.origin);
    }

    cellIndexToCellPosition(cellIndex: number, cellPosition: XYZ) {
        let index = cellIndex;
        cellPosition.x = cellIndex % this.stride.x;
        index -= cellPosition.x;
        cellPosition.y = (index % this.stride.y) / this.stride.x;
        index -= cellPosition.y * this.stride.x;
        cellPosition.z = index / this.stride.y;
    }
    
    indexToWorldSpace(index: number, samplePoint: XYZ) {
        this.cellIndexToCellPosition(index,cellPosition);
        this.cellSpaceToWorldSpace(cellPosition, samplePoint);
    }

    // get the index of array at this coordinate
    cellIndex(x: number, y: number, z: number): number {
        return x + (y * this.stride.x) + (z * this.stride.y);
    }
    
    cellSpaceToWorldSpace(cell: XYZ, samplePoint: XYZ) {
        samplePoint.x = this.origin.x + (cell.x * this.cellSize);
        samplePoint.y = this.origin.y + (cell.y * this.cellSize);
        samplePoint.z = this.origin.z + (cell.z * this.cellSize);
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

