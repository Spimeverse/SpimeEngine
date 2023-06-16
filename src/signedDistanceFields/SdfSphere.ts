import { Matrix, Vector3 } from "@babylonjs/core/Maths";
import { SignedDistanceField, RegisterSdfSampleFunction, sdfPool } from "./SignedDistanceField"

// see https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
// float sdSphere( vec3 p, float s )
// {
//   return length(p)-s;
// }

const RADIUS_PARAM = 0;

// register the sdf sample function
const SphereSampler = RegisterSdfSampleFunction((point: Vector3, sdfParams: Float32Array) => {
    const radius = sdfParams[RADIUS_PARAM];
    return point.length() - radius;
});

function MakeSdfSphere(radius: number): SignedDistanceField {
    const sdf =  sdfPool.newItem();
    const params = sdf.Setup(SphereSampler,radius);
    params[RADIUS_PARAM] = radius;
    return sdf;
}


export { MakeSdfSphere };