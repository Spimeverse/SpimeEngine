

import { Vector3, Matrix,Quaternion } from "@babylonjs/core/Maths";
import { IhasBounds, SphereBound } from "../World";
import { ResourcePool, IhasPoolId } from "../Collection/ResourcePool";

// see https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm

const transformedPoint: Vector3 = new Vector3();
const NO_SCALING: Vector3 = Vector3.One();


class SignedDistanceField implements IhasBounds , IhasPoolId {
    poolId = -1;
    private _position: Vector3 = new Vector3;
    private _newPosition: Vector3 = new Vector3;
    private _rotation: Vector3 = new Vector3;
    private _matrix: Matrix = new Matrix();
    private _calcMatrix = true;
    currentBounds: SphereBound;
    newBounds: SphereBound;
    protected boundingRadius: number;
    sdfSampler: number;
    protected sdfParams: Float32Array = new Float32Array(10);
    
    public constructor() {
        this.currentBounds = new SphereBound(0, 0, 0, 0);
        this.newBounds = new SphereBound(0, 0, 0, 0);
        this.boundingRadius = 0;
        this.sdfSampler = EmptySampler;
    }

    Setup(sampleID: number, boundingRadius: number) {
        this.sdfSampler = sampleID;
        this.boundingRadius = boundingRadius;
        return this.sdfParams;
    }

    Reset() {
        this._position.set(0, 0, 0);
        this._newPosition.set(0, 0, 0);
        this._rotation.set(0, 0, 0);
        this._calcMatrix = true;
        this.currentBounds.set(0, 0, 0, 0);
        this.newBounds.set(0, 0, 0, 0);
        this.boundingRadius = 0;
        this.sdfSampler = EmptySampler;
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

    sample(point: Vector3) {
        this.transformPoint(point);
        return sdfSampleFunctions[this.sdfSampler](transformedPoint, this.sdfParams);
    }

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


// pool of SDFs
const sdfPool = new ResourcePool<SignedDistanceField>(
    () => new SignedDistanceField(),
    (sdf) => sdf.Reset(),1000);

// store the sdf sample functions in an array so we can reference them by index
type SdfSampleFunction = (point: Vector3, params: Float32Array) => number;
const sdfSampleFunctions: SdfSampleFunction[] = [];

// register a new sdf sample function and return its index
function RegisterSdfSampleFunction(func: SdfSampleFunction) {
  sdfSampleFunctions.push(func);
  return sdfSampleFunctions.length - 1;
}


// register the empty sdf sample function
const EmptySampler = RegisterSdfSampleFunction((point: Vector3, sdfParams: Float32Array) => {
    return Infinity;
});

// get an empty sdf
function MakeSdfEmpty(): SignedDistanceField {
    const item =  sdfPool.newItem();
    item.sdfSampler = EmptySampler;
    return item;
}

const EMPTY_FIELD = MakeSdfEmpty();

// register the union sdf sample function
const UnionSampler = RegisterSdfSampleFunction((point: Vector3, sdfParams: Float32Array) => {
    let minDistance = Infinity;
    for (let i = 0; sdfParams[i]>=0 ; i++) {
        const sdf = sdfPool.getItem(sdfParams[i]);
        if (sdf != null)
        {
        const distance = sdf.sample(point);
        if (distance < minDistance)
            minDistance = distance;
        }
    }
    return minDistance;
});

// get a union sdf
function MakeSdfUnion(fields: Iterable<SignedDistanceField>): SignedDistanceField {
    const sdf = sdfPool.newItem();
    const params = sdf.Setup(UnionSampler, 0);
    let i = 0;
    for (const field of fields) {
        if (i >= params.length)
            throw new Error("Too many sdf fields for single union sdf");
        params[i++] = field.poolId;
    }
    return sdf;
}


export { 
    SignedDistanceField, 
    sdfPool,
    RegisterSdfSampleFunction,
    MakeSdfEmpty, 
    MakeSdfUnion,
    EMPTY_FIELD };