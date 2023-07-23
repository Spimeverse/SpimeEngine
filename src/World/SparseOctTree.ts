import { Vector3 } from "@babylonjs/core";
import { SphereBound } from "..";
import { AxisAlignedBoxBound, IhasBounds, Bounds } from "..";
import { IhasPoolId, ResourcePool } from "../Collection/ResourcePool";
import { SparseSet } from "../Collection/SparseSet";


class SparseOctTree<TYPE extends IhasBounds & IhasPoolId> {

    rootNode: SparseOctTreeNode<TYPE>;
    treePool: ResourcePool<SparseOctTreeNode<TYPE>>;
    sharedMemory: SharedArrayBuffer;
    sharedData: Int32Array;

    constructor(
        bounds: AxisAlignedBoxBound,
        public maxItemsPerNode: number, public minNodeSize: number,
        public itemPool: ResourcePool<TYPE>) 
    {
        this.sharedMemory = new SharedArrayBuffer(1024 * 1024);
        this.sharedData = new Int32Array(this.sharedMemory);

        this.treePool = new ResourcePool<SparseOctTreeNode<TYPE>>(
            () => {
                return new SparseOctTreeNode<TYPE>(this);
            },
            (node) => {
                node.reset();
            }
            , 1000);

        this.rootNode = this.treePool.newItem();
        this.rootNode.bounds.copy(bounds);

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
        return node.nodeItemCount >= this.maxItemsPerNode && node.bounds.extent > this.minNodeSize;
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

    public children: SparseOctTreeNode<TYPE>[];
    public nodeItemCount: number=0;
    private _overflowID: number = -1;
    
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
        this.nodeItemCount = 0;
        this.children = [];
    }

    public reset() {
        this.nodeItemCount = 0;
        this._releaseChildNodes();
        this.totalItems = 0;
        this.releaseOverflow();
    }


    private releaseOverflow() {
        if (this._overflowID!== -1) {
            this._owner.treePool.releaseId(this._overflowID);
        }
        this._overflowID = -1;
    }

    private _releaseChildNodes() {
        for (let i = 0; i < this.children.length; i++) {
            this._owner.treePool.releaseId(this.children[i].poolId);
        }
        this.children.length = 0;
    }

    public insert(newItem: TYPE,newBounds: Bounds) {
        if (this.bounds.overlapBounds(newBounds)) {
            const itemsOffset = this.getNodeItemsOffset();
            const sharedData = this._owner.sharedData;
            if (this._itemLargerThanChildNode(newItem)) {
                this.totalItems++;
                sharedData[itemsOffset + this.nodeItemCount] = newItem.poolId;
                this.nodeItemCount++;
            }
            else {
                if (this.children.length > 0) {
                    this.totalItems++;
                    for (let i = 0; i < this.children.length; i++) {
                        this.children[i].insert(newItem, newBounds);
                    }
                } else {
                    const hasMaxNodeItems = this.nodeItemCount >= this._owner.maxItemsPerNode;
                    const isMinNodeSize = this.bounds.extent <= this._owner.minNodeSize;

                    if (!hasMaxNodeItems) {
                        this.totalItems++;
                        sharedData[itemsOffset + this.nodeItemCount] = newItem.poolId;
                        this.nodeItemCount++;
                    } else if (!isMinNodeSize) {
                        this._subdivide();
                        this.insert(newItem, newBounds);
                        this._pushDownCurrentItems();
                    } else {
                        const overflowNode = this.createOverflowNode();
                        if (overflowNode) {
                            overflowNode.insert(newItem, newBounds);
                        }
                    }
                }
            }
        }
    }

    private createOverflowNode() {
        let overflowNode: SparseOctTreeNode<TYPE> | null = null;
        if (this._overflowID === -1) {
            this._overflowID = this._owner.treePool.newId();
            const overflowNode = this._owner.treePool.getItem(this._overflowID);
            if (overflowNode) {
                overflowNode.bounds.copy(this.bounds);
            }
        }
        else {
            overflowNode = this._owner.treePool.getItem(this._overflowID);
        }
        return overflowNode;
    }

    private getOverflowNode() {
        let overflowNode: SparseOctTreeNode<TYPE> | null = null;
        if (this._overflowID !== -1) {
            overflowNode = this._owner.treePool.getItem(this._overflowID);
        }
        return overflowNode;
    }

    private getNodeItemsOffset() {
        const maxNodeItems = this._owner.maxItemsPerNode;
        const itemOffset = maxNodeItems * this.poolId;
        return itemOffset;
    }

    getItem(i: number): TYPE | null {
        if (i >= this.nodeItemCount && this._overflowID !== -1) {
            const overflowNode = this.getOverflowNode();
            if (overflowNode) {
                return overflowNode.getItem(i - this.nodeItemCount);
            }
        }
        const itemsOffset = this.getNodeItemsOffset();
        const itemID = this._owner.sharedData[itemsOffset + i];
        return this._owner.itemPool.getItem(itemID);
    }

    private _pushDownCurrentItems() {
        let itemsMoved = 0;
        const itemsOffset = this.getNodeItemsOffset();
        const sharedData = this._owner.sharedData;
        let copyFrom = this.nodeItemCount - 1;
        for (let i = copyFrom - 1; i >= 0; i--) {
            const currentItemID = sharedData[itemsOffset + i];
            const currentItem = this._owner.itemPool.getItem(currentItemID);
            if (currentItem && !this._itemLargerThanChildNode(currentItem)) {
                this.insert(currentItem, currentItem.currentBounds);
                if (copyFrom !== i)
                    sharedData[itemsOffset + i] = sharedData[copyFrom];
                itemsMoved++;
                copyFrom--;
            }
        }
        this.totalItems -= itemsMoved; // account for reinserting items that were already in the node
        this.nodeItemCount -= itemsMoved;
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
            const itemsOffset = this.getNodeItemsOffset();
            const sharedData = this._owner.sharedData;
            if (this.children.length == 0 ||
                this._itemLargerThanChildNode(item)) {

                // TODO this needs finishing and testing...
                let lastItemId = itemsOffset + this.nodeItemCount - 1;
                // find the last overflow node, if any
                let prevNode:SparseOctTreeNode<TYPE> = this;
                let overflowNode = this.getOverflowNode();
                while (overflowNode) {
                    prevNode = overflowNode;
                    overflowNode = overflowNode.getOverflowNode();
                }
                // note the ID of the last item in the overflow node
                if (overflowNode) {
                    lastItemId = overflowNode.getNodeItemsOffset() + overflowNode.nodeItemCount - 1;
                }
                for (let i = 0; i < this.nodeItemCount; i++) {
                    if (sharedData[itemsOffset + i] === item.poolId) {
                        sharedData[itemsOffset + i] = sharedData[lastItemId];
                        this.nodeItemCount--;
                        this.totalItems--;
                        if (overflowNode) {
                            overflowNode.nodeItemCount--;
                            if (overflowNode.nodeItemCount === 0) {
                                this.releaseOverflow();
                            }
                        }
                        return true;
                    }
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
            const itemsOffset = this.getNodeItemsOffset();
            const sharedData = this._owner.sharedData;
            for (let i = 0; i < this.nodeItemCount; i++) {
                const itemId = sharedData[itemsOffset + i];
                const item = this._owner.itemPool.getItem(itemId);
                if (item && bounds.overlapBounds(item.currentBounds)) {
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
            const itemsOffset = this.getNodeItemsOffset();
            const sharedData = this._owner.sharedData;
            for (let i = 0; i < this.nodeItemCount; i++) {
                const itemId = sharedData[itemsOffset + i];
                const item = this._owner.itemPool.getItem(itemId);
                if (item && bounds.overlaps(item.currentBounds)) {
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