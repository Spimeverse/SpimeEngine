import { Vector2, Vector3 } from "@babylonjs/core/Maths";
import { SignedDistanceField,RegisterSdfSampleFunction,sdfPool } from "./SignedDistanceField";
import { Max2, Min2, MaxVec2, AbsVec2} from "./VectorMath";

// https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
// float sdCappedCylinder( vec3 p, float h, float r )
// {
//   vec2 d = abs(vec2(length(p.xz),p.y)) - vec2(h,r);
//   return min(max(d.x,d.y),0.0) + length(max(d,0.0));
// }

// allocate intermediate vectors once
const pxz = new Vector2();
const pxzy = new Vector2();
const d = new Vector2();
const dmax = new Vector2();

const HALF_HEIGHT_PARAM = 0;
const RADIUS_PARAM = 1;

// register the sdf sample function
const CylinderSampler = RegisterSdfSampleFunction((point: Vector3, sdfParams: Float32Array) => {
    const halfHeight = sdfParams[HALF_HEIGHT_PARAM];
    const radius = sdfParams[RADIUS_PARAM];
    pxz.set(point.x,point.z);
    pxzy.set(pxz.length(),point.y);
    AbsVec2(pxzy,d);
    d.subtractInPlace(new Vector2(halfHeight,radius));
    MaxVec2(d,Vector2.Zero(),dmax)
    return Min2(Max2(d.x,d.y),0) + dmax.length();
});

function MakeSdfCylinder(height: number, radius: number): SignedDistanceField {
    const sdf =  sdfPool.newItem();
    const halfHeight = height / 2;
    const boundingRadius = Math.sqrt((halfHeight * halfHeight) + (radius * radius));
    const params = sdf.Setup(CylinderSampler,boundingRadius);
    params[HALF_HEIGHT_PARAM] = halfHeight;
    params[RADIUS_PARAM] = radius;
    return sdf;
}

export { MakeSdfCylinder };