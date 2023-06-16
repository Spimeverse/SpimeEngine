import { Vector3 } from "@babylonjs/core";
import { SignedDistanceField,RegisterSdfSampleFunction,sdfPool } from "..";

// see https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm

const DEPTH_PARAM = 0;

// register the sdf sample function
const FloorSampler = RegisterSdfSampleFunction((point: Vector3, sdfParams: Float32Array) => {
    const depth = sdfParams[DEPTH_PARAM];
    return point.y - depth;
});

function MakeSdfFloor(depth: number): SignedDistanceField {
    const sdf =  sdfPool.newItem();
    const params = sdf.Setup(FloorSampler,depth);
    params[DEPTH_PARAM] = depth;
    return sdf;
}

export { MakeSdfFloor };