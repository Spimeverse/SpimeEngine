import { Vector3 } from "@babylonjs/core";
import { SphereBound } from "..";
import { AxisAlignedBoxBound, IhasBounds, Bounds } from "..";

class SparseOctTree<TYPE extends IhasBounds> {

    rootNode: SparseOctTreeNode<TYPE>;
    uniqueResults: Set<TYPE>;

    constructor(
        bounds: AxisAlignedBoxBound,
        public maxItemsPerNode: number, public minNodeSize: number) {
        this.rootNode = new SparseOctTreeNode<TYPE>(bounds,this);
        this.uniqueResults = new Set<TYPE>();
    }

    public insert(item: TYPE) {
        this.rootNode.insert(item,item.currentBounds);
    }

    public remove(item: TYPE) {
        this.rootNode.remove(item,item.currentBounds);
    }

    public update(item: TYPE,newBounds: Bounds) {
        this.rootNode.update(item, item.currentBounds, newBounds);
        item.currentBounds.copyFrom(newBounds);
    }

    public nodeHasTooManyItems(node: SparseOctTreeNode<TYPE>): boolean {
        return node.items.length >= this.maxItemsPerNode && node.bounds.extent > this.minNodeSize;
    }

    public getItemsInBox(bounds: AxisAlignedBoxBound, results: Set<TYPE>): number {
        this.rootNode.getItemsInBox(bounds, results);
        return results.size;
    }

    public getItemsInSphere(bounds: SphereBound, results: Set<TYPE>): number {
        this.rootNode.getItemsInSphere(bounds, results);
        return results.size;
    }

}

// sparse quad tree to find nearby objects
class SparseOctTreeNode<TYPE extends IhasBounds> {

    bounds: AxisAlignedBoxBound;
    totalItems = 0;

    constructor(
        private _bounds: AxisAlignedBoxBound,
        private _owner: SparseOctTree<TYPE>) {
        this.bounds = _bounds.clone();
        this.items = [];
        this.children = [];
    }

    public items: TYPE[];
    public children: SparseOctTreeNode<TYPE>[];

    public insert(newItem: TYPE,newBounds: Bounds) {
        if (this.bounds.overlapBounds(newBounds)) {
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
        let copyFrom = this.items.length - 1;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const currentItem = this.items[i];
            if (!this._itemLargerThanChildNode(currentItem)) {
                this.insert(currentItem, currentItem.currentBounds);
                if (copyFrom !== i)
                    this.items[i] = this.items[copyFrom];
                itemsMoved++;
                copyFrom--;
            }
        }
        this.totalItems -= itemsMoved; // account for reinserting items that were already in the node
        this.items.length -= itemsMoved;
    }

    private _itemLargerThanChildNode(object: TYPE): boolean {
        const diameter = object.currentBounds.extent * 2;
        const childExtent = this.bounds.extent / 2;
        return diameter > childExtent;
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
        bounds: Bounds): boolean {
        if (this.bounds.overlapBounds(item.currentBounds)) {

            if (this.children.length == 0 ||
                this._itemLargerThanChildNode(item)) {
                const index = this.items.indexOf(item);
                if (index >= 0) {
                    this.items[index] = this.items[this.items.length - 1];
                    this.items.length--;
                    this.totalItems--;
                    return true;
                }
            }
            else {
                // remove the object from this children if it exists
                let removed = false;
                for (let i = 0; i < this.children.length; i++) {
                    if (this.children[i].remove(item,bounds)) {
                        removed = true;
                    }
                }
                if (removed) {
                    this.totalItems--;
                    return true;
                }
            }
        }
        return false;
    }

    public update(object: TYPE,bounds: Bounds, newBounds: Bounds) {
        const previouslyIntersecting = this.bounds.overlapBounds(bounds);
        const nowIntersecting = this.bounds.overlapBounds(newBounds);
        if (!previouslyIntersecting && nowIntersecting) { 
            this.insert(object,newBounds);
        }
        if (previouslyIntersecting && !nowIntersecting) {
            this.remove(object,bounds);
        }
        if (previouslyIntersecting && nowIntersecting && this.children.length > 0) {
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].update(object,bounds,newBounds);
            }
        }
    }


    public getItemsInBox(bounds: AxisAlignedBoxBound, results: Set<TYPE>): number {
        if (bounds.overlapAABB(this.bounds)) {
            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
                if (bounds.overlapBounds(item.currentBounds)) {
                    results.add(item);
                }
            }
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].getItemsInBox(bounds,results);
            }
        }
        return results.size;
    }

    getItemsInSphere(bounds: SphereBound, results: Set<TYPE>) {
        if (this.bounds.overlapSphere(bounds)) {
            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
                if (bounds.overlaps(item.currentBounds)) {
                    results.add(item);
                }
            }
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].getItemsInSphere(bounds,results);
            }
        }
        return results.size;
    }
}

export { SparseOctTree, SparseOctTreeNode };