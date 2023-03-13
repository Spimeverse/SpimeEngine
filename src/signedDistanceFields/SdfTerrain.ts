import { DeepImmutableObject } from "@babylonjs/core";
import { Vector3,Matrix,Quaternion,Axis } from "@babylonjs/core/Maths";
import { SignedDistanceField } from "./SignedDistanceField";

// https://iquilezles.org/articles/fbmsdf/

// allocate intermediate vectors once
const p2 = new Vector3(0, 0, 0);
const gridPeriod = new Vector3(1, 1, 1);
const gridSphereDist = new Vector3(0, 0, 0);


// function ConvertPositionToRandomValue(vec: Vector3): number {
//     let x = vec.x * 123.4567 + vec.y * 234.5678 + vec.z * 345.6789;
//     x = Math.sin(x) * 43758.5453123;
//     return (x - Math.floor(x));
// }

function ConvertPositionToRandomValue(vec: Vector3): number {
  // Define prime numbers for hashing
  const p1 = 0.73856093;
  const p2 = 0.19349663;
  const p3 = 0.83492791;

  // Hash each component of the vector using primes
  let hash = 0;
  hash += (vec.x * vec.x * p1);
  hash += (vec.y * vec.y * p2);
  hash += (vec.z * vec.z * p3);

  // Return the hashed value
  return hash - Math.floor(hash);
}


function SphereDomainRepeat(indexOfGrid: Vector3, fractionOfGridCell: Vector3, gridSize: number,gridOffsetX: number,gridOffsetY: number,gridOffsetZ: number) {
    gridPeriod.copyFrom(indexOfGrid);
    gridPeriod.addInPlaceFromFloats(gridOffsetX,gridOffsetY,gridOffsetZ);
    // random radius at grid vertex 
    const halfGridSize = gridSize * 0.5;
    const rad = halfGridSize * ConvertPositionToRandomValue(gridPeriod);
    
    // distance to sphere at grid vertex 
    gridSphereDist.set(Math.abs(fractionOfGridCell.x - halfGridSize), Math.abs(fractionOfGridCell.y - halfGridSize), Math.abs(fractionOfGridCell.z - halfGridSize));
    //gridSphereDist.addInPlaceFromFloats(gridOffsetX,gridOffsetY,gridOffsetZ);
    return gridSphereDist.length() - rad;
}

function SmoothMax(a: number, b: number, k: number): number {
    const h = Math.max(k - Math.abs(a - b), 0.0) / k;
    const max = (a < b) ? b : a;
  return max + h * h * h * k * (1 / 6);
}

// https://iquilezles.org/articles/smin/
function SmoothMin(a: number, b: number, k: number): number {
    const h = Math.max(k - Math.abs(a - b), 0.0) / k;
    const min = (a < b) ? a : b;
  return min - h * h * h * k * (1 / 6);
}


function SdBase(p: Vector3,gridSize: number): number {
        // visualize grid f1 = nearest grid, f2 = fraction of grid
        // https://graphtoy.com/?f1(x,t)=floor(x/10)*10&v1=true&f2(x,t)=x-f1(x,t)&v2=true&f3(x,t)=&v3=false&f4(x,t)=&v4=false&f5(x,t)=&v5=false&f6(x,t)=&v6=false&grid=1&coords=0,0,21.150790628953274
        const nearestGrid = new Vector3(Math.floor(p.x / gridSize) * gridSize, Math.floor(p.y / gridSize) * gridSize, Math.floor(p.z / gridSize) * gridSize);
        const fractionOfGrid = new Vector3((p.x - nearestGrid.x) , (p.y - nearestGrid.y) , (p.z - nearestGrid.z) );
        // distance to the 8 corners spheres
        return Math.min(
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, 0, 0, 0),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, 0, 0, gridSize),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, 0, gridSize, 0),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, 0, gridSize, gridSize),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, gridSize, 0, 0),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, gridSize, 0, gridSize),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, gridSize, gridSize, 0),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, gridSize, gridSize, gridSize)
        );
        //return SphereDomainRepeat(nearestGrid, fractionOfGrid, 10,0,0,0);
}

const scale = new Vector3(0.8, 0.8, 0.8);
const translation = new Vector3(1 / 13, 1 / 17, 1 / 19);
const rotation = Quaternion.RotationYawPitchRoll(Math.PI / 13, Math.PI / 17, Math.PI / 19)
const matrix = Matrix.Compose(scale, rotation, translation);
        
const octiveSample = new Vector3(0, 0, 0);

class SdfTerrain extends SignedDistanceField {

    constructor(private _bedrockDepth: number, radius: number) {
        super();
        this.boundingRadius = radius;
    }



    sdFbm(point: Vector3, distToPreviousLayer: number, hillScale: number): number {
        let scale = hillScale;
        
        octiveSample.copyFrom(point);
        for (let i = 0; i <= 11; i++) {
            // evaluate new octave
            // distance to next layer
            const n = SdBase(octiveSample,scale);

            // stop if we are far enough away
            if (Math.abs(distToPreviousLayer + n) > scale / 2)
                break;

            // add
            const t1 = distToPreviousLayer - 0.1 * scale;
            const t2 = 0.2 * scale;
            const nClamped = SmoothMax(n, t1, t2);
            distToPreviousLayer = SmoothMin(nClamped, distToPreviousLayer, t2);

            // prepare next octave
            Vector3.TransformCoordinatesToRef(octiveSample, matrix, octiveSample);
            scale *= 0.33;
        }

        return distToPreviousLayer;
    }

    sample(samplePoint: Vector3): number {
        const point = super.transformPoint(samplePoint);
        const bedrockDist = point.y - this._bedrockDepth;
        const hillScale = 50;
        const result = this.sdFbm(point,bedrockDist,hillScale);
        return result
    }

}

export { SdfTerrain };