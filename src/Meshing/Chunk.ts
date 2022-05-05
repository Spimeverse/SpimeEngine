import { Vector3 } from "@babylonjs/core/Maths";
import { SignedDistanceField, EMPTY_FIELD } from "../signedDistanceFields";

const cellPosition = new Vector3();
const cellCenter = new Vector3();
const sqrt3 = Math.sqrt(3);
let sparseSamples = 0;
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
    halfStep = 0;
    neighbourXScale = 0;
    neighbourYScale = 0;
    neighbourZScale = 0;
    tune = 0;
    subSample = 1;
    positiveSamples = false;
    negativeSamples = false;

    markedSamples: Int16Array;
    sampleMarker = 0;
    field: SignedDistanceField = EMPTY_FIELD;
    fieldSamples: Float32Array;

    constructor () {
        this.numSamples = 40_000;
        this.maxSamples = this.numSamples;
        this.markedSamples = new Int16Array(this.numSamples);
        this.fieldSamples = new Float32Array(this.numSamples);
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
        this.halfStep = this.stepSize / 2;
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
        samplePoint.x = this.xOrigin + (i * this.stepSize) - this.halfStep;
        samplePoint.y = this.yOrigin + (j * this.stepSize) - this.halfStep;
        samplePoint.z = this.zOrigin + (k * this.stepSize) - this.halfStep;
    }

    getCenter(point: Vector3) {
        point.x = this.xOrigin + this.size / 2;
        point.y = this.yOrigin + this.size / 2;
        point.z = this.zOrigin + this.size / 2;
    }

    sample (_field: SignedDistanceField): boolean {
        sparseSamples = 0;
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
        if (!this._fieldIntersectsChunk())
            return false;
        this.positiveSamples = false;
        this.negativeSamples = false;

        this._sampleAllPoints();
        return this.positiveSamples && this.negativeSamples;
    }

    private _fieldIntersectsChunk(): boolean{
        const halfSize = (this.size + this.stepSize) / 2;
        cellPosition.set(this.xOrigin + halfSize, this.yOrigin + halfSize,this.zOrigin + halfSize)
        const centerDist = this.field.sample(cellPosition);
        // the maximum distance a field can be for the cell center
        // and still intersect is half the cell size * sqrt3
        // because the hypotenuse is sqrt(x*x+y*y+z*z)
        // we can work this for x=y=z=1 ie sqrt(3)
        // then just do halfCell*sqrt(3)
        if (Math.abs(centerDist) > halfSize * sqrt3)
            return false; // the surface is further away than the cell size, quit
        return true; 
    }

    /**
     * Sample the field close to the surface
     */
    private _extractSparseCells() {
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
                    }
                    else
                        surfaceDist -= this.stepSize;
                }
            }
        }
    }

    private _sampleAllPoints() {
        sparseSamples = 0;
        for (let cellX = 0; cellX <= this.subdivisions; cellX++) {
            for (let cellY = 0; cellY <= this.subdivisions; cellY++) {
                for (let cellZ = 0; cellZ <= this.subdivisions; cellZ++) {
                    this.cellSpaceToWorldSpace(cellX, cellY, cellZ, cellPosition);
                    const surfaceDist = this.field.sample(cellPosition);
                    this.positiveSamples &&= surfaceDist >= 0;
                    this.negativeSamples &&= surfaceDist <= 0;
                    const cellIndex = this.cellIndex(cellX, cellY, cellZ);
                    this.fieldSamples[cellIndex] = surfaceDist;       
                }
            }
        }
    }



}



export {Chunk, CORNERS, sparseSamples}

