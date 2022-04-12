import { Vector3 } from "@babylonjs/core/Maths";
import { SignedDistanceField, EMPTY_FIELD } from "../signedDistanceFields";

const cellPosition = new Vector3();
const sqrt3 = Math.sqrt(3);
const cellCenter = new Vector3();
const samplePoint = new Vector3();
let sparseSamples = 0;
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

/**
 * Make working with a 1 dimensional array work like a 3d array
 * by working out the index in the 1d array
 * Doesn't actually reference the array itself
 */
class Chunk {
    size = 0;
    subdivisions = 0;
    points = 0;
    pointsSquared = 0;
    pointsCubed = 0;
    numSamples = 0;
    maxSamples = 40_000
    xOrigin = 0;
    yOrigin = 0;
    zOrigin = 0;
    stepSize = 0;
    neighbourXScale = 0;
    neighbourYScale = 0;
    neighbourZScale = 0;

    markedSamples: Int16Array;
    cellToVertexIndex: Int16Array;
    vertexToCellIndex: Int16Array;
    sampleMarker = 0;
    field: SignedDistanceField = EMPTY_FIELD;
    fieldSamples: Float32Array;
    activeCells = 0;

    constructor () {
        this.numSamples = 40_000;
        this.maxSamples = this.numSamples;
        this.markedSamples = new Int16Array(this.numSamples);
        this.fieldSamples = new Float32Array(this.numSamples);
        this.cellToVertexIndex = new Int16Array(this.numSamples);
        this.vertexToCellIndex = new Int16Array(this.numSamples);
    }

    setSize(size: number, subdivisions: number) {
        if ((subdivisions & (subdivisions - 1)) != 0) // https://stackoverflow.com/questions/600293/how-to-check-if-a-number-is-a-power-of-2
            throw "subdivisions must be a power of two";
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
        this.points = subdivisions + 2;
        this.size = size;
        this.numSamples = this.points * this.points * this.points;
        this.pointsSquared = this.points * this.points;
        this.pointsCubed = this.numSamples;
        this.stepSize = this.size / subdivisions;
        this.subdivisions = subdivisions;
      }

    setOrigin(xOrigin: number, yOrigin: number, zOrigin: number) {
        this.xOrigin = xOrigin;
        this.yOrigin = yOrigin;
        this.zOrigin = zOrigin;
    }

    cellIndexToCellPosition(cellIndex: number, cellPosition: Vector3) {
        let index = cellIndex;
        cellPosition.x = cellIndex % this.points;
        index -= cellPosition.x;
        cellPosition.y = (index % this.pointsSquared) / this.points;
        index -= cellPosition.y * this.points;
        cellPosition.z = index / this.pointsSquared;
    }
    
    indexToWorldSpace(index: number, samplePoint: Vector3) {
        this.cellIndexToCellPosition(index,cellPosition);
        this.cellSpaceToWorldSpace(cellPosition.x, cellPosition.y, cellPosition.z, samplePoint);
    }

    // get the index of array at this coordinate
    cellIndex(x: number, y: number, z: number): number {
        return x + (y * this.points) + (z * this.pointsSquared);
    }
    
    cellSpaceToWorldSpace(i: number, j: number, k: number, samplePoint: Vector3) {
        samplePoint.x = this.xOrigin + (i * this.stepSize);
        samplePoint.y = this.yOrigin + (j * this.stepSize);
        samplePoint.z = this.zOrigin + (k * this.stepSize);
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
        this._sampleCells();
        return this.activeCells > 0;
    }

    private _sampleCells() {
        const halfSize = (this.size + this.stepSize) / 2;
        cellCenter.set(this.xOrigin + halfSize, this.yOrigin + halfSize,this.zOrigin + halfSize)
        const centerDist = this.field.sample(cellCenter);
        // the maximum distance a field can be for the cell center
        // and still intersect is half the cell size * sqrt3
        // because the hypotenuse is sqrt(x*x+y*y+z*z)
        // we can work this for x=y=z=1 ie sqrt(3)
        // then just do halfCell*sqrt(3)
        if (Math.abs(centerDist) > halfSize * sqrt3)
            return; // the surface is further away than the cell size, quit
        sparseSamples = 0;
        const threshold = this.stepSize * 2.5;
        for (let cellX = 0; cellX <= this.subdivisions; cellX++) {
            for (let cellY = 0; cellY <= this.subdivisions; cellY++) {
                let surfaceDist = 0;
                for (let cellZ = 0; cellZ <= this.subdivisions; cellZ++) {
                    if (surfaceDist < threshold)
                    {
                        const centerIndex = this.cellIndex(cellX,cellY, cellZ);
                        if (this.markedSamples[centerIndex] == this.sampleMarker) {
                            surfaceDist = this.fieldSamples[centerIndex];
                        }
                        else
                        {
                            this.cellSpaceToWorldSpace(cellX, cellY, cellZ, cellCenter);
                            surfaceDist = this.field.sample(cellCenter);
                            this.fieldSamples[centerIndex] = surfaceDist;
                            // mark location as calculated to avoid sampling it again
                            this.markedSamples[centerIndex] = this.sampleMarker;
                            sparseSamples++;
                        }
                        surfaceDist = Math.abs(surfaceDist);
                        if (surfaceDist < threshold)
                            this._extractCell(cellX,cellY,cellZ);
                    }
                    else
                        surfaceDist -= this.stepSize;
                }
            }
        }
    }


    private _extractCell(cellX: number, cellY: number, cellZ: number): boolean {
        const cellIndex = this.cellIndex(cellX, cellY, cellZ);
        const {field, sampleMarker, markedSamples,numSamples: samples} = this;
        let negPoints = 0;
        for (let cornerNum = 0; cornerNum < 8; cornerNum++) {
            GetCellCornerPosition(cornerNum, cellX, cellY, cellZ, cellPosition);
            const cornerIndex = this.cellIndex(cellPosition.x,cellPosition.y, cellPosition.z);
            let dist;
            // see if the sample is marked as calculated.
            if (markedSamples[cornerIndex] == sampleMarker) {
                dist = this.fieldSamples[cornerIndex];
            } else {
                // not calculated, sample the field
                this.cellSpaceToWorldSpace(cellPosition.x, cellPosition.y, cellPosition.z,samplePoint);
                dist = field.sample(samplePoint);
                this.fieldSamples[cornerIndex] = dist;
                sparseSamples++;
                markedSamples[cornerIndex] = sampleMarker;
            }
            
            if (dist < 0)
                negPoints++;
        }
        if (negPoints == 0 || negPoints == 8)
            return false;

        this.cellToVertexIndex[cellIndex] = this.activeCells;
        // we'll need to find neighboring cells of this point to connect them up
        // so record the cell index that the point was created for
        this.vertexToCellIndex[this.activeCells] = cellIndex;
        this.activeCells++;
        return true;
    }

    static seamRange(chunk1: Chunk, chunk2: Chunk, range: Float32Array) {
        Chunk._rangeOverlap(
            chunk1.xOrigin, chunk1.xOrigin + chunk1.size,
            chunk2.xOrigin, chunk2.xOrigin + chunk2.size, 
            range, 0);       
        Chunk._rangeOverlap(
            chunk1.yOrigin, chunk1.yOrigin + chunk1.size,
            chunk2.yOrigin, chunk2.yOrigin + chunk2.size, 
            range, 2);       
        Chunk._rangeOverlap(
            chunk1.zOrigin, chunk1.zOrigin + chunk1.size,
            chunk2.zOrigin, chunk2.zOrigin + chunk2.size, 
            range, 4);       
    }

    private static _rangeOverlap(
        start1: number,end1: number,
        start2: number,end2: number,
        range: Float32Array ,offset: number) 
    {
        const start = Math.max(start1, start2);
        const end = Math.min(end1, end2);
        if (end >= start) {
            range[offset] = start;
            range[offset + 1] = end;
        }
        else
        {
            range[offset] = end;
            range[offset + 1] = start;
        }
    }
}

function GetCellCornerPosition(cornerNum: number, cellX: number, cellY: number, cellZ: number, cellPosition: Vector3) {
    cellPosition.set(
        cellX + CUBE_CORNER_OFFSETS[cornerNum].x, 
        cellY + CUBE_CORNER_OFFSETS[cornerNum].y, 
        cellZ + CUBE_CORNER_OFFSETS[cornerNum].z);
}   

export {Chunk, CUBE_CORNER_OFFSETS, GetCellCornerPosition, sparseSamples}