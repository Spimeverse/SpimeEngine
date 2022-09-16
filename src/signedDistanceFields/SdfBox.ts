import { Vector3 } from "@babylonjs/core/Maths";
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
        const point = super.transformPoint(samplePoint);
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

export { SdfBox };