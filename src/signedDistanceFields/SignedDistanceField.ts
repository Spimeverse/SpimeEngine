

import { Vector3, Matrix,Quaternion } from "@babylonjs/core/Maths";

// see https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm

const transformedPoint: Vector3 = new Vector3();
const NO_SCALING: Vector3 = Vector3.One();

abstract class SignedDistanceField {
    public get position(): Vector3 {
        return this._position;
    }

    public set position(newPosition: Vector3) {
        this._position = newPosition;
        this._calcMatrix = true;
    }

    public get rotation(): Vector3 {
        return this._rotation;
    }

    public set rotation(newRotation: Vector3) {
        this._rotation = newRotation;
        this._calcMatrix = true;
    }

    private _position: Vector3 = new Vector3;
    private _rotation: Vector3 = new Vector3;
    private _matrix: Matrix = new Matrix();
    private _calcMatrix = true;

    transformPoint(point: Vector3): Vector3 {
        if (this._calcMatrix)
        {
            this._calcMatrix = false;
            const rotationQtr = Quaternion.RotationYawPitchRoll(this.rotation.y, this.rotation.x, this.rotation.z);
            Matrix.ComposeToRef(NO_SCALING,rotationQtr,this._position,this._matrix)
            this._matrix.invert();
        }
        transformedPoint.copyFrom(point);
        Vector3.TransformCoordinatesToRef(point,this._matrix,transformedPoint);
        return transformedPoint;
    }

    abstract sample(point: Vector3): number;

}

class EmptyField extends SignedDistanceField {

    sample(point: Vector3): number {
        return Infinity;
    }
}

const EMPTY_FIELD = new EmptyField();


export { SignedDistanceField,EMPTY_FIELD };