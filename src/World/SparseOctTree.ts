import { Vector3 } from "@babylonjs/core";
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
    }

    public nodeHasTooManyItems(node: SparseOctTreeNode<TYPE>): boolean {
        return node.items.length >= this.maxItemsPerNode && node.bounds.extent > this.minNodeSize;
    }

    public getItemsInBounds(bounds: AxisAlignedBoxBound, results: TYPE[]): number {
        this.uniqueResults.clear();
        this.rootNode.getItemsInBounds(bounds, this.uniqueResults);
        // loop through the unique results and add them to the results array
        results.length = this.uniqueResults.size;
        let i = 0;
        for (const item of this.uniqueResults) {
            results[i++] = item;
        }
        return results.length;
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
        for (let i = this.items.length - 1; i >= 0; i--) {
            const currentItem = this.items[i];
            if (!this._itemLargerThanChildNode(currentItem)) {
                this.insert(currentItem, currentItem.currentBounds);
                this.items[i] = this.items[this.items.length - 1];
                itemsMoved++;
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
        bounds: Bounds) {
        if (this.bounds.overlapBounds(item.currentBounds)) {
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


    public getItemsInBounds(bounds: AxisAlignedBoxBound, results: Set<TYPE>): number {
        if (bounds.overlapAABB(this.bounds)) {
            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
                if (bounds.overlapBounds(item.currentBounds)) {
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

export { SparseOctTree, SparseOctTreeNode };