import { Vector3,Vector2 } from "@babylonjs/core/Maths";
import { SignedDistanceField } from "./SignedDistanceField";

// https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
// float sdTorus( vec3 p, vec2 t )
// {
//   vec2 q = vec2(length(p.xz)-t.x,p.y);
//   return length(q)-t.y;
// }

// allocate intermediate vectors once
const q = new Vector2();
const pxz = new Vector2();

class SdfTorus extends SignedDistanceField {

    ringRadius: number;
    thickness: number;

    constructor(ringRadius: number, thickness: number) {
        super();
        this.ringRadius = ringRadius;
        this.thickness = thickness;
        this.boundingRadius = ringRadius + thickness;
    }

    sample(samplePoint: Vector3): number {
        const point = super.transformPoint(samplePoint);
        pxz.set(point.x,point.z);
        q.set(pxz.length() - this.ringRadius,point.y);
        return q.length() - this.thickness;
    }

}

export { SdfTorus };