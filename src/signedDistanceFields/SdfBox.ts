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
const BoxSampler = RegisterSdfSampleFunction((sdf:SignedDistanceField,point: Vector3) => {
    const halfWidth = sdf.getParam(HALF_WIDTH_PARAM);
    const halfHeight = sdf.getParam(HALF_HEIGHT_PARAM);
    const halfDepth = sdf.getParam(HALF_DEPTH_PARAM);
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
    sdf.setParam(HALF_WIDTH_PARAM, halfWidth);
    sdf.setParam(HALF_HEIGHT_PARAM, halfHeight);
    sdf.setParam(HALF_DEPTH_PARAM, halfDepth);
    return sdf;
}


export { MakeSdfBox };