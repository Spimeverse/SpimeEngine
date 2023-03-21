import { Vector3 } from "@babylonjs/core";
import { SignedDistanceField } from "..";

export class SdfFloor extends SignedDistanceField {

        constructor(private _floorDepth: number, radius: number) {
        super();
        this.boundingRadius = radius;
    }

    sample(samplePoint: Vector3): number {
        const point = super.transformPoint(samplePoint);
        return point.y - this._floorDepth;
    }

}