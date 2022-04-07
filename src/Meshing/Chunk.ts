import { Vector3 } from "@babylonjs/core/Maths";
import { SignedDistanceField, EMPTY_FIELD } from "../signedDistanceFields";

const cellPosition = new Vector3();
const sqrt3 = Math.sqrt(3);
const cellCenter = new Vector3();
const samplePoint = new Vector3();
let sparseSamples = 0;

/**
 * Make working with a 1 dimensional array work like a 3d array
 * by working out the index in the 1d array
 * Doesn't actually reference the array itself
 */
class Chunk {
    size = 0;
    cells = 0;
    points = 0;
    xStep = 1;
    yStep = 0;
    zStep = 0;
    numSamples = 0;
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
    cornerOffset = new Int16Array(8);

    markedSamples: Int16Array;
    cellToVertexIndex: Int16Array;
    vertexToCellIndex: Int16Array;
    sampleMarker = 0;
    field: SignedDistanceField = EMPTY_FIELD;
    fieldSamples: Float32Array;
    activeCells = 0;

    constructor (size: number, points: number) {

        if ((points & (points - 1)) != 0) // https://stackoverflow.com/questions/600293/how-to-check-if-a-number-is-a-power-of-2
            throw "points must be a power of two"
        this.size = size;
        this.cells = points - 1;
        this.points = points;
        // one more point needed than each cell
        // therefore cells = points -1
        // e.g. 4 point, = 3 cells
        // points marked 'x' and cells marked 'c'
        // 
        //  X   X   X   X
        //    c   c   c 
        //  X   X   X   X
        //    c   c   c
        //  X   X   X   X
        //    c   c   c
        //  X   X   X   X
        //
        this._calc();
        this._calcCornerOffsets();

        this.markedSamples = new Int16Array(this.numSamples);
        this.fieldSamples = new Float32Array(this.numSamples);
        this.cellToVertexIndex = new Int16Array(this.numSamples);
        this.vertexToCellIndex = new Int16Array(this.numSamples);
    }

    setOrigin(xOrigin: number, yOrigin: number, zOrigin: number) {
        this.xOrigin = xOrigin;
        this.yOrigin = yOrigin;
        this.zOrigin = zOrigin;
    }

    private _calc() {
        this.numSamples = this.points * this.points * this.points;
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

    private _calcCornerOffsets(): void {
        let cornerNum = 0;
        for (let z = 0; z <= 1; z++) {
            for (let y = 0; y <= 1; y++) {
                for (let x = 0; x <= 1; x++) {
                    this.cornerOffset[cornerNum] = this.cellIndex(x,y,z);
                    cornerNum++;
                }
            }
        }
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

    cellIndexToCellPosition(cellIndex: number, cellPosition: Vector3) {
        cellPosition.set(
            cellIndex & this.indexMask,
            (cellIndex >> this.indexShift) & this.indexMask,
            (cellIndex >> this.indexShiftTimes2) & this.indexMask
        )
    }

    indexToWorldSpace(index: number, samplePoint: Vector3) {
        this.cellIndexToCellPosition(index,cellPosition);
        this.cellSpaceToWorldSpace(cellPosition.x, cellPosition.y, cellPosition.z, samplePoint);
    }

    getCenter(point: Vector3) {
        point.x = this.xOrigin + this.size / 2;
        point.y = this.yOrigin + this.size / 2;
        point.z = this.zOrigin + this.size / 2;
    }

    sample (_field: SignedDistanceField): boolean {
        sparseSamples = 0;
        this.activeCells = 0;
        // increment the marker value for each extraction
        // then we don't need to clear or reset the markedSamples array
        // unless we get to max value for a byte
        this.sampleMarker++;
        if (this.sampleMarker == 65535) {
            // we've run out of unique marker values, 
            // reset the marker and clear the array
            this.sampleMarker = 1;
            this.markedSamples.fill(0)
        }
        this.field = _field;
        this._subDivideCell(0,0,0,this.points);
        return this.activeCells > 0;
    }

    private _subDivideCell(cellX: number, cellY: number, cellZ: number, stride: number) {
        if (stride > 1) {
            // see if any of the surface is in this cell, by checking the distance to the surface from the center
            const halfStride = stride >> 1;
            this.cellSpaceToWorldSpace(cellX + halfStride, cellY + halfStride, cellZ + halfStride, cellCenter);
            const centerDist = this.field.sample(cellCenter);
            // the maximum distance a field can be for the cell center
            // and still intersect is half the cell size * sqrt3
            // because the hypotenuse is sqrt(x*x+y*y+z*z)
            // we can work this for x=y=z=1 ie sqrt(3)
            // then just do halfCell*sqrt(3)
            const cellRadius = this.stepSize * halfStride;
            if (Math.abs(centerDist) > cellRadius * sqrt3)
                return; // the surface is further away than the cell size, quit
            else
            {
                // record this distance, the sub cells can reuse it to skip a sample
                const centerIndex = this.cellIndex(cellX + halfStride,cellY + halfStride, cellZ + halfStride);
                this.fieldSamples[centerIndex] = centerDist;
                sparseSamples++;
                // mark location as calculated to avoid sampling it again
                this.markedSamples[centerIndex] = this.sampleMarker;

                this._subDivideCell(cellX,                cellY,                  cellZ, halfStride);
                this._subDivideCell(cellX + halfStride,   cellY,                  cellZ, halfStride);
                this._subDivideCell(cellX,                cellY + halfStride,     cellZ, halfStride);
                this._subDivideCell(cellX + halfStride,   cellY + halfStride,     cellZ, halfStride);
                this._subDivideCell(cellX,                cellY,                  cellZ + halfStride, halfStride);
                this._subDivideCell(cellX + halfStride,   cellY,                  cellZ + halfStride, halfStride);
                this._subDivideCell(cellX,                cellY + halfStride,     cellZ + halfStride, halfStride);
                this._subDivideCell(cellX + halfStride,   cellY + halfStride,     cellZ + halfStride, halfStride);
            }
        }
        else
        {
            this._extractCell(cellX,cellY,cellZ);
        }
    }

    private _extractCell(cellX: number, cellY: number, cellZ: number) {
        const cellIndex = this.cellIndex(cellX, cellY, cellZ);
        const {field, sampleMarker, markedSamples,numSamples: samples} = this;
        if (cellX > this.cells - 1 || cellY > this.cells - 1 || cellZ > this.cells - 1)
            return 0;
        let negPoints = 0;
        for (let cornerNum = 0; cornerNum < 8; cornerNum++) {
            const cornerIndex = cellIndex + this.cornerOffset[cornerNum];
            let dist;
            // see if the sample is marked as calculated.
            if (markedSamples[cornerIndex] == sampleMarker) {
                dist = this.fieldSamples[cornerIndex];
            } else {
                // not calculated, sample the field
                this.indexToWorldSpace(cornerIndex,samplePoint);
                dist = field.sample(samplePoint);
                this.fieldSamples[cornerIndex] = dist;
                sparseSamples++;
                markedSamples[cornerIndex] = sampleMarker;
            }
            
            if (dist < 0)
                negPoints++;
        }
        if (negPoints == 0 || negPoints == 8)
            return 0;

        this.cellToVertexIndex[cellIndex] = this.activeCells;
        // we'll need to find neighboring cells of this point to connect them up
        // so record the cell index that the point was created for
        this.vertexToCellIndex[this.activeCells] = cellIndex;
        this.activeCells++;
    }
}

export {Chunk, sparseSamples}