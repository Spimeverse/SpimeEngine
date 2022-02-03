import { Vector3 } from "@babylonjs/core";
import { SignedDistanceField } from "./SignedDistanceField"
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

class SdfBox extends SignedDistanceField {
    width: number;
    height: number;
    depth: number;

    constructor(width: number, height: number, depth: number) {
        super();
        this.width = width / 2;
        this.height = height / 2;
        this.depth = depth / 2;
    }

    sample(samplePoint: Vector3): number {
        const point = super.transformPoint(samplePoint);
        AbsVec3(point,q);
        SubVec3(q,this.width,this.height,this.depth,q);
        MaxVec3(q,Vector3.Zero(),maxq);
        const d = Max3(q.x,q.y,q.z);
        if (d > 0)
            return maxq.length();
        else
            return d;
    }

}

export { SdfBox };