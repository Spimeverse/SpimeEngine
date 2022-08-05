
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
            (this.minZ < b.maxZ && this.maxZ > b.minZ);
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
    uniqueResults: Set<TYPE>;

    constructor(
        bounds: OctBound,
        public maxItemsPerNode: number, public minNodeSize: number) {
        this.rootNode = new SparseOctTreeNode<TYPE>(bounds,this);
        this.uniqueResults = new Set<TYPE>();
    }

    public insert(item: TYPE) {
        this.rootNode.insert(item,item.octBounds);
    }

    public remove(item: TYPE) {
        this.rootNode.remove(item,item.octBounds);
    }

    public update(item: TYPE,newbounds: OctBound) {
        this.rootNode.update(item, item.octBounds, newbounds);
        item.octBounds.copy(newbounds);
    }

    public nodeHasTooManyItems(node: SparseOctTreeNode<TYPE>): boolean {
        return node.items.length >= this.maxItemsPerNode && node.bounds.extent > this.minNodeSize;
    }

    public getItemsInBounds(bounds: OctBound, results: IhasOctBounds[]): number {
        this.rootNode.getItemsInBounds(bounds, this.uniqueResults);
        // loop through the unique results and add them to the results array
        results.length = this.uniqueResults.size;
        let i = 0;
        for (const item of this.uniqueResults) {
            results[i++] = item;
        }
        this.uniqueResults.clear();
        return results.length;
    }
}

// sparse quad tree to find nearby objects
class SparseOctTreeNode<TYPE extends IhasOctBounds> {
    bounds: OctBound;
    totalItems = 0;

    constructor(
        private _bounds: OctBound,
        private _owner: SparseOctTree<TYPE>) {
        this.bounds = _bounds.clone();
        this.items = [];
        this.children = [];
    }

    public items: TYPE[];
    public children: SparseOctTreeNode<TYPE>[];

    public insert(newItem: TYPE,newBounds: OctBound) {
        if (newBounds.overlaps(this.bounds)) {
            if (this._itemLargerThanChildNode(newItem)) {
                this.totalItems++;
                this.items.push(newItem);
            }
            else {
                if (this.children.length > 0) {
                    this.totalItems++;
                    for (let i = 0; i < this.children.length; i++) {
                        this.children[i].insert(newItem, newBounds);
                    }
                } else {
                    if (!this._owner.nodeHasTooManyItems(this)) {
                        this.totalItems++;
                        this.items.push(newItem);
                    } else {
                        this._subdivide();
                        this.insert(newItem, newBounds);
                        this._pushDownCurrentItems();
                    }
                }
            }
        }
    }

    private _pushDownCurrentItems() {
        let itemsMoved = 0;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const currentItem = this.items[i];
            if (!this._itemLargerThanChildNode(currentItem)) {
                this.insert(currentItem, currentItem.octBounds);
                this.items[i] = this.items[this.items.length - 1];
                itemsMoved++;
            }
        }
        this.totalItems -= itemsMoved; // account for reinserting items that were already in the node
        this.items.length -= itemsMoved;
    }

    private _itemLargerThanChildNode(object: TYPE): boolean {
        return object.octBounds.extent > this.bounds.extent / 2;
    }

    private _subdivide() {
        this.children.length = 8;
        const frontLeftBottom = new SparseOctTreeNode<TYPE>(this.bounds.frontLeftBottom(), this._owner);
        this.children[0] = frontLeftBottom;

        const frontLeftTop = new SparseOctTreeNode<TYPE>(this.bounds.frontLeftTop(), this._owner);
        this.children[1] = frontLeftTop;

        const frontRightBottom = new SparseOctTreeNode<TYPE>(this.bounds.frontRightBottom(), this._owner);
        this.children[2] = frontRightBottom;

        const frontRightTop = new SparseOctTreeNode<TYPE>(this.bounds.frontRightTop(), this._owner);
        this.children[3] = frontRightTop;

        const backLeftBottom = new SparseOctTreeNode<TYPE>(this.bounds.backLeftBottom(), this._owner);
        this.children[4] = backLeftBottom;

        const backLeftTop = new SparseOctTreeNode<TYPE>(this.bounds.backLeftTop(), this._owner);
        this.children[5] = backLeftTop;

        const backRightBottom = new SparseOctTreeNode<TYPE>(this.bounds.backRightBottom(), this._owner);
        this.children[6] = backRightBottom;

        const backRightTop = new SparseOctTreeNode<TYPE>(this.bounds.backRightTop(), this._owner);
        this.children[7] = backRightTop;

    }

    public remove(item: TYPE,
        bounds: OctBound) {
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
                    this.children[i].remove(item,bounds);
                }
            }

            // see if we can combine all the children into this node
            const uniqueResults = this._owner.uniqueResults;
            uniqueResults.clear();
            if (this.totalItems <= this._owner.maxItemsPerNode && this.children.length > 0) {
                for (let i = 0; i < this.children.length; i++) {
                    this.children[i]._addItemsToParent(uniqueResults);
                }
                this.children.length = 0;
            }
            
            let i = this.items.length;
            this.items.length += uniqueResults.size;
            for (const item of uniqueResults) {
                this.items[i++] = item;
            }
            uniqueResults.clear();

        }
    }

    private _addItemsToParent(parentItems: Set<TYPE>) {
        if (this.children.length > 0) {
            for (let i = 0; i < this.children.length; i++) {
                this.children[i]._addItemsToParent(parentItems);
            }
            this.children.length = 0;
        } 

        for (let i = 0; i < this.items.length; i++) {
            parentItems.add(this.items[i]);
        }
        this.items.length = 0;
    }

    public update(object: TYPE,bounds: OctBound, newbounds: OctBound) {
        const previouslyIntersecting = bounds.overlaps(this.bounds);
        const nowIntersecting = newbounds.overlaps(this.bounds);
        if (!previouslyIntersecting && nowIntersecting) { 
            this.insert(object,newbounds);
        }
        if (previouslyIntersecting && !nowIntersecting) {
            this.remove(object,bounds);
        }
        if (previouslyIntersecting && nowIntersecting && this.children.length > 0) {
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].update(object,bounds,newbounds);
            }
        }
    }


    public getItemsInBounds(bounds: OctBound, results: Set<TYPE>): number {
        if (bounds.overlaps(this.bounds)) {
            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
                if (item.octBounds.overlaps(bounds)) {
                    results.add(item);
                }
            }
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].getItemsInBounds(bounds,results);
            }
        }
        return results.size;
    }
}

export { SparseOctTree, OctBound, IhasOctBounds, SparseOctTreeNode };