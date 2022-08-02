
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
        this.items = [];
        this.children = [];
    }

    public items: TYPE[];
    public children: SparseOctTreeNode<TYPE>[];

    public insert(item: TYPE,bounds: OctBound, maxItemsPerNode: number, minNodeSize: number) {
        if (bounds.overlaps(this.bounds)) {
            this.totalItems++;
            if (this._itemLargerThanChildNode(item)) {
                this.items.push(item);
            }
            else {
                if (this.children.length > 0) {
                    for (let i = 0; i < this.children.length; i++) {
                        this.children[i].insert(item, bounds, maxItemsPerNode, minNodeSize);
                    }
                } else {
                    const nodeHasTooManyItems = this.items.length >= maxItemsPerNode && this.bounds.extent > minNodeSize;
                    if (!nodeHasTooManyItems) {
                        this.items.push(item);
                    } else {
                        this._subdivide();
                        for (let i = 0; i < this.children.length; i++) {
                            const child = this.children[i];
                            child.insert(item, bounds, maxItemsPerNode, minNodeSize);
                            this._pushItemsToChild(child, maxItemsPerNode, minNodeSize);
                        }
                    }
                }
            }
        }
    }

    private _itemLargerThanChildNode(object: TYPE): boolean {
        return object.octBounds.extent > this.bounds.extent / 2;
    }

    private _pushItemsToChild(child: SparseOctTreeNode<TYPE>, maxItemsPerNode: number, minNodeSize: number) {
        let itemsMoved = 0;
        for (let j = 0; j < this.items.length; j++) {
            const item = this.items[j];
            if (!this._itemLargerThanChildNode(item)) {
                child.insert(item, item.octBounds, maxItemsPerNode, minNodeSize);
                this.items[j] = this.items[this.items.length - 1];
                itemsMoved++;
            }
        }
        this.items.length -= itemsMoved;
    }

    private _subdivide() {
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

    public remove(item: TYPE,
        bounds: OctBound,
        parentNode: SparseOctTreeNode<TYPE> | null,
        maxItemsPerNode: number, minNodeSize: number) {
        if (item.octBounds.overlaps(this.bounds)) {
            this.totalItems--;

            if (this.children.length == 0 ||
                this._itemLargerThanChildNode(item)) {
                const index = this.items.indexOf(item);
                this.items[index] = this.items[this.items.length - 1];
                this.items.length--;
            }
            else {
            // remove the object from this children if it exists
                for (let i = 0; i < this.children.length; i++) {
                    this.children[i].remove(item,bounds,this, maxItemsPerNode, minNodeSize);
                }
            }

            // see if we can combine all the children into this node
            if (this.totalItems <= maxItemsPerNode && this.children.length > 0) {
                for (let i = 0; i < this.children.length; i++) {
                    this.children[i]._addItemsToParent(this.items);
                }
                this.children.length = 0;
            }
        }
    }

    private _addItemsToParent(parentItems: TYPE[]) {
        if (this.children.length > 0) {
            for (let i = 0; i < this.children.length; i++) {
                this.children[i]._addItemsToParent(parentItems);
            }
            this.children.length = 0;
        } 

        for (let i = 0; i < this.items.length; i++) {
            parentItems.push(this.items[i]);
        }
        this.items.length = 0;
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
            for (let i = 0; i < this.items.length; i++) {
                results.push(this.items[i]);
            }
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].getItemsInBounds(bounds,results);
            }
        }
        return results.length;
    }
}

export { SparseOctTree, OctBound, IhasOctBounds, SparseOctTreeNode };