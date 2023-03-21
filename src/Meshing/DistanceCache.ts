import { Vector3 } from "@babylonjs/core";
import { Chunk, SignedDistanceField } from "..";
import { Bounds, IhasBounds } from "../World";
import { AxisAlignedBoxBound } from "../World";

const worldPosition = new Vector3();
const samplePosition = new Vector3();
const roundedPosition = new Vector3();
const voxelPosition = new Vector3();

let doneDistances = new Float32Array(0);

class DistanceCache {
    private _cachedDistances: number[] = [];
    private _cachedPosition: number[] = [];
    private _parent: DistanceCache | null = null;
    private _children: DistanceCache[] = [];

    cacheDistance(x: number, y: number, z: number, distance: number) {
        this._cachedDistances.push(distance);
        this._cachedPosition.push(x,y,z);
    }

    addChild(child: DistanceCache) {
        this._children.push(child);
    }

    addParent(parent: DistanceCache) {
        this._parent = parent;
    }

    isEmpty(): boolean {
        if (this._parent ||
            this._children.length > 0 ||
            this._cachedDistances.length > 0) {
            return false;
        }
        return true;
    }

    getPositions(): number[] {
        return this._cachedPosition;
    }

    getDistances() {
        return this._cachedDistances;
    }

    getCachedCount() {
        return this._cachedDistances.length;
    }

    /// <summary>
    /// Fill in missing distances from the parent or children
    /// by sampling the sdf around the known distances
    /// </summary>
    fillIn(chunk: Chunk, sdf: SignedDistanceField) {
        if (this._cachedDistances.length)
            return;
        
        if (this._parent) {
            this._fillInFromParent(chunk, sdf,this._parent.getPositions(),this._parent.getDistances());
            this._parent = null;
        }
        else {
            this._fillInFromChildren(chunk, sdf);
            this._children.length = 0;
        }
    }
    
    private _fillInFromParent(chunk: Chunk, sdf: SignedDistanceField,parentPositions: number[], parentDistances: number[]) {
        for (let i = 0; i < parentDistances.length; i++) {
            const posIndex = i * 3
            worldPosition.set(parentPositions[posIndex],parentPositions[posIndex + 1], parentPositions[posIndex + 2]);
            this.cacheDistance(worldPosition.x, worldPosition.y, worldPosition.z, parentDistances[i]);

            const voxelSize = chunk.getVoxelSize();
            this._sampleOffset(0, 1, 0, sdf,voxelSize);
            this._sampleOffset(1, 0, 0, sdf,voxelSize);
            this._sampleOffset(1, 1, 0, sdf,voxelSize);

            this._sampleOffset(0, 0, 1, sdf,voxelSize);
            this._sampleOffset(0, 1, 1, sdf,voxelSize);
            this._sampleOffset(1, 0, 1, sdf,voxelSize);
            this._sampleOffset(1, 1, 1, sdf,voxelSize);
        }
    }
        
    private _fillInFromChildren(chunk: Chunk, sdf: SignedDistanceField) {
        if (doneDistances.length < chunk.getNumSamples()) {
            doneDistances = new Float32Array(chunk.getNumSamples(),);
        }
        doneDistances.fill(0);
        const voxelSize = chunk.getVoxelSize();
        // first pass get mark all known distances from children
        for (let i = 0; i < this._children.length; i++) {
            const child = this._children[i];
            const childDistances = child.getDistances();
            for (let j = 0; j < childDistances.length; j++) {
                const positionIndex = j * 3;
                worldPosition.set(child._cachedPosition[positionIndex], child._cachedPosition[positionIndex + 1], child._cachedPosition[positionIndex + 2]);
                // check if world position is divisible by voxelSize
                const offsetPosX = worldPosition.x % voxelSize;
                const offsetPosY = worldPosition.y % voxelSize;
                const offsetPosZ = worldPosition.z % voxelSize;
                roundedPosition.set(worldPosition.x - offsetPosX, worldPosition.y - offsetPosY, worldPosition.z - offsetPosZ);
                if (offsetPosX == 0 && offsetPosY == 0 && offsetPosZ == 0) {
                    chunk.worldSpaceToVoxelSpace(roundedPosition, voxelPosition);
                    const index = chunk.voxelIndex(voxelPosition.x, voxelPosition.y, voxelPosition.z);
                    doneDistances[index] = 1;
                    this.cacheDistance(roundedPosition.x, roundedPosition.y, roundedPosition.z, childDistances[j]);
                }
            }
        }
        // second pass get missing distances from sdf
        for (let i = 0; i < this._children.length; i++) {
            const child = this._children[i];
            const childDistances = child.getDistances();
            for (let j = 0; j < childDistances.length; j++) {
                const positionIndex = j * 3;
                worldPosition.set(child._cachedPosition[positionIndex], child._cachedPosition[positionIndex + 1], child._cachedPosition[positionIndex + 2]);
                // check if world position is divisible by voxelSize
                const offsetPosX = worldPosition.x % voxelSize;
                const offsetPosY = worldPosition.y % voxelSize;
                const offsetPosZ = worldPosition.z % voxelSize;
                roundedPosition.set(worldPosition.x - offsetPosX, worldPosition.y - offsetPosY, worldPosition.z - offsetPosZ);
                chunk.worldSpaceToVoxelSpace(roundedPosition, voxelPosition);
                // check all 8 corners of voxel and sample if not used
                let index = chunk.voxelIndex(voxelPosition.x, voxelPosition.y, voxelPosition.z);
                if (doneDistances[index] == 0) {
                    chunk.voxelSpaceToWorldSpace(voxelPosition, samplePosition);
                    this.cacheDistance(samplePosition.x, samplePosition.y, samplePosition.z, sdf.sample(roundedPosition));
                    doneDistances[index] = 1;
                }
                index = chunk.voxelIndex(voxelPosition.x + 1, voxelPosition.y, voxelPosition.z);
                if (doneDistances[index] == 0) {
                    chunk.voxelSpaceToWorldSpace(voxelPosition, samplePosition);
                    this.cacheDistance(samplePosition.x, samplePosition.y, samplePosition.z, sdf.sample(roundedPosition));
                    doneDistances[index] = 1;
                }
                index = chunk.voxelIndex(voxelPosition.x, voxelPosition.y + 1, voxelPosition.z);
                if (doneDistances[index] == 0) {
                    chunk.voxelSpaceToWorldSpace(voxelPosition, samplePosition);
                    this.cacheDistance(samplePosition.x, samplePosition.y, samplePosition.z, sdf.sample(roundedPosition));
                    doneDistances[index] = 1;
                }
                index = chunk.voxelIndex(voxelPosition.x, voxelPosition.y, voxelPosition.z + 1);
                if (doneDistances[index] == 0) {
                    chunk.voxelSpaceToWorldSpace(voxelPosition, samplePosition);
                    this.cacheDistance(samplePosition.x, samplePosition.y, samplePosition.z, sdf.sample(roundedPosition));
                    doneDistances[index] = 1;
                }
                index = chunk.voxelIndex(voxelPosition.x + 1, voxelPosition.y + 1, voxelPosition.z);
                if (doneDistances[index] == 0) {
                    chunk.voxelSpaceToWorldSpace(voxelPosition, samplePosition);
                    this.cacheDistance(samplePosition.x, samplePosition.y, samplePosition.z, sdf.sample(roundedPosition));
                    doneDistances[index] = 1;
                }
                index = chunk.voxelIndex(voxelPosition.x + 1, voxelPosition.y, voxelPosition.z + 1);
                if (doneDistances[index] == 0) {
                    chunk.voxelSpaceToWorldSpace(voxelPosition, samplePosition);
                    this.cacheDistance(samplePosition.x, samplePosition.y, samplePosition.z, sdf.sample(roundedPosition));
                    doneDistances[index] = 1;
                }
                index = chunk.voxelIndex(voxelPosition.x, voxelPosition.y + 1, voxelPosition.z + 1);
                if (doneDistances[index] == 0) {
                    chunk.voxelSpaceToWorldSpace(voxelPosition, samplePosition);
                    this.cacheDistance(samplePosition.x, samplePosition.y, samplePosition.z, sdf.sample(roundedPosition));
                    doneDistances[index] = 1;
                }
                index = chunk.voxelIndex(voxelPosition.x + 1, voxelPosition.y + 1, voxelPosition.z + 1);
                if (doneDistances[index] == 0) {
                    chunk.voxelSpaceToWorldSpace(voxelPosition, samplePosition);
                    this.cacheDistance(samplePosition.x, samplePosition.y, samplePosition.z, sdf.sample(roundedPosition));
                    doneDistances[index] = 1;
                }
                
            }
        }
    }
    
    private _sampleOffset(x: number, y: number, z: number, sdf: SignedDistanceField,voxelSize: number) {  
        samplePosition.set(
            worldPosition.x + x * voxelSize,
            worldPosition.y + y * voxelSize,
            worldPosition.z + z * voxelSize);
        this.cacheDistance(samplePosition.x, samplePosition.y, samplePosition.z, sdf.sample(samplePosition));
    }
}

export { DistanceCache }