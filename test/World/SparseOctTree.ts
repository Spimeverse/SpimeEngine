import { SparseOctTree, SparseOctTreeNode, SparseSet, AxisAlignedBoxBound, SphereBound, IhasBounds, IhasPoolId, ResourcePool } from ".."

export function TestSparseOctTree() {
        
    describe('SparseOctTree', () => {

        it('contains one object', () => {
            const bounds = new AxisAlignedBoxBound(0, 0, 0, 8, 8, 8);
            const pool = new ResourcePool<TestObject>(() => new TestObject(''),(obj) => obj.name = '',100);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2,pool);
            const obj = Object.assign(pool.newItem(), { name: 'dog', currentBounds: new SphereBound(0.5, 0.5, 0.5, 0.5) });
            tree.insert(obj);
            expect(tree.rootNode.nodeItemCount).toBe(1);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 1" +
                "\n..dog - [0 0 0 1 1 1]");
        });

        it('contains two objects', () => {
            const bounds = new AxisAlignedBoxBound(0, 0, 0, 8, 8, 8);
            const pool = new ResourcePool<TestObject>(() => new TestObject(''),(obj) => obj.name = '',100);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2,pool);
            const obj1 = Object.assign(pool.newItem(), { name: 'dog', currentBounds: new SphereBound(0.5, 0.5, 0.5, 0.5) });
            const obj2 = Object.assign(pool.newItem(), { name: 'cat', currentBounds: new SphereBound(0.5, 0.5, 0.5, 0.5) });
            tree.insert(obj1);
            tree.insert(obj2);
            expect(tree.rootNode.nodeItemCount).toBe(2);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 2" +
                "\n..cat - [0 0 0 1 1 1]" +
                "\n..dog - [0 0 0 1 1 1]");
        });

        it('subdivides when nodes fill up', () => {
            debugger;
            const bounds = new AxisAlignedBoxBound(0, 0, 0, 8, 8, 8);
            const pool = new ResourcePool<TestObject>(() => new TestObject(''),(obj) => obj.name = '',100);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2,pool);
            const obj1 = Object.assign(pool.newItem(), { name: 'dog', currentBounds: new SphereBound(0.5, 0.5, 0.5, 0.5) });
            const obj2 = Object.assign(pool.newItem(), { name: 'cat', currentBounds: new SphereBound(0.5, 0.5, 0.5, 0.5) });            
            const obj3 = Object.assign(pool.newItem(), { name: 'mouse', currentBounds: new SphereBound(0.5, 0.5, 0.5, 0.5) });
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            expect(tree.rootNode.nodeItemCount).toBe(0);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n......cat - [0 0 0 1 1 1]" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]");
        });


        it('Adds items to nodes that they overlap not just touch', () => {
            const bounds = new AxisAlignedBoxBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new SphereBound(0.5, 0.5, 0.5, 0.5));
            const obj2 = new TestObject('cat', new SphereBound(3.5, 0.5, 0.5, 0.5));
            const obj3 = new TestObject('mouse', new SphereBound(0.5, 0.5, 0.5, 0.5));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            expect(tree.rootNode.items.length).toBe(0);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 2" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]" +
                "\n######[2 0 0 4 2 2] - 1" +
                "\n......cat - [3 0 0 4 1 1]");
        });

        it('handles removing items that are not in the tree', () => {
            const bounds = new AxisAlignedBoxBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new SphereBound(0.5, 0.5, 0.5, 0.5));
            const obj2 = new TestObject('cat', new SphereBound(0.5, 0.5, 0.5, 0.5));
            const obj3 = new TestObject('mouse', new SphereBound(0.5, 0.5, 0.5, 0.5));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            tree.remove(obj2);
            tree.remove(obj2);
            tree.remove(obj2);
            tree.remove(obj2);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 2" +
                "\n####[0 0 0 4 4 4] - 2" +
                "\n######[0 0 0 2 2 2] - 2" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]");
        });


        it('can have items in multiple nodes', () => { 
            const bounds = new AxisAlignedBoxBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new SphereBound(0.5, 0.5, 0.5, 0.5));
            const obj2 = new TestObject('cow', new SphereBound(2, 2, 2, 1));
            const obj3 = new TestObject('mouse', new SphereBound(0.5, 0.5, 0.5, 0.5));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);

            expect(TreeState(tree)).withContext('before').toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]" +
                "\n######[0 2 0 2 4 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 0 0 4 2 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 2 0 4 4 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[0 0 2 2 2 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[0 2 2 2 4 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 0 2 4 2 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 2 2 4 4 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]");
        });

        it('can have items in multiple nodes, results same with different insert order', () => { 
            const bounds = new AxisAlignedBoxBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new SphereBound(0.5, 0.5, 0.5, 0.5));
            const obj2 = new TestObject('cow', new SphereBound(2, 2, 2, 1));
            const obj3 = new TestObject('mouse', new SphereBound(0.5, 0.5, 0.5, 0.5));
            tree.insert(obj1);
            tree.insert(obj3);
            tree.insert(obj2);

            expect(TreeState(tree)).withContext('before').toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]" +
                "\n######[0 2 0 2 4 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 0 0 4 2 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 2 0 4 4 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[0 0 2 2 2 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[0 2 2 2 4 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 0 2 4 2 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 2 2 4 4 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]");
        });

        it('can remove items in multiple nodes', () => {
            const bounds = new AxisAlignedBoxBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new SphereBound(0.5, 0.5, 0.5, 0.5));
            const obj2 = new TestObject('cow', new SphereBound(2, 2, 2, 1));
            const obj3 = new TestObject('mouse', new SphereBound(0.5, 0.5, 0.5, 0.5));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            expect(TreeState(tree)).withContext('before').toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]" +
                "\n######[0 2 0 2 4 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 0 0 4 2 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 2 0 4 4 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[0 0 2 2 2 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[0 2 2 2 4 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 0 2 4 2 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 2 2 4 4 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]");
            expect(NodeCount(tree.rootNode)).withContext('before').toBe(17);
            
            tree.remove(obj1);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 2" +
                "\n####[0 0 0 4 4 4] - 2" +
                "\n######[0 0 0 2 2 2] - 2" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n......mouse - [0 0 0 1 1 1]" +
                "\n######[0 2 0 2 4 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 0 0 4 2 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 2 0 4 4 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[0 0 2 2 2 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[0 2 2 2 4 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 0 2 4 2 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 2 2 4 4 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]");
            expect(NodeCount(tree.rootNode)).withContext('before').toBe(17);

            tree.remove(obj2);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 1" +
                "\n####[0 0 0 4 4 4] - 1" +
                "\n######[0 0 0 2 2 2] - 1" +
                "\n......mouse - [0 0 0 1 1 1]");
            expect(NodeCount(tree.rootNode)).withContext('before').toBe(17);

            tree.remove(obj3);
            expect(TreeState(tree)).toBe("");
            expect(NodeCount(tree.rootNode)).withContext('before').toBe(1);
        });

        it('can move items between nodes', () => {
            const bounds = new AxisAlignedBoxBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new SphereBound(0.5, 0.5, 0.5, 0.5));
            const obj2 = new TestObject('cow', new SphereBound(3, 3, 3, 1));
            const obj3 = new TestObject('mouse', new SphereBound(0.5, 0.5, 0.5, 0.5));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            expect(TreeState(tree)).withContext('before').toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 2" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]" +
                "\n######[2 2 2 4 4 4] - 1" +
                "\n......cow - [2 2 2 4 4 4]");
            
            tree.update(obj2, new SphereBound(1, 1, 1, 1));

            expect(TreeState(tree)).withContext('after').toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n......cow - [0 0 0 2 2 2]" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]");
        });

        it('can move items that span multiple child nodes', () => { 
            const bounds = new AxisAlignedBoxBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new SphereBound(0.5, 0.5, 0.5, 0.5));
            const obj2 = new TestObject('cow', new SphereBound(2, 2, 2, 1));
            const obj3 = new TestObject('mouse', new SphereBound(0.5, 0.5, 0.5, 0.5));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);

            expect(TreeState(tree)).withContext('before').toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]" +
                "\n######[0 2 0 2 4 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 0 0 4 2 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 2 0 4 4 2] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[0 0 2 2 2 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[0 2 2 2 4 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 0 2 4 2 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]" +
                "\n######[2 2 2 4 4 4] - 1" +
                "\n......cow - [1 1 1 3 3 3]");

            tree.update(obj2, new SphereBound(1, 1, 1, 1));

            expect(TreeState(tree)).withContext('after').toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n......cow - [0 0 0 2 2 2]" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]");
        });

        it('Stores large objects higher up the tree', () => { 
            const bounds = new AxisAlignedBoxBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('cat', new SphereBound(0.5, 0.5, 0.5, 0.5));
            const obj2 = new TestObject('dog', new SphereBound(0.5, 0.5, 0.5, 0.5));
            const obj3 = new TestObject('mouse', new SphereBound(0.5, 0.5, 0.5, 0.5));
            const obj4 = new TestObject('truck', new SphereBound(2.5, 2.5, 2.5, 2.5));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            tree.insert(obj4);
            // truck doesn't get pushed down because it's too big
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 4" +
                "\n..truck - [0 0 0 5 5 5]" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n......cat - [0 0 0 1 1 1]" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]");
        });

        it('gets each unique item once within a bound', () => {
            const bounds = new AxisAlignedBoxBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new SphereBound(0.5, 0.5, 0.5, 0.5));
            const obj2 = new TestObject('cow', new SphereBound(4, 4, 4, 1));
            const obj3 = new TestObject('mouse', new SphereBound(0.5, 0.5, 0.5, 0.5));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            expect(TreeState(tree)).withContext('Tree state').toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 2" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]" +
                "\n######[2 2 2 4 4 4] - 1" +
                "\n......cow - [3 3 3 5 5 5]" +
                "\n####[0 4 0 4 8 4] - 1" +
                "\n....cow - [3 3 3 5 5 5]" +
                "\n####[4 0 0 8 4 4] - 1" +
                "\n....cow - [3 3 3 5 5 5]" +
                "\n####[4 4 0 8 8 4] - 1" +
                "\n....cow - [3 3 3 5 5 5]" +
                "\n####[0 0 4 4 4 8] - 1" +
                "\n....cow - [3 3 3 5 5 5]" +
                "\n####[0 4 4 4 8 8] - 1" +
                "\n....cow - [3 3 3 5 5 5]" +
                "\n####[4 0 4 8 4 8] - 1" +
                "\n....cow - [3 3 3 5 5 5]" +
                "\n####[4 4 4 8 8 8] - 1" +
                "\n....cow - [3 3 3 5 5 5]");
            
            const items = new SparseSet(100);
            let searchBounds = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            tree.getItemsInBox(searchBounds,items);
            expect(ItemList(searchBounds,items)).withContext("single node").toBe(
                "\n## [0 0 0 1 1 1]" +
                "\ndog - [0 0 0 1 1 1]" +
                "\nmouse - [0 0 0 1 1 1]");
            
            items.clear();
            searchBounds = new AxisAlignedBoxBound(1, 1, 1, 8, 8, 8);
            tree.getItemsInBox(searchBounds,items);
            expect(ItemList(searchBounds,items)).withContext("single node").toBe(
                "\n## [1 1 1 8 8 8]" +
                "\ncow - [3 3 3 5 5 5]");
        });

    });
}

let nextPoolId = 0;
const testObjects:TestObject[] = [];

class TestObject implements IhasBounds, IhasPoolId {
    poolId = -1;
    currentBounds: SphereBound;

    constructor(public name: string) {
        this.poolId = nextPoolId++;
        testObjects[this.poolId] = this;
        this.currentBounds = new SphereBound(0, 0, 0, 0);
    }

    toString() {
        return this.name + " - " + this.currentBounds.toString();
    }
}


function ItemList(bounds: AxisAlignedBoxBound, itemsSet: SparseSet) {
    const index= itemsSet.allIndex();
    const used = itemsSet.usedCount;
    const items:TestObject[] = [];
    for (let i=0; i<used; i++) {
        const item = testObjects[index[i]];
        items.push(item);
    }

    items.sort((a, b) => a.name.localeCompare(b.name));
    return "\n## " + bounds.toString() + "\n" + items.map(item => item.toString()).join('\n');
}

function TreeState(tree: SparseOctTree<TestObject>): string {
    return NodeState(tree.rootNode,1);
}

function NodeState(node: SparseOctTreeNode<TestObject>, depth: number): string {
    if (node.children.length > 0 || node.nodeItemCount > 0 || node.totalItems > 0)
    {
        let s = '\n' + '##'.repeat(depth) + node.bounds.toString() + " - " + node.totalItems;
        // sort node items by name for consistent output
        const items:TestObject[] = [];
        for (let i = 0; i < node.nodeItemCount; i++)
        {
            const item = node.getItem(i);
            if (item)
                items.push(item);
        }
        items.sort((a, b) => {
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            return 0;
        });
        for (let i = 0; i < items.length; i++)
        {
            s += '\n' + '..'.repeat(depth) + items[i].name + " - " +items[i].currentBounds.toString();
        }
        for (let i = 0; i < node.children.length; i++)
        {
            s += NodeState(node.children[i],depth + 1);
        }
        return s;
    }
    return "";
}

function NodeCount(node: SparseOctTreeNode<TestObject>): number {
    let count = 1;
    for (let i = 0; i < node.children.length; i++)
    {
        count += NodeCount(node.children[i]);
    }
    return count;
}