import { Vector3 } from "@babylonjs/core";


/**
 * Make working with a 1 dimentional array work like a 3d array
 * by working out the index in the 1d array
 * Doesn't actually reference the array itself
 */
export class ChunkDimensions {
    size = 0;
    cells = 0;
    points = 0;
    xStep = 1;
    yStep = 0;
    zStep = 0;
    samples = 0;
    xOrigin = 0;
    yOrigin = 0;
    zOrigin = 0;
    stepSize = 0;
    indexMask = 0;
    indexShift = 0;
    indexShiftTimes2 = 0;
    neighbourXScale = 0;
    neighbourYScale = 0;
    neighbourZScale = 0;


    /**
     * sets the dimensions
     * @param size the range of the samples
     * @param steps the number of steps the range is divided into
     * @returns 
     */
    set(size: number, points: number, xOrigin: number, yOrigin: number, zOrigin: number): ChunkDimensions {
        if ((points & (points - 1)) != 0) // https://stackoverflow.com/questions/600293/how-to-check-if-a-number-is-a-power-of-2
            throw "points must be a power of two"
        this.size = size;
        this.cells = points - 1;
        this.points = points;
        // one more point needed than each cell
        // therefore cells = points -1
        // e.g. 4 point, = 3 cells
        // points marked 'x' and cellse marked 'c'
        // 
        //  X   X   X   X
        //    c   c   c 
        //  X   X   X   X
        //    c   c   c
        //  X   X   X   X
        //    c   c   c
        //  X   X   X   X
        //
        this.xOrigin = xOrigin;
        this.yOrigin = yOrigin;
        this.zOrigin = zOrigin;
        this._calc();
        return this;
    }

    private _calc() {
        this.samples = this.points * this.points * this.points;
        this.yStep = this.points;
        this.zStep = this.points * this.points;
        this.stepSize = this.size / this.cells;
        this.indexShift = 0;
        this.indexMask = 0;
        for (let i = this.points; i > 1; i >>= 1) {
            this.indexShift++;
            this.indexMask = this.indexMask << 1 | 1;
        }
        this.indexShiftTimes2 = this.indexShift * 2;
    }

    // get the index of array at this coordinate
    cellIndex(x: number, y: number, z: number): number {
        return x + (y * this.yStep) + (z * this.zStep);
    }
    
    cellSpaceToWorldSpace(i: number, j: number, k: number, samplePoint: Vector3) {
        samplePoint.x = this.xOrigin + (i * this.stepSize);
        samplePoint.y = this.yOrigin + (j * this.stepSize);
        samplePoint.z = this.zOrigin + (k * this.stepSize);
    }

    indexToWorldSpace(index: number, samplePoint: Vector3) {
        const cellX = index & this.indexMask;
        const cellY = (index >> this.indexShift) & this.indexMask;
        const cellZ = (index >> this.indexShiftTimes2) & this.indexMask;
        this.cellSpaceToWorldSpace(cellX, cellY, cellZ, samplePoint);
    }

    getCenter(point: Vector3) {
        point.x = this.xOrigin + this.size / 2;
        point.y = this.yOrigin + this.size / 2;
        point.z = this.zOrigin + this.size / 2;
    }
}