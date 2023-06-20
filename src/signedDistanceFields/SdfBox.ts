import { Vector3 } from "@babylonjs/core/Maths";
import { SignedDistanceField, sdfPool,RegisterSdfSampleFunction } from "./SignedDistanceField"
import { Max3, MaxVec3, AbsVec3, SubVec3} from "./VectorMath";

// https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
// float sdBox( vec3 p, vec3 b )
// {
//   vec3 q = abs(p) - b;
//   return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
// }

// allocate intermediate vectors once
const q = new Vector3();
const maxq = new Vector3();

const HALF_WIDTH_PARAM = 0;
const HALF_HEIGHT_PARAM = 1;
const HALF_DEPTH_PARAM = 2;

// register the sdf sample function
const BoxSampler = RegisterSdfSampleFunction((point: Vector3, sdfParams: Float32Array) => {
    const halfWidth = sdfParams[HALF_WIDTH_PARAM];
    const halfHeight = sdfParams[HALF_HEIGHT_PARAM];
    const halfDepth = sdfParams[HALF_DEPTH_PARAM];
    AbsVec3(point,q);
    SubVec3(q,halfWidth,halfHeight,halfDepth,q);
    MaxVec3(q,Vector3.Zero(),maxq);
    const d = Max3(q.x,q.y,q.z);
    if (d > 0)
        return maxq.length();
    else
        return d;
});

function MakeSdfBox(width: number, height: number, depth: number): SignedDistanceField {
    const sdf =  sdfPool.newItem();
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const halfDepth = depth / 2;
    const boundingRadius = Math.sqrt((halfWidth * halfWidth) + (halfHeight * halfHeight) + (halfDepth * halfDepth));
    const params = sdf.Setup(BoxSampler,boundingRadius);
    params[HALF_WIDTH_PARAM] = halfWidth;
    params[HALF_HEIGHT_PARAM] = halfHeight;
    params[HALF_DEPTH_PARAM] = halfDepth;
    return sdf;
}

class SdfBox extends SignedDistanceField {

    halfWidth: number;
    halfHeight: number;
    halfDepth: number;

    constructor(width: number, height: number, depth: number) {
        super();
        this.halfWidth = width / 2;
        this.halfHeight = height / 2;
        this.halfDepth = depth / 2;
        this.boundingRadius = Math.sqrt((this.halfWidth * this.halfWidth) + (this.halfHeight * this.halfHeight) + (this.halfDepth * this.halfDepth));
    }

    sample(samplePoint: Vector3): number {
        const point = super.updateTransformPoint(samplePoint);
        AbsVec3(point,q);
        SubVec3(q,this.halfWidth,this.halfHeight,this.halfDepth,q);
        MaxVec3(q,Vector3.Zero(),maxq);
        const d = Max3(q.x,q.y,q.z);
        if (d > 0)
            return maxq.length();
        else
            return d;
    }

}

export { MakeSdfBox };