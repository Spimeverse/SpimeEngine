import { Max3, MaxVec3, AbsVec3, SubVec3 } from "../signedDistanceFields/VectorMath";
import { Vector3 } from "@babylonjs/core";

interface IhasBounds {
    currentBounds: Bounds;
}

enum BoundTypes {
    sphereBound,
    axisAlignedBoxBound
}

abstract class Bounds {
    copy(newBounds: Bounds) {
        if (newBounds.boundType !== this.boundType) {
            throw new Error("Bounds.copyFrom: newBounds.boundType !== this.boundType");
        }
        else {
            if (this.boundType == BoundTypes.sphereBound) {
                (this as unknown as SphereBound).copy(newBounds as SphereBound);
            }
            else if (this.boundType == BoundTypes.axisAlignedBoxBound) {
                (this as unknown as AxisAlignedBoxBound).copy(newBounds as AxisAlignedBoxBound);
            }
            else
                throw new Error("Bounds.copyFrom: unknown bound type");
        }
    }

    overlaps(otherBounds: Bounds): boolean {
        if (this.boundType == otherBounds.boundType) {
            if (this.boundType == BoundTypes.sphereBound) {
                return (this as unknown as SphereBound).overlapSphere(otherBounds as SphereBound);
            }
            else if (this.boundType == BoundTypes.axisAlignedBoxBound) {
                return (this as unknown as AxisAlignedBoxBound).overlapAABB(otherBounds as AxisAlignedBoxBound);
            }
            else
                throw new Error("Bounds.overlaps: unknown bound type");
        }
        else {
            if (this.boundType == BoundTypes.axisAlignedBoxBound) {
                return (this as unknown as AxisAlignedBoxBound).overlapSphere(otherBounds as SphereBound);
            }
            else if (otherBounds.boundType == BoundTypes.axisAlignedBoxBound) {
                return (otherBounds as unknown as AxisAlignedBoxBound).overlapSphere(this as unknown as SphereBound);
            }
            else
                throw new Error("Bounds.overlaps: unknown bound type");
        }
    }

    abstract get extent(): number;
    abstract get minX(): number;
    abstract get minY(): number;
    abstract get minZ(): number;
    abstract get maxX(): number;
    abstract get maxY(): number;
    abstract get maxZ(): number;

    abstract toAABBRef(aabb: AxisAlignedBoxBound): void;
 
    public constructor(public boundType: BoundTypes) {

    }

}

class SphereBound extends Bounds {

    // TODO this isn't right, it should be radius *2 , fix it
    // it appears we assume it's the radius somewhere
    get extent(): number {
        return this.radius;
    }

    radiusSquared: number;

    /**
     * 
     * @param xPos 
     * @param yPos 
     * @param zPos 
     * @param radiusSquared We can avoid doing square roots by storing and using the squared radius.
     */
    public constructor(public xPos: number, public yPos: number, public zPos: number, public radius: number) {
        super(BoundTypes.sphereBound);
        this.radiusSquared = radius * radius;
    }

    copy(newBounds: SphereBound) {
        this.xPos = newBounds.xPos;
        this.yPos = newBounds.yPos;
        this.zPos = newBounds.zPos;
        this.radius = newBounds.radius;
        this.radiusSquared = newBounds.radiusSquared;
    }


    set(xPos: number, yPos: number, zPos: number, radius: number) {
        this.xPos = xPos;
        this.yPos = yPos;
        this.zPos = zPos;
        this.radius = radius;
        this.radiusSquared = radius * radius;
    }

    overlapSphere(otherSphere: SphereBound): boolean {
        const dx = otherSphere.xPos - this.xPos;
        const dy = otherSphere.yPos - this.yPos;
        const dz = otherSphere.zPos - this.zPos;
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        const radiusSum = this.radius + otherSphere.radius;
        return distanceSquared <= radiusSum * radiusSum;
    }

    toAABBRef(aabb: AxisAlignedBoxBound): void {
        aabb.set(
            this.xPos - this.radius, this.yPos - this.radius, this.zPos - this.radius,
            this.xPos + this.radius, this.yPos + this.radius, this.zPos + this.radius);
    }

    get minX(): number {
        return this.xPos - this.radius;
    }

    get minY(): number {
        return this.yPos - this.radius;
    }

    get minZ(): number {
        return this.zPos - this.radius;
    }

    get maxX(): number {
        return this.xPos + this.radius;
    }

    get maxY(): number {
        return this.yPos + this.radius;
    }

    get maxZ(): number {
        return this.zPos + this.radius;
    }

    public toString(): string {
        return `[${this.xPos - this.radius} ${this.yPos - this.radius} ${this.zPos - this.radius} ${this.xPos + this.radius} ${this.yPos + this.radius} ${this.zPos + this.radius}]`;
    }
}


// https://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
// float sdBox( vec3 p, vec3 b )
// {
//   vec3 q = abs(p) - b;
//   return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
// }

// allocate intermediate vectors once
const q = new Vector3();
const maxQ = new Vector3();

class AxisAlignedBoxBound extends Bounds {
 
    public constructor(
        public minX: number = 0, public minY: number = 0, public minZ: number = 0,
        public maxX: number = 0, public maxY: number = 0, public maxZ: number = 0) {
        super(BoundTypes.axisAlignedBoxBound);
    }

    reset() {
        this.minX = this.minY = this.minZ = this.maxX = this.maxY = this.maxZ = 0;
    }

    public set(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
        this.minX = minX;
        this.minY = minY;
        this.minZ = minZ;
        this.maxX = maxX;
        this.maxY = maxY;
        this.maxZ = maxZ;
    }

    public clone (): AxisAlignedBoxBound {
        const newBounds = new AxisAlignedBoxBound();
        newBounds.minX = this.minX;
        newBounds.minY = this.minY;
        newBounds.minZ = this.minZ;
        newBounds.maxX = this.maxX;
        newBounds.maxY = this.maxY;
        newBounds.maxZ = this.maxZ;
        return newBounds;
    }

    public toAABBRef(aabb: AxisAlignedBoxBound): void {
        aabb.copy(this);
    }

    public copy(b: AxisAlignedBoxBound): void {
        this.minX = b.minX;
        this.minY = b.minY;
        this.minZ = b.minZ;
        this.maxX = b.maxX;
        this.maxY = b.maxY;
        this.maxZ = b.maxZ;
    }

    
    public copyFromSphere(bounds: SphereBound) {
        this.minX = bounds.xPos - bounds.radius;
        this.minY = bounds.yPos - bounds.radius;
        this.minZ = bounds.zPos - bounds.radius;
        this.maxX = bounds.xPos + bounds.radius;
        this.maxY = bounds.yPos + bounds.radius;
        this.maxZ = bounds.zPos + bounds.radius;
    }

    public overlapSphere(sphere: SphereBound): boolean {
        // returns if box overlaps sphere using the Arvo method
        // http://web.archive.org/web/20100323053111/http://www.ics.uci.edu/~arvo/code/BoxSphereIntersect.c
        let s = 0;
        let distSquared = 0;

        if (sphere.xPos < this.minX) {
            s = sphere.xPos - this.minX;
            distSquared += s * s;
        }
        else if (sphere.xPos > this.maxX) {
            s = sphere.xPos - this.maxX;
            distSquared += s * s;
        }

        if (sphere.yPos < this.minY) {
            s = sphere.yPos - this.minY;
            distSquared += s * s;
        }
        else if (sphere.yPos > this.maxY) {
            s = sphere.yPos - this.maxY;
            distSquared += s * s;
        }

        if (sphere.zPos < this.minZ) {
            s = sphere.zPos - this.minZ;
            distSquared += s * s;
        }
        else if (sphere.zPos > this.maxZ) {
            s = sphere.zPos - this.maxZ;
            distSquared += s * s;
        }

        return distSquared < sphere.radiusSquared;
    }

    public overlapAABB(boxBounds: AxisAlignedBoxBound): boolean {
        // returns if two boxes overlap
        return (this.minX < boxBounds.maxX && this.maxX > boxBounds.minX) &&
            (this.minY < boxBounds.maxY && this.maxY > boxBounds.minY) &&
            (this.minZ < boxBounds.maxZ && this.maxZ > boxBounds.minZ);
    }

    public overlapBounds(bounds: Bounds): boolean {
        switch (bounds.boundType) {
            case BoundTypes.axisAlignedBoxBound:
                return this.overlapAABB(bounds as AxisAlignedBoxBound);
            case BoundTypes.sphereBound:
                return this.overlapSphere(bounds as SphereBound);
            default:
                return false;
        }
    }

    frontLeftBottom(): AxisAlignedBoxBound {
        return new AxisAlignedBoxBound(this.minX, this.minY, this.minZ, this.minX + this.halfExtent, this.minY + this.halfExtent, this.minZ + this.halfExtent);
    }
    frontLeftTop(): AxisAlignedBoxBound {
        return new AxisAlignedBoxBound(this.minX, this.minY + this.halfExtent, this.minZ, this.minX + this.halfExtent, this.maxY, this.minZ + this.halfExtent);
    }
    frontRightBottom(): AxisAlignedBoxBound {
        return new AxisAlignedBoxBound(this.minX + this.halfExtent, this.minY, this.minZ, this.maxX, this.minY + this.halfExtent, this.minZ + this.halfExtent);
    }
    frontRightTop(): AxisAlignedBoxBound {
         return new AxisAlignedBoxBound(this.minX + this.halfExtent, this.minY + this.halfExtent, this.minZ, this.maxX, this.maxY, this.minZ + this.halfExtent);
    }
    backLeftBottom(): AxisAlignedBoxBound {
        return new AxisAlignedBoxBound(this.minX, this.minY, this.minZ + this.halfExtent, this.minX + this.halfExtent, this.minY + this.halfExtent, this.maxZ);
    }
    backLeftTop(): AxisAlignedBoxBound {
        return new AxisAlignedBoxBound(this.minX, this.minY + this.halfExtent, this.minZ + this.halfExtent, this.minX + this.halfExtent, this.maxY, this.maxZ);
    }
    backRightBottom(): AxisAlignedBoxBound {
        return new AxisAlignedBoxBound(this.minX + this.halfExtent, this.minY, this.minZ + this.halfExtent, this.maxX, this.minY + this.halfExtent, this.maxZ);
    }
    backRightTop(): AxisAlignedBoxBound {
        return new AxisAlignedBoxBound(this.minX + this.halfExtent, this.minY + this.halfExtent, this.minZ + this.halfExtent, this.maxX, this.maxY, this.maxZ);
    }

    expandByScalar(amountToExpand: number) {
        this.minX -= amountToExpand;
        this.minY -= amountToExpand;
        this.minZ -= amountToExpand;
        this.maxX += amountToExpand;
        this.maxY += amountToExpand;
        this.maxZ += amountToExpand;
    }
    
    distanceTo(point: Vector3): number {
        q.set(point.x - (this.minX + this.halfExtent), point.y - (this.minY + this.halfExtent), point.z - (this.minZ + this.halfExtent));
        AbsVec3(q,q);
        SubVec3(q,this.halfExtent,this.halfExtent,this.halfExtent,q);
        MaxVec3(q,Vector3.Zero(),maxQ);
        const d = Max3(q.x,q.y,q.z);
        if (d > 0)
            return maxQ.length();
        else
            return d;
    }

    public get halfExtent() {
        return this.extent / 2;
    }

    public get extent() {
        return Math.max(
            Math.abs(this.maxX - this.minX),
            Math.abs(this.maxY - this.minY),
            Math.abs(this.maxZ - this.minZ));
    }

    contains(currentBounds: AxisAlignedBoxBound) {
        return this.minX <= currentBounds.minX && this.minY <= currentBounds.minY && this.minZ <= currentBounds.minZ &&
            this.maxX >= currentBounds.maxX && this.maxY >= currentBounds.maxY && this.maxZ >= currentBounds.maxZ;
    }

    public toString(): string {
        return `[${this.minX} ${this.minY} ${this.minZ} ${this.maxX} ${this.maxY} ${this.maxZ}]`;
    }   

    public toDetailedString(): string {
        return `minX: ${this.minX} minY: ${this.minY} minZ: ${this.minZ} maxX: ${this.maxX} maxY: ${this.maxY} maxZ: ${this.maxZ}`;
    }
}

export { AxisAlignedBoxBound, SphereBound, IhasBounds, Bounds };