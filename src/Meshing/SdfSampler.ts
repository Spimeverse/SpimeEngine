import { Vector3 } from "@babylonjs/core"
import { SignedDistanceField } from "../signedDistanceFields/SignedDistanceField"
import { ChunkDimensions } from "./chunkDimensions";

const sampleCoordinate: Vector3 = new Vector3();
const sqrt3 = Math.sqrt(3);

let fullSamples = 0;

function SdfSampler(field: SignedDistanceField,dims: ChunkDimensions, samples: Float32Array): boolean {
    fullSamples = 0;
    dims.getCenter(sampleCoordinate);
    const d = Math.abs(field.sample(sampleCoordinate));
    // the maximum distance a field can be for the cell center
    // and still intersect is half the cell size * sqrt3
    // because the hypotenuese is sqrt(x*x+y*y+z*z)
    // we can work this for x=y=z=1 ie sqrt(3)
    // then just do halfcell*sqrt(3)
    if (d > (dims.size / 2) * sqrt3) 
        return false;
    let bufferIndex = 0;
    for (let cellZ = 0; cellZ <= dims.cells + 1; cellZ++ ) {
        for (let cellY = 0; cellY <= dims.cells + 1; cellY++) {
            for (let cellX = 0; cellX <= dims.cells + 1; cellX++) {
                dims.cellSpaceToWorldSpace(cellX,cellY,cellZ,sampleCoordinate);
                bufferIndex = dims.cellIndex(cellX,cellY,cellZ);
                samples[bufferIndex] = field.sample(sampleCoordinate);
                fullSamples++;
            }
        }
    }
    return true;
}

export {SdfSampler, fullSamples}

// let _minSize = 0.1;
// let _field:SignedDistanceField;
// let _dims:SampleDimensions;

// export function SparceSdfSample(field: SignedDistanceField,dims: SampleDimensions, samples: Float32Array, minSize: number): boolean {
//     _field = field;
//     _minSize = minSize;
//     _dims = dims;
//     SubSample(0,0,0,dims.cells);
// }

// function SubSample(x: number, y: number, z: number, cells: number): void {
//     const halfSize = cells >> 1; // divide by 2;
//     sampleCoordinate.set(
//         (x + halfSize) * _dims.stepSize, 
//         (y + halfSize) * _dims.stepSize,
//         (z + halfSize) * _dims.stepSize);
//     const centerDist = _field.sample(sampleCoordinate);
//     if (Math.abs(centerDist) > halfSize * sqrt3)
//         return;
//     if (cells == 1) {

//     }
// }