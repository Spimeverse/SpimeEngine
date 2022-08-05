import { SparseOctTree, SparseOctTreeNode, OctBound, IhasOctBounds } from ".."

export function TestSparseOctTree() {
        
    describe('SparseOctTree', () => {

        it('contains one object', () => {
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj);
            expect(tree.rootNode.items.length).toBe(1);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 1" +
                "\n..dog - [0 0 0 1 1 1]");
        });

        it('contains two objects', () => {
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cat', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj1);
            tree.insert(obj2);
            expect(tree.rootNode.items.length).toBe(2);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 2" +
                "\n..cat - [0 0 0 1 1 1]" +
                "\n..dog - [0 0 0 1 1 1]");
        });

        it('subdivides when nodes fill up', () => {
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cat', new OctBound(0, 0, 0, 1, 1, 1));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            expect(tree.rootNode.items.length).toBe(0);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n......cat - [0 0 0 1 1 1]" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]");
        });

        it('collapses when nodes are removed', () => {
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cat', new OctBound(0, 0, 0, 1, 1, 1));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            tree.remove(obj2);
            expect(tree.rootNode.items.length).toBe(2);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 2" +
                "\n..dog - [0 0 0 1 1 1]" +
                "\n..mouse - [0 0 0 1 1 1]");
        });

        it('Adds items to nodes that they intersect', () => {
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cat', new OctBound(3, 0, 0, 4, 1, 1));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
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

        
        it('Collapse nodes with separate children', () => {
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cat', new OctBound(3, 0, 0, 4, 1, 1));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            tree.remove(obj2);
            expect(tree.rootNode.items.length).toBe(2);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 2" +
                "\n..dog - [0 0 0 1 1 1]" +
                "\n..mouse - [0 0 0 1 1 1]");
        });

        it('can have items in multiple nodes', () => { 
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cow', new OctBound(3, 3, 3, 4, 4, 5));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
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
                "\n######[2 2 2 4 4 4] - 1" +
                "\n......cow - [3 3 3 4 4 5]" +
                "\n####[0 0 4 4 4 8] - 1" +
                "\n....cow - [3 3 3 4 4 5]");
        });

        it(`collapsing items does'nt cause duplicates`, () => { 
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cow', new OctBound(3, 3, 3, 4, 4, 5));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
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
                "\n......cow - [3 3 3 4 4 5]" +
                "\n####[0 0 4 4 4 8] - 1" +
                "\n....cow - [3 3 3 4 4 5]");
            
            tree.remove(obj1);
            // cow only has one item even though it was in 2 children
            expect(TreeState(tree)).withContext('after').toBe(
                "\n##[0 0 0 8 8 8] - 2" +
                "\n..cow - [3 3 3 4 4 5]" +
                "\n..mouse - [0 0 0 1 1 1]");
        });

        it('can remove items in multiple nodes', () => {
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('house', new OctBound(0, 0, 0, 4, 4, 4));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            tree.remove(obj2);
            expect(tree.rootNode.items.length).toBe(2);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 2" +
                "\n..dog - [0 0 0 1 1 1]" +
                "\n..mouse - [0 0 0 1 1 1]");
        });

        it('can move items between nodes', () => { 
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cow', new OctBound(3, 3, 3, 4, 4, 4));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
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
                "\n......cow - [3 3 3 4 4 4]");
            
            tree.update(obj2, new OctBound(0, 0, 0, 1, 1, 1));

            expect(TreeState(tree)).withContext('after').toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n......cow - [0 0 0 1 1 1]" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]");
        });

        it('can move items that span multiple child nodes', () => { 
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cow', new OctBound(3, 3, 3, 5, 4, 4));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
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
                "\n......cow - [3 3 3 5 4 4]" +
                "\n####[4 0 0 8 4 4] - 1" +
                "\n....cow - [3 3 3 5 4 4]");

            tree.update(obj2, new OctBound(3, 2, 0, 4, 3, 1));

            expect(TreeState(tree)).withContext('after').toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 2" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]" +
                "\n######[2 2 0 4 4 2] - 1" +
                "\n......cow - [3 2 0 4 3 1]");
        });

        it('Stores large objects higher up the tree', () => { 
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('cat', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
            const obj4 = new TestObject('truck', new OctBound(0, 0, 0, 5, 1, 1));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            tree.insert(obj4);
            // truck doesn't get pushed down because it's too big
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 4" +
                "\n..truck - [0 0 0 5 1 1]" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n......cat - [0 0 0 1 1 1]" +
                "\n......dog - [0 0 0 1 1 1]" +
                "\n......mouse - [0 0 0 1 1 1]");
        });

        it('gets each unique item once within a bound', () => {
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cow', new OctBound(3, 3, 3, 5, 4, 4));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
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
                "\n......cow - [3 3 3 5 4 4]" +
                "\n####[4 0 0 8 4 4] - 1" +
                "\n....cow - [3 3 3 5 4 4]");
            
            const items: TestObject[] = [];
            let searchBounds = new OctBound(0, 0, 0, 1, 1, 1);
            tree.getItemsInBounds(searchBounds,items);
            expect(ItemList(searchBounds,items)).withContext("single node").toBe(
                "\n## [0 0 0 1 1 1]" +
                "\ndog - [0 0 0 1 1 1]" +
                "\nmouse - [0 0 0 1 1 1]");
            
            items.length = 0;
            searchBounds = new OctBound(1, 1, 1, 8, 8, 8);
            tree.getItemsInBounds(searchBounds,items);
            expect(ItemList(searchBounds,items)).withContext("single node").toBe(
                "\n## [1 1 1 8 8 8]" +
                "\ncow - [3 3 3 5 4 4]");
        });

    });
}

class TestObject implements IhasOctBounds {
    constructor(public name: string, public octBounds: OctBound) {
    }

    toString() {
        return this.name + " - " + this.octBounds.toString();
    }
}

function ItemList(bounds: OctBound,items: TestObject[]) {
    items.sort((a, b) => a.name.localeCompare(b.name));
    return "\n## " + bounds.toString() + "\n" + items.map(item => item.toString()).join('\n');
}

function TreeState(tree: SparseOctTree<TestObject>): string {
    return NodeState(tree.rootNode,1);
}

function NodeState(node: SparseOctTreeNode<TestObject>,depth: number): string {
    if (node.children.length > 0 || node.items.length > 0 || node.totalItems > 0)
    {
        let s = '\n' + '##'.repeat(depth) + node.bounds.toString() + " - " + node.totalItems;
        // sort node items by name for consistent output
        node.items.sort((a, b) => {
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1;
            return 0;
        });
        for (let i = 0; i < node.items.length; i++)
        {
            s += '\n' + '..'.repeat(depth) + node.items[i].name + " - " + node.items[i].octBounds.toString();
        }
        for (let i = 0; i < node.children.length; i++)
        {
            s += NodeState(node.children[i],depth + 1);
        }
        return s;
    }
    return "";
}