import { SparseOctTree, SparseOctTreeNode, OctBound, IhasOctBounds } from ".."

export function TestSparseOctTree() {
        
    describe('SparseOctTree', () => {

        it('contains one object', () => {
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj);
            expect(tree.rootNode.objects.length).toBe(1);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 1" +
                "\n  dog - [0 0 0 1 1 1]");
        });

        it('contains two objects', () => {
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cat', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj1);
            tree.insert(obj2);
            expect(tree.rootNode.objects.length).toBe(2);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 2" +
                "\n  dog - [0 0 0 1 1 1]" +
                "\n  cat - [0 0 0 1 1 1]");
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
            expect(tree.rootNode.objects.length).toBe(0);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n      cat - [0 0 0 1 1 1]" +
                "\n      mouse - [0 0 0 1 1 1]" +
                "\n      dog - [0 0 0 1 1 1]");
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
            expect(tree.rootNode.objects.length).toBe(2);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 2" +
                "\n  dog - [0 0 0 1 1 1]" +
                "\n  mouse - [0 0 0 1 1 1]");
        });

        it('Adds items nodes that they intersect', () => {
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cat', new OctBound(3, 0, 0, 4, 1, 1));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            expect(tree.rootNode.objects.length).toBe(0);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 2" +
                "\n      mouse - [0 0 0 1 1 1]" +
                "\n      dog - [0 0 0 1 1 1]" +
                "\n######[2 0 0 4 2 2] - 1" +
                "\n      cat - [3 0 0 4 1 1]");
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
            expect(tree.rootNode.objects.length).toBe(2);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 2" +
                "\n  mouse - [0 0 0 1 1 1]" +
                "\n  dog - [0 0 0 1 1 1]");
        });

        it('can have items in multiple nodes', () => { 
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('house', new OctBound(0, 0, 0, 4, 4, 4));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            expect(tree.rootNode.objects.length).toBe(0);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n      house - [0 0 0 4 4 4]" +
                "\n      mouse - [0 0 0 1 1 1]" +
                "\n      dog - [0 0 0 1 1 1]" +
                "\n######[0 2 0 2 4 2] - 1" +
                "\n      house - [0 0 0 4 4 4]" +
                "\n######[2 0 0 4 2 2] - 1" +
                "\n      house - [0 0 0 4 4 4]" +
                "\n######[2 2 0 4 4 2] - 1" +
                "\n      house - [0 0 0 4 4 4]" +
                "\n######[0 0 2 2 2 4] - 1" +
                "\n      house - [0 0 0 4 4 4]" +
                "\n######[0 2 2 2 4 4] - 1" +
                "\n      house - [0 0 0 4 4 4]" +
                "\n######[2 0 2 4 2 4] - 1" +
                "\n      house - [0 0 0 4 4 4]" +
                "\n######[2 2 2 4 4 4] - 1" +
                "\n      house - [0 0 0 4 4 4]");
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
            expect(tree.rootNode.objects.length).toBe(2);
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 2" +
                "\n  dog - [0 0 0 1 1 1]" +
                "\n  mouse - [0 0 0 1 1 1]");
        });

        it('can move items between nodes', () => { 
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cat', new OctBound(3, 0, 0, 4, 1, 1));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            tree.update(obj2, new OctBound(0, 0, 0, 1, 1, 1));
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n      mouse - [0 0 0 1 1 1]" +
                "\n      dog - [0 0 0 1 1 1]" +
                "\n      cat - [0 0 0 1 1 1]");
        });

        it('can move objects that span nodes', () => { 
            const bounds = new OctBound(0, 0, 0, 8, 8, 8);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 2);
            const obj1 = new TestObject('car', new OctBound(0, 0, 0, 4, 1, 1));
            const obj2 = new TestObject('cat', new OctBound(0, 0, 0, 1, 1, 1));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            // before
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n      cat - [0 0 0 1 1 1]" +
                "\n      mouse - [0 0 0 1 1 1]" +
                "\n      car - [0 0 0 4 1 1]" +
                "\n######[2 0 0 4 2 2] - 1" +
                "\n      car - [0 0 0 4 1 1]");
            tree.update(obj1, new OctBound(1, 0, 0, 5, 1, 1));
            // after
            expect(TreeState(tree)).toBe(
                "\n##[0 0 0 8 8 8] - 3" +
                "\n####[0 0 0 4 4 4] - 3" +
                "\n######[0 0 0 2 2 2] - 3" +
                "\n      cat - [0 0 0 1 1 1]" +
                "\n      mouse - [0 0 0 1 1 1]" +
                "\n      car - [1 0 0 5 1 1]" +
                "\n######[2 0 0 4 2 2] - 1" +
                "\n      car - [1 0 0 5 1 1]" +
                "\n####[4 0 0 8 4 4] - 1" +
                "\n    car - [1 0 0 5 1 1]");
        });

    });
}

class TestObject implements IhasOctBounds {
    constructor(public name: string, public octBounds: OctBound) {
    }
}

function TreeState(tree: SparseOctTree<TestObject>): string {
    return NodeState(tree.rootNode,1);
}

function NodeState(node: SparseOctTreeNode<TestObject>,depth: number): string {
    if (node.children.length > 0 || node.objects.length > 0)
    {
        let s = '\n' + '##'.repeat(depth) + node.bounds.toString() + " - " + node.totalItems;
        for (let i = 0; i < node.children.length; i++)
        {
            s += NodeState(node.children[i],depth + 1);
        }
        for (let i = 0; i < node.objects.length; i++)
        {
            s += '\n' + '  '.repeat(depth) + node.objects[i].name + " - " + node.objects[i].octBounds.toString();
        }
        return s;
    }
    return "";
}