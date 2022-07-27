import { SparseOctTree, SparseOctTreeNode, OctBound, IhasOctBounds } from ".."

export function TestSparseOctTree() {
        
    describe('SparseOctTree', () => {

        it('contains one object', () => {
            const bounds = new OctBound(0, 0, 0, 10, 10, 10);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 0.1);
            const obj = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj);
            expect(tree.rootNode.objects.length).toBe(1);
            expect(TreeState(tree)).toBe(
                "\nNode-- [0 0 0 10 10 10]\n" +
                "Leaf#### dog - [0 0 0 1 1 1]");
        });

        it('contains two objects', () => {  
            const bounds = new OctBound(0, 0, 0, 10, 10, 10);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 0.1);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cat', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj1);
            tree.insert(obj2);
            expect(tree.rootNode.objects.length).toBe(2);
            expect(TreeState(tree)).toBe(
                "\nNode-- [0 0 0 10 10 10]\n" +
                "Leaf#### dog - [0 0 0 1 1 1]\n" +
                "Leaf#### cat - [0 0 0 1 1 1]");
        });

        it('contains three objects', () => {
            const bounds = new OctBound(0, 0, 0, 10, 10, 10);
            const tree = new SparseOctTree<TestObject>(bounds, 2, 0.1);
            const obj1 = new TestObject('dog', new OctBound(0, 0, 0, 1, 1, 1));
            const obj2 = new TestObject('cat', new OctBound(0, 0, 0, 1, 1, 1));
            const obj3 = new TestObject('mouse', new OctBound(0, 0, 0, 1, 1, 1));
            tree.insert(obj1);
            tree.insert(obj2);
            tree.insert(obj3);
            expect(tree.rootNode.objects.length).toBe(3);
            expect(TreeState(tree)).toBe(
                "\nNode-- [0 0 0 10 10 10]\n" +
                "Leaf#### dog - [0 0 0 1 1 1]\n" +
                "Leaf#### cat - [0 0 0 1 1 1]\n" +
                "Leaf#### mouse - [0 0 0 1 1 1]");
        });

    });
}

class TestObject implements IhasOctBounds {
    constructor(public name: string, public octBounds: OctBound) {
    }
}

function TreeState(tree: SparseOctTree<TestObject>): string {
    const s = `\nNode-- ${tree.rootNode.bounds.toString()}\n`;
    return s + NodeState(tree.rootNode,1);
}

function NodeState(node: SparseOctTreeNode<TestObject>,depth: number): string {
    if (node.children.length > 0) {
        const s = `${'Node--'.repeat(depth)} ${node.bounds.toString()}`;
        return s + node.children.map((c: SparseOctTreeNode<TestObject>) => NodeState(c,depth + 1)).join('\n');
    } else {
        return `${node.objects.map((o: TestObject) => `Leaf${'##'.repeat(depth + 1)} ${o.name} - ${o.octBounds.toString()}`).join('\n')}`;
    }
}
