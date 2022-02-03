import { Vector3,Vector2 } from "@babylonjs/core";
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
    tx: number;
    ty: number;

    constructor(tx: number, ty: number) {
        super();
        this.tx = tx;
        this.ty = ty;
    }

    sample(samplePoint: Vector3): number {
        const point = super.transformPoint(samplePoint);
        pxz.set(point.x,point.z);
        q.set(pxz.length() - this.tx,point.y);
        return q.length() - this.ty;
    }

}

export { SdfTorus };