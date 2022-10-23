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
    copyFrom(newBounds: Bounds) {
        if (newBounds.boundType !== this.boundType) {
            throw new Error("Bounds.copyFrom: newBounds.boundType !== this.boundType");
        }
        else {
            if (this.boundType == BoundTypes.sphereBound) {
                (this as unknown as SphereBound).copyFrom(newBounds as SphereBound);
            }
            else if (this.boundType == BoundTypes.axisAlignedBoxBound) {
                (this as unknown as AxisAlignedBoxBound).copyFrom(newBounds as AxisAlignedBoxBound);
            }
            else
                throw new Error("Bounds.copyFrom: unknown bound type");
        }
    }

    abstract get extent(): number;

    public constructor(public boundType: BoundTypes) {

    }

}

class SphereBound extends Bounds {

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

    copyFrom(newBounds: SphereBound) {
        this.xPos = newBounds.xPos;
        this.yPos = newBounds.yPos;
        this.zPos = newBounds.zPos;
        this.radius = newBounds.radius;
        this.radiusSquared = newBounds.radiusSquared;
    }


    set(xPos: number, yPos: number, zPos: number,radius: number) {
        this.xPos = xPos;
        this.yPos = yPos;
        this.zPos = zPos;
        this.radius = radius;
        this.radiusSquared = radius * radius;
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
const maxq = new Vector3();

class AxisAlignedBoxBound extends Bounds {

 
    public constructor(
        public minX: number = 0, public minY: number = 0, public minZ: number = 0,
        public maxX: number = 0, public maxY: number = 0, public maxZ: number = 0) {
        super(BoundTypes.axisAlignedBoxBound);
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

    expandByScalar(amountToExand: number) {
        this.minX -= amountToExand;
        this.minY -= amountToExand;
        this.minZ -= amountToExand;
        this.maxX += amountToExand;
        this.maxY += amountToExand;
        this.maxZ += amountToExand;
    }
    
    distanceTo(point: Vector3): number {
        q.set(point.x - (this.minX + this.halfExtent), point.y - (this.minY + this.halfExtent), point.z - (this.minZ + this.halfExtent));
        AbsVec3(q,q);
        SubVec3(q,this.halfExtent,this.halfExtent,this.halfExtent,q);
        MaxVec3(q,Vector3.Zero(),maxq);
        const d = Max3(q.x,q.y,q.z);
        if (d > 0)
            return maxq.length();
        else
            return d;
    }

    public get halfExtent() {
        return this.extent / 2;
    }

    public get extent() {
        return Math.abs(this.maxX - this.minX);
    }

    public toString(): string {
        return `[${this.minX} ${this.minY} ${this.minZ} ${this.maxX} ${this.maxY} ${this.maxZ}]`;
    }   
}

export { AxisAlignedBoxBound, SphereBound, IhasBounds, Bounds };