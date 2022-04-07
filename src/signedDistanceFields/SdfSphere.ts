import { Matrix, Vector3 } from "@babylonjs/core/Maths";
import { SignedDistanceField } from "./SignedDistanceField"

// see https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
// float sdSphere( vec3 p, float s )
// {
//   return length(p)-s;
// }


class SdfSphere extends SignedDistanceField {
    
    radius: number;

    constructor(radius: number) {
        super();
        this.radius = radius;
    }

    sample(samplePoint: Vector3): number {
        const point = super.transformPoint(samplePoint);
        return point.length() - this.radius;
    }

}

export { SdfSphere };