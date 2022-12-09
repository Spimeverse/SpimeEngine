

import { Vector3, Matrix,Quaternion } from "@babylonjs/core/Maths";
import { IhasBounds, SphereBound } from "../World";

// see https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm

const transformedPoint: Vector3 = new Vector3();
const NO_SCALING: Vector3 = Vector3.One();

abstract class SignedDistanceField implements IhasBounds {

    private _position: Vector3 = new Vector3;
    private _newPosition: Vector3 = new Vector3;
    private _rotation: Vector3 = new Vector3;
    private _matrix: Matrix = new Matrix();
    private _calcMatrix = true;
    currentBounds: SphereBound;
    newBounds: SphereBound;
    protected boundingRadius: number;
    
    constructor() {
        this.currentBounds = new SphereBound(0, 0, 0, 0);
        this.newBounds = new SphereBound(0, 0, 0, 0);
        this.boundingRadius = 0;
    }

    public setPosition(x: number, y: number, z: number) {
        this._newPosition.set(x, y, z);
        this.updateBounds();
    }

    copyPositionFrom(position: Vector3) {
        position.copyFrom(this._newPosition);
    }

    positionEquals(position: Vector3): boolean {
        return this._newPosition.equals(position);
    }

    public get rotation(): Vector3 {
        return this._rotation;
    }

    public set rotation(newRotation: Vector3) {
        this._rotation.copyFrom(newRotation);
        this._calcMatrix = true;
    }

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

    updateBounds(): void {
        this.newBounds.set(this._newPosition.x, this._newPosition.y, this._newPosition.z, this.boundingRadius);
        if (this.currentBounds.radius === 0) {
            this.currentBounds.copy(this.newBounds);
            this.commitUpdate();
        }   
    }

    commitUpdate() {
        this._position.copyFrom(this._newPosition);
        this.updateBounds();
        this._calcMatrix = true;
    }
}

class EmptyField extends SignedDistanceField {

    sample(point: Vector3): number {
        return Infinity;
    }
}

class SdfUnion extends SignedDistanceField {

    constructor(public fields: Iterable<SignedDistanceField>) {
        super();
        this.fields = fields;
    }

    sample(point: Vector3): number {
        let minDistance = Infinity;
        for (const field of this.fields) {
            minDistance = Math.min(minDistance, field.sample(point));
        }
        return minDistance;
    }

}

const EMPTY_FIELD = new EmptyField();


export { SignedDistanceField, SdfUnion ,EMPTY_FIELD };