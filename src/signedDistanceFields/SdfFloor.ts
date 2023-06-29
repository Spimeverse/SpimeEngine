import { Vector3 } from "@babylonjs/core";
import { SignedDistanceField,RegisterSdfSampleFunction,sdfPool } from "..";

// see https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm

const DEPTH_PARAM = 0;

// register the sdf sample function
const FloorSampler = RegisterSdfSampleFunction((sdf:SignedDistanceField,point: Vector3) => {
    const depth = sdf.getParam(DEPTH_PARAM);
    return point.y - depth;
});

function MakeSdfFloor(depth: number): SignedDistanceField {
    const sdf =  sdfPool.newItem();
    const params = sdf.Setup(FloorSampler,depth);
    sdf.setParam(DEPTH_PARAM, depth);
    return sdf;
}

export { MakeSdfFloor };