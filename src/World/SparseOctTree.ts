import { Vector3 } from "@babylonjs/core";
import { SphereBound } from "..";
import { AxisAlignedBoxBound, IhasBounds, Bounds } from "..";
import { IhasPoolId, ResourcePool } from "../Collection/ResourcePool";
import { SparseSet } from "../Collection/SparseSet";

class SparseOctTree<TYPE extends IhasBounds & IhasPoolId> {

    rootNode: SparseOctTreeNode<TYPE>;
    treePool: ResourcePool<SparseOctTreeNode<TYPE>>;

    constructor(
        bounds: AxisAlignedBoxBound,
        public maxItemsPerNode: number, public minNodeSize: number) {
        this.rootNode = new SparseOctTreeNode<TYPE>(this);
        this.rootNode.bounds.copy(bounds);

        this.treePool = new ResourcePool<SparseOctTreeNode<TYPE>>(
            () => {
                return new SparseOctTreeNode<TYPE>(this);
            },
            (node) => {
                node.reset();
            }
            , 1000);
    }

    public insert(item: TYPE) {
        this.rootNode.insert(item,item.currentBounds);
    }

    public remove(item: TYPE) {
        this.rootNode.remove(item,item.currentBounds);
    }

    public update(item: TYPE,newBounds: Bounds) {
        this.rootNode.update(item, item.currentBounds, newBounds);
        item.currentBounds.copy(newBounds);
    }

    public nodeHasTooManyItems(node: SparseOctTreeNode<TYPE>): boolean {
        return node.items.length >= this.maxItemsPerNode && node.bounds.extent > this.minNodeSize;
    }

    public getItemsInBox(bounds: AxisAlignedBoxBound, results: SparseSet): number {
        this.rootNode.getItemsInBox(bounds, results);
        return results.usedCount;
    }

    public getItemsInSphere(bounds: SphereBound, results: SparseSet): number {
        this.rootNode.getItemsInSphere(bounds, results);
        return results.usedCount;
    }

}

// sparse quad tree to find nearby objects
class SparseOctTreeNode<TYPE extends IhasBounds & IhasPoolId> {
    /**
     * the pool id of this chunk
     * @see ResourcePool
     */
    poolId = -1;
    bounds: AxisAlignedBoxBound;
    totalItems = 0;

    constructor(
        private _owner: SparseOctTree<TYPE>) {
        this.bounds = new AxisAlignedBoxBound();
        this.items = [];
        this.children = [];
    }

    public reset() {
        this.items.length = 0;
        this._releaseChildNodes();
        this.totalItems = 0;
    }

    public items: TYPE[];
    public children: SparseOctTreeNode<TYPE>[];

    private _releaseChildNodes() {
        for (let i = 0; i < this.children.length; i++) {
            this._owner.treePool.releaseId(this.children[i].poolId);
        }
        this.children.length = 0;
    }

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
        const pool = this._owner.treePool;
        const frontLeftBottom = pool.newItem();
        frontLeftBottom.bounds.copy(this.bounds.frontLeftBottom());
        this.children[0] = frontLeftBottom;

        const frontLeftTop = pool.newItem();
        frontLeftTop.bounds.copy(this.bounds.frontLeftTop());
        this.children[1] = frontLeftTop;

        const frontRightBottom = pool.newItem();
        frontRightBottom.bounds.copy(this.bounds.frontRightBottom());
        this.children[2] = frontRightBottom;

        const frontRightTop = pool.newItem();
        frontRightTop.bounds.copy(this.bounds.frontRightTop());
        this.children[3] = frontRightTop;

        const backLeftBottom = pool.newItem();
        backLeftBottom.bounds.copy(this.bounds.backLeftBottom());
         this.children[4] = backLeftBottom;

        const backLeftTop = pool.newItem();
        backLeftTop.bounds.copy(this.bounds.backLeftTop());
        this.children[5] = backLeftTop;

        const backRightBottom = pool.newItem();
        backRightBottom.bounds.copy(this.bounds.backRightBottom());
        this.children[6] = backRightBottom;

        const backRightTop = pool.newItem();
        backRightTop.bounds.copy(this.bounds.backRightTop());
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
                    if (this.totalItems === 0) {
                        this._releaseChildNodes();
                    }
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


    public getItemsInBox(bounds: AxisAlignedBoxBound, results: SparseSet): number {
        if (bounds.overlapAABB(this.bounds)) {
            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
                if (bounds.overlapBounds(item.currentBounds)) {
                    results.add(item.poolId);
                }
            }
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].getItemsInBox(bounds,results);
            }
        }
        return results.usedCount;
    }

    getItemsInSphere(bounds: SphereBound, results: SparseSet) {
        if (this.bounds.overlapSphere(bounds)) {
            for (let i = 0; i < this.items.length; i++) {
                const item = this.items[i];
                if (bounds.overlaps(item.currentBounds)) {
                    results.add(item.poolId);
                }
            }
            for (let i = 0; i < this.children.length; i++) {
                this.children[i].getItemsInSphere(bounds,results);
            }
        }
        return results.usedCount;
    }
}

export { SparseOctTree, SparseOctTreeNode };