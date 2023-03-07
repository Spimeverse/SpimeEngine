import { Vector3,Matrix } from "@babylonjs/core/Maths";
import { SignedDistanceField } from "./SignedDistanceField";

// https://iquilezles.org/articles/fbmsdf/

// allocate intermediate vectors once
const p2 = new Vector3(0, 0, 0);
const gridPeriod = new Vector3(1, 1, 1);
const gridSphereDist = new Vector3(0, 0, 0);


function ConvertPositionToRandomValue(vec: Vector3): number {
    let x = vec.x * 123.4567 + vec.y * 234.5678 + vec.z * 345.6789;
    x = Math.sin(x) * 43758.5453123;
    return (x - Math.floor(x));
}



function SphereDomainRepeat(indexOfGrid: Vector3, fractionOfGridCell: Vector3, gridSize: number,gridOffsetX: number,gridOffsetY: number,gridOffsetZ: number) {
    gridPeriod.copyFrom(indexOfGrid);
    gridPeriod.addInPlaceFromFloats(gridOffsetX,gridOffsetY,gridOffsetZ);
    // random radius at grid vertex 
    const halfGridSize = gridSize / 2;
    const rad = halfGridSize * ConvertPositionToRandomValue(gridPeriod);
    
    // distance to sphere at grid vertex 
    gridSphereDist.set(Math.abs(fractionOfGridCell.x - halfGridSize), Math.abs(fractionOfGridCell.y - halfGridSize), Math.abs(fractionOfGridCell.z - halfGridSize));
    //gridSphereDist.addInPlaceFromFloats(gridOffsetX,gridOffsetY,gridOffsetZ);
    return gridSphereDist.length() - rad;
}

function SmoothMax(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0.0);
  return Math.max(a, b) + h * h * 0.25 / k;
}

// https://iquilezles.org/articles/smin/
function SmoothMin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0.0);
  return Math.min(a, b) - h * h * 0.25 / k;
}


function SdBase(p: Vector3): number {
        // visualize grid f1 = nearest grid, f2 = fraction of grid
        // https://graphtoy.com/?f1(x,t)=floor(x/10)*10&v1=true&f2(x,t)=x-f1(x,t)&v2=true&f3(x,t)=&v3=false&f4(x,t)=&v4=false&f5(x,t)=&v5=false&f6(x,t)=&v6=false&grid=1&coords=0,0,21.150790628953274
        const gridSize = 1;
        const nearestGrid = new Vector3(Math.floor(p.x / gridSize) * gridSize, Math.floor(p.y / gridSize) * gridSize, Math.floor(p.z / gridSize) * gridSize);
        const fractionOfGrid = new Vector3((p.x - nearestGrid.x) , (p.y - nearestGrid.y) , (p.z - nearestGrid.z) );
        // distance to the 8 corners spheres
        return Math.min(
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, 0, 0, 0),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, 0, 0, 1),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, 0, 1, 0),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, 0, 1, 1),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, 1, 0, 0),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, 1, 0, 1),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, 1, 1, 0),
            SphereDomainRepeat(nearestGrid, fractionOfGrid, gridSize, 1, 1, 1)
        );
        //return SphereDomainRepeat(nearestGrid, fractionOfGrid, 10,0,0,0);
}

const mat = Matrix.Identity().scale(2);
        
class SdfTerrain extends SignedDistanceField {

    constructor(private _bedrockDepth: number, radius: number) {
        super();
        this.boundingRadius = radius;
    }



    sdFbm(p: Vector3, distToPreviousLayer: number): number {
        let scale = 1.0;

        
        for (let i = 0; i <= 0; i++) {
            // evaluate new octave
            const n = scale * SdBase(p);

            // add
            const t1 = distToPreviousLayer - 0.2 * scale;
            const t2 = 0.5 * scale;
            const nClamped = SmoothMax(n, t1, t2);
            distToPreviousLayer = SmoothMin(nClamped, distToPreviousLayer, t2);

            // prepare next octave
            //p = Vector3.TransformCoordinates(p, mat);
            scale *= 0.5;
        }

        return distToPreviousLayer;
        }

    sample(samplePoint: Vector3): number {
        const point = super.transformPoint(samplePoint);
        const bedrockDist = point.y - this._bedrockDepth;
        const result = Math.min(this.sdFbm(point,bedrockDist), bedrockDist);
        return result
    }

}

export { SdfTerrain };