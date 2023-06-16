import { Vector3,Vector2 } from "@babylonjs/core/Maths";
import { SignedDistanceField, RegisterSdfSampleFunction,sdfPool } from "./SignedDistanceField";

// https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
// float sdTorus( vec3 p, vec2 t )
// {
//   vec2 q = vec2(length(p.xz)-t.x,p.y);
//   return length(q)-t.y;
// }

// allocate intermediate vectors once
const q = new Vector2();
const pxz = new Vector2();

const RING_RADIUS_PARAM = 0;
const THICKNESS_PARAM = 1;

// register the sdf sample function
const TorusSampler = RegisterSdfSampleFunction((point: Vector3, sdfParams: Float32Array) => {
    const ringRadius = sdfParams[RING_RADIUS_PARAM];
    const thickness = sdfParams[THICKNESS_PARAM];
    pxz.set(point.x,point.z);
    q.set(pxz.length() - ringRadius,point.y);
    return q.length() - thickness;
});

function MakeSdfTorus(ringRadius: number, thickness: number): SignedDistanceField {
    const sdf =  sdfPool.newItem();
    const boundingRadius = ringRadius + thickness;
    const params = sdf.Setup(TorusSampler,boundingRadius);
    params[RING_RADIUS_PARAM] = ringRadius;
    params[THICKNESS_PARAM] = thickness;
    return sdf;
}


export { MakeSdfTorus };