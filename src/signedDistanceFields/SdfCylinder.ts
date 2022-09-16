import { Vector2, Vector3 } from "@babylonjs/core/Maths";
import { SignedDistanceField } from "./SignedDistanceField";
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

class SdfCylinder extends SignedDistanceField {
    hr: Vector2 = new Vector2();

    constructor(height: number, radius: number) {
        super();
        const halfHeight = height / 2;
        this.hr.set(halfHeight, radius);
        this.boundingRadius = Math.sqrt((halfHeight * halfHeight) + (radius * radius));
    }

    sample(point: Vector3): number {
        pxz.set(point.x,point.z);
        pxzy.set(pxz.length(),point.y);
        AbsVec2(pxzy,d);
        d.subtractInPlace(this.hr);
        MaxVec2(d,Vector2.Zero(),dmax)
        return Min2(Max2(d.x,d.y),0) + dmax.length();
    }

}

export { SdfCylinder };