
interface IhasOctBounds {
    octBounds: OctBound;
}


class OctBound {
    public get halfExtent() {
        return (this.maxX - this.minX) / 2;
    }

    public get extent() {
        return this.maxX - this.minX;
    }

 
    constructor(
        public minX: number = 0, public minY: number = 0, public minZ: number = 0,
        public maxX: number = 0, public maxY: number = 0, public maxZ: number = 0) {
    }

    public set(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
        this.minX = minX;
        this.minY = minY;
        this.minZ = minZ;
        this.maxX = maxX;
        this.maxY = maxY;
        this.maxZ = maxZ;
    }

    public clone (): OctBound {
        const newbounds = new OctBound();
        newbounds.minX = this.minX;
        newbounds.minY = this.minY;
        newbounds.minZ = this.minZ;
        newbounds.maxX = this.maxX;
        newbounds.maxY = this.maxY;
        newbounds.maxZ = this.maxZ;
        return newbounds;
    }

    public copy(b: OctBound): void {
        this.minX = b.minX;
        this.minY = b.minY;
        this.minZ = b.minZ;
        this.maxX = b.maxX;
        this.maxY = b.maxY;
        this.maxZ = b.maxZ;
    }

    public overlaps(b: OctBound): boolean {
        // returns if two boxes overlap
        return (this.minX < b.maxX && this.maxX > b.minX) &&
            (this.minY < b.maxY && this.maxY > b.minY) &&
            (this.minZ < b.maxX && this.maxZ > b.minZ);
    }

    frontLeftBottom(): OctBound {
        return new OctBound(this.minX, this.minY, this.minZ, this.minX + this.halfExtent, this.minY + this.halfExtent, this.minZ + this.halfExtent);
    }
    frontLeftTop(): OctBound {
        return new OctBound(this.minX, this.minY + this.halfExtent, this.minZ, this.minX + this.halfExtent, this.maxY, this.minZ + this.halfExtent);
    }
    frontRightBottom(): OctBound {
        return new OctBound(this.minX + this.halfExtent, this.minY, this.minZ, this.maxX, this.minY + this.halfExtent, this.minZ + this.halfExtent);
    }
    frontRightTop(): OctBound {
         return new OctBound(this.minX + this.halfExtent, this.minY + this.halfExtent, this.minZ, this.maxX, this.maxY, this.minZ + this.halfExtent);
    }
    backLeftBottom(): OctBound {
        return new OctBound(this.minX, this.minY, this.minZ + this.halfExtent, this.minX + this.halfExtent, this.minY + this.halfExtent, this.maxZ);
    }
    backLeftTop(): OctBound {
        return new OctBound(this.minX, this.minY + this.halfExtent, this.minZ + this.halfExtent, this.minX + this.halfExtent, this.maxY, this.maxZ);
    }
    backRightBottom(): OctBound {
        return new OctBound(this.minX + this.halfExtent, this.minY, this.minZ + this.halfExtent, this.maxX, this.minY + this.halfExtent, this.maxZ);
    }
    backRightTop(): OctBound {
        return new OctBound(this.minX + this.halfExtent, this.minY + this.halfExtent, this.minZ + this.halfExtent, this.maxX, this.maxY, this.maxZ);
    }

    public toString(): string {
        return `[${this.minX} ${this.minY} ${this.minZ} ${this.maxX} ${this.maxY} ${this.maxZ}]`;
    }   
}

class SparseOctTree<TYPE extends IhasOctBounds> {
    rootNode: SparseOctTreeNode<TYPE>;

    constructor(
        bounds: OctBound,
        public maxItemsPerNode: number, public minNodeSize: number) {
        this.rootNode = new SparseOctTreeNode<TYPE>(bounds);
    }

    public insert(item: TYPE) {
        this.rootNode.insert(item,item.octBounds,this.maxItemsPerNode,this.minNodeSize);
    }

    public remove(item: TYPE) {
        this.rootNode.remove(item,item.octBounds,null,this.maxItemsPerNode,this.minNodeSize);
    }

    public update(item: TYPE,newbounds: OctBound) {
        this.rootNode.update(item, item.octBounds, newbounds, this.maxItemsPerNode, this.minNodeSize);
        item.octBounds.copy(newbounds);
    }

    public getItemsInBounds(bounds: OctBound,results: IhasOctBounds[]): number {
        return this.rootNode.getItemsInBounds(bounds,results);
    }
}

// sparse quad tree to find nearby objects
class SparseOctTreeNode<TYPE extends IhasOctBounds> {
    bounds: OctBound;
    totalItems = 0;

    constructor(
        bounds: OctBound) {
        this.bounds = bounds.clone();
        this.objects = [];
        this.children = [];
    }

    public objects: TYPE[];
    public children: SparseOctTreeNode<TYPE>[];

    public insert(object: TYPE,bounds: OctBound, maxItemsPerNode: number, minNodeSize: number) {
        if (bounds.overlaps(this.bounds)) {
            this.totalItems++;
            if (this.children.length > 0) {
                for (let i = 0; i < this.children.length; i++) {
                    this.children[i].insert(object,bounds, maxItemsPerNode, minNodeSize);
                }
            } else {
                if (this.objects.length < maxItemsPerNode || this.bounds.extent <= minNodeSize) {
                    this.objects.push(object);
                } else {
                    this.subdivide();
                    for (let i = 0; i < this.children.length; i++) {
                        this.children[i].insert(object,bounds, maxItemsPerNode, minNodeSize);
                        for (let j = 0; j < this.objects.length; j++) {
                            this.children[i].insert(this.objects[j],this.objects[j].octBounds, maxItemsPerNode, minNodeSize);
                        }
                    }
                    this.objects.length = 0;
                }
            }
        }
    }

    subdivide() {
        const frontLeftBottom = new SparseOctTreeNode<TYPE>(this.bounds.frontLeftBottom());
        this.children.push(frontLeftBottom);

        const frontLeftTop = new SparseOctTreeNode<TYPE>(this.bounds.frontLeftTop());
        this.children.push(frontLeftTop);

        const frontRightBottom = new SparseOctTreeNode<TYPE>(this.bounds.frontRightBottom());
        this.children.push(frontRightBottom);

        const frontRightTop = new SparseOctTreeNode<TYPE>(this.bounds.frontRightTop());
        this.children.push(frontRightTop);

        const backLeftBottom = new SparseOctTreeNode<TYPE>(this.bounds.backLeftBottom());
        this.children.push(backLeftBottom);

        const backLeftTop = new SparseOctTreeNode<TYPE>(this.bounds.backLeftTop());
        this.children.push(backLeftTop);

        const backRightBottom = new SparseOctTreeNode<TYPE>(this.bounds.backRightBottom());
        this.children.push(backRightBottom);

        const backRightTop = new SparseOctTreeNode<TYPE>(this.bounds.backRightTop());
        this.children.push(backRightTop);

    }

    public remove(object: TYPE,
        bounds: OctBound,
        parentNode: SparseOctTreeNode<TYPE> | null,
        maxItemsPerNode: number, minNodeSize: number) {
        if (object.octBounds.overlaps(this.bounds)) {
            this.totalItems--;

            // remove the object from this children if it exists
            if (this.children.length > 0) {
                for (let i = 0; i < this.children.length; i++) {
                    this.children[i].remove(object,bounds,this, maxItemsPerNode, minNodeSize);
                }
            } else {
                const index = this.objects.indexOf(object);
                this.objects[index] = this.objects[this.objects.length - 1];
                this.objects.length--;
            }
            // see if we can combine all the children into this node
            if (this.totalItems <= maxItemsPerNode && this.children.length > 0) {
                for (let i = 0; i < this.children.length; i++) {
                    this.children[i].addAllChildObjects(this.objects);
                }
                this.children.length = 0;
            }
        }
    }

    addAllChildObjects(objects: TYPE[]) {
        if (this.children.length > 0) {
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].addAllChildObjects(objects);
            }
            this.children.length = 0;
        } else {
            for (let i = 0; i < this.objects.length; i++) {
                objects.push(this.objects[i]);
            }
            this.objects.length = 0;
        }
    }

    public update(object: TYPE,bounds: OctBound, newbounds: OctBound, maxItemsPerNode: number, minNodeSize: number) {
        const previouslyIntersecting = bounds.overlaps(this.bounds);
        const nowIntersecting = newbounds.overlaps(this.bounds);
        if (!previouslyIntersecting && nowIntersecting) { 
            this.insert(object,newbounds, maxItemsPerNode, minNodeSize);
        }
        if (previouslyIntersecting && !nowIntersecting) {
            this.remove(object,bounds,null,maxItemsPerNode,minNodeSize);
        }
        if (previouslyIntersecting && nowIntersecting && this.children.length > 0) {
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].update(object,bounds,newbounds,maxItemsPerNode,minNodeSize);
            }
        }
    }


    public getItemsInBounds(bounds: OctBound, results: IhasOctBounds[]): number {
        if (bounds.overlaps(this.bounds)) {
            for (let i = 0; i < this.objects.length; i++) {
                results.push(this.objects[i]);
            }
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].getItemsInBounds(bounds,results);
            }
        }
        return results.length;
    }
}

export { SparseOctTree, OctBound, IhasOctBounds, SparseOctTreeNode };