import { SignedDistanceField } from "..";
import { Bounds, IhasBounds } from "../World";
import { AxisAlignedBoxBound } from "../World";

class DistanceCache implements IhasBounds {
    currentBounds: Bounds;
    private _cachedDistances: number[] = [];
    private _cachedVoxelIndex: number[] = [];
    private _parent: DistanceCache = EMPTY_DISTANCE_CACHE;
    private _children: DistanceCache[] = [];

    constructor(bounds: AxisAlignedBoxBound) {
        this.currentBounds = bounds;
    }

    cacheDistance(voxelIndex: number, distance: number) {
        this._cachedDistances.push(distance);
        this._cachedVoxelIndex.push(voxelIndex);
    }

    addChild(child: DistanceCache) {
        this._children.push(child);
    }

    addParent(parent: DistanceCache) {
        this._parent = parent;
    }

    isEmpty(): boolean {
        if (this._parent != EMPTY_DISTANCE_CACHE ||
            this._children.length > 0 ||
            this._cachedDistances.length > 0) {
            return false;
        }
        return true;
    }

    getVoxelIndices(): number[] {
        return this._cachedVoxelIndex;
    }

    fillInGaps(field: SignedDistanceField) {
        throw new Error("Method not implemented.");
    }

    getDistances() {
        return this._cachedDistances;
    }

}

const EMPTY_DISTANCE_CACHE = new DistanceCache(new AxisAlignedBoxBound(0, 0, 0, 0, 0, 0));

export { DistanceCache, EMPTY_DISTANCE_CACHE }