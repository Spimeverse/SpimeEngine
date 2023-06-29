

import { Vector3, Matrix,Quaternion } from "@babylonjs/core/Maths";
import { IhasBounds, SphereBound } from "../World";
import { ResourcePool, IhasPoolId } from "../Collection/ResourcePool";
import { SparseSet } from "..";

// see https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm

const NO_SCALING: Vector3 = Vector3.One();

const SDF_PARAMS_COUNT = 10;
const MAX_SDF_COUNT = 1000;

let bufferIndex = 0;
const SDF_BUFFER_OFFSETS = {
    POS_OFFSET_X: bufferIndex++,
    POS_OFFSET_Y: bufferIndex++,
    POS_OFFSET_Z: bufferIndex++,
    ROT_OFFSET_X: bufferIndex++,
    ROT_OFFSET_Y: bufferIndex++,
    ROT_OFFSET_Z: bufferIndex++,
    BOUNDING_RADIUS: bufferIndex++,
    SAMPLER: bufferIndex++,
    PARAMS: bufferIndex++,
}

const SDF_BUFFER_ITEM_SIZE = SDF_BUFFER_OFFSETS.PARAMS + SDF_PARAMS_COUNT;

const sdfSharedBuffer = new SharedArrayBuffer(SDF_BUFFER_ITEM_SIZE * MAX_SDF_COUNT * 4);
const sdfFloatBuffer = new Float32Array(sdfSharedBuffer);

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
    private _transformedPoint: Vector3 = new Vector3();
    private _bufferOffset = 0;
    
    public constructor() {
        this.currentBounds = new SphereBound(0, 0, 0, 0);
        this.newBounds = new SphereBound(0, 0, 0, 0);
        this.boundingRadius = 0;
        this.sdfSampler = EmptySampler;
    }

    Setup(sampleID: number, boundingRadius: number, bufferIndex: number= -1) {
        this.sdfSampler = sampleID;
        this.boundingRadius = boundingRadius;
        if (bufferIndex === -1) {
            bufferIndex = this.poolId;
        }
        this._bufferOffset = bufferIndex * SDF_BUFFER_ITEM_SIZE;
        this.setBaseParam(SDF_BUFFER_OFFSETS.SAMPLER, sampleID);
        this.setBaseParam(SDF_BUFFER_OFFSETS.BOUNDING_RADIUS, boundingRadius);
    }

    setBaseParam(index: number, value: number) {
        sdfFloatBuffer[this._bufferOffset + index] = value;
    }

    getBaseParam(index: number): number {
        return sdfFloatBuffer[this._bufferOffset + index];
    }

    setParam(index: number, value: number) {
        sdfFloatBuffer[this._bufferOffset + SDF_BUFFER_OFFSETS.PARAMS + index] = value;
    }

    getParam(index: number): number {   
        return sdfFloatBuffer[this._bufferOffset + SDF_BUFFER_OFFSETS.PARAMS + index];
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

    updateTransformPoint(point: Vector3){
        if (this._calcMatrix)
        {
            this._calcMatrix = false;
            const rotationQtr = Quaternion.RotationYawPitchRoll(this.rotation.y, this.rotation.x, this.rotation.z);
            Matrix.ComposeToRef(NO_SCALING,rotationQtr,this._position,this._matrix)
            this._matrix.invert();
        }
        this._transformedPoint.copyFrom(point);
        Vector3.TransformCoordinatesToRef(point,this._matrix,this._transformedPoint);
    }

    sample(point: Vector3) {
        this.updateTransformPoint(point);
        return sdfSampleFunctions[this.sdfSampler](this,this._transformedPoint);
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

class SdfUnionFromSparseSet extends SignedDistanceField {

    constructor(protected sparseSet: SparseSet) {
        super();
    }

    sample(point: Vector3) {
        let minDistance = Infinity;
        const sdfIds = this.sparseSet.allIndex();
        const usedCount = this.sparseSet.usedCount;
        for (let i = 0; i < usedCount; i++) {
            const sdf = sdfPool.getItem(sdfIds[i]);
            if (sdf != null) {
                const distance = sdf.sample(point);
                if (distance < minDistance)
                    minDistance = distance;
            }
        }
        return minDistance;
    }
}

// pool of SDFs
const sdfPool = new ResourcePool<SignedDistanceField>(
    () => new SignedDistanceField(),
    (sdf) => sdf.Reset(),1000);

// store the sdf sample functions in an array so we can reference them by index
type SdfSampleFunction = (sdf:SignedDistanceField, point: Vector3) => number;
const sdfSampleFunctions: SdfSampleFunction[] = [];

// register a new sdf sample function and return its index
function RegisterSdfSampleFunction(func: SdfSampleFunction) {
  sdfSampleFunctions.push(func);
  return sdfSampleFunctions.length - 1;
}


// register the empty sdf sample function
const EmptySampler = RegisterSdfSampleFunction((sdf:SignedDistanceField, point: Vector3) => {
    return Infinity;
});

// get an empty sdf
function MakeSdfEmpty(): SignedDistanceField {
    const item =  sdfPool.newItem();
    item.sdfSampler = EmptySampler;
    return item;
}

const EMPTY_FIELD = MakeSdfEmpty();

const NUM_UNION_FIELDS_PARAM = 0;

// register the union sdf sample function
const UnionSampler = RegisterSdfSampleFunction((sdf: SignedDistanceField, point: Vector3) => {
    debugger;
    let minDistance = Infinity;
    let numFields = sdf.getParam(NUM_UNION_FIELDS_PARAM);
    for (let i = 1; i<=numFields; i++) {
        const childSdf = sdfPool.getItem(sdf.getParam(NUM_UNION_FIELDS_PARAM+i));
        if (childSdf != null)
        {
        const distance = childSdf.sample(point);
        if (distance < minDistance)
            minDistance = distance;
        }
    }
    return minDistance;
});

// get a union sdf
function MakeSdfUnion(...fields: SignedDistanceField[]): SignedDistanceField {
    debugger;
    const sdf = sdfPool.newItem();
    const params = sdf.Setup(UnionSampler, 0);
    if (fields.length > SDF_PARAMS_COUNT)
        throw new Error("Too many sdf fields for single union sdf");
    sdf.setParam(NUM_UNION_FIELDS_PARAM, fields.length);
    for (let i = 1; i <= fields.length; i++) {
        const field = fields[i-1];
        sdf.setParam(NUM_UNION_FIELDS_PARAM+i, field.poolId);
    }
    return sdf;
}


export { 
    SignedDistanceField, 
    SdfUnionFromSparseSet,
    sdfPool,
    RegisterSdfSampleFunction,
    MakeSdfEmpty, 
    MakeSdfUnion,
    EMPTY_FIELD,
    sdfSharedBuffer,
    sdfFloatBuffer };