import { LinkedList } from ".."; 

class TestObject {
    constructor(public name: string, public score: number) { }
}

export function TestLinkedList() {

    describe("Linked List", () => {

        it('can append new items', () => {
            const list = new LinkedList<TestObject>();
            list.append(new TestObject("Bob", 100));
            list.append(new TestObject("Sally", 200));
            list.append(new TestObject("Joe", 300));
            expect(list.count).toBe(3);
            expect(ListContents(list)).withContext("Forward").toBe("Bob:100, Sally:200, Joe:300");
            expect(ReverseContents(list)).withContext("Backwards").toBe("Joe:300, Sally:200, Bob:100");
        })

        it('can remove items', () => {
            const list = new LinkedList<TestObject>();
            list.append(new TestObject("Bob", 100));
            list.append(new TestObject("Sally", 200));
            list.append(new TestObject("Joe", 300));
            list.remove(list.first);
            expect(list.count).toBe(2);
            expect(ListContents(list)).withContext("Forward").toBe("Sally:200, Joe:300");
            expect(ReverseContents(list)).withContext("Backwards").toBe("Joe:300, Sally:200");
        })

        it('can remove items from the middle', () => {
            const list = new LinkedList<TestObject>();
            list.append(new TestObject("Bob", 100));
            list.append(new TestObject("Sally", 200));
            list.append(new TestObject("Joe", 300));
            list.remove(list.first?.next);
            expect(list.count).toBe(2);
            expect(ListContents(list)).withContext("Forward").toBe("Bob:100, Joe:300");
            expect(ReverseContents(list)).withContext("Backwards").toBe("Joe:300, Bob:100");
        })

        it('can remove items from the end', () => {
            const list = new LinkedList<TestObject>();
            list.append(new TestObject("Bob", 100));
            list.append(new TestObject("Sally", 200));
            list.append(new TestObject("Joe", 300));
            list.remove(list.last);
            expect(list.count).toBe(2);
            expect(ListContents(list)).withContext("Forward").toBe("Bob:100, Sally:200");
            expect(ReverseContents(list)).withContext("Backwards").toBe("Sally:200, Bob:100");
        });

        it('can clear the list', () => {
            const list = new LinkedList<TestObject>();
            list.append(new TestObject("Bob", 100));
            list.append(new TestObject("Sally", 200));
            list.append(new TestObject("Joe", 300));
            list.clear();
            expect(list.count).toBe(0);
            expect(ListContents(list)).withContext("Forward").toBe("");
            expect(ReverseContents(list)).withContext("Backwards").toBe("");
        });

        it('can insert after another item', () => {
            const list = new LinkedList<TestObject>();
            list.append(new TestObject("Bob", 100));
            list.append(new TestObject("Sally", 200));
            list.append(new TestObject("Joe", 300));
            list.insertAfter(list.first, new TestObject("Sue", 400));
            expect(list.count).toBe(4);
            expect(ListContents(list)).withContext("Forward").toBe("Bob:100, Sue:400, Sally:200, Joe:300");
            expect(ReverseContents(list)).withContext("Backwards").toBe("Joe:300, Sally:200, Sue:400, Bob:100");
        });

        it('can insert after after last item', () => {
            const list = new LinkedList<TestObject>();
            list.append(new TestObject("Bob", 100));
            list.append(new TestObject("Sally", 200));
            list.append(new TestObject("Joe", 300));
            list.insertAfter(list.last, new TestObject("Sue", 400));
            expect(list.count).toBe(4);
            expect(ListContents(list)).withContext("Forward").toBe("Bob:100, Sally:200, Joe:300, Sue:400");
            expect(ReverseContents(list)).withContext("Backwards").toBe("Sue:400, Joe:300, Sally:200, Bob:100");
        });

        it('can insert before another item', () => {
            const list = new LinkedList<TestObject>();
            list.append(new TestObject("Bob", 100));
            list.append(new TestObject("Sally", 200));
            list.append(new TestObject("Joe", 300));
            list.insertBefore(list.last, new TestObject("Sue", 400));
            expect(list.count).toBe(4);
            expect(ListContents(list)).withContext("Forward").toBe("Bob:100, Sally:200, Sue:400, Joe:300");
            expect(ReverseContents(list)).withContext("Backwards").toBe("Joe:300, Sue:400, Sally:200, Bob:100");
        });

        it('can insert before first item', () => {
            const list = new LinkedList<TestObject>();
            list.append(new TestObject("Bob", 100));
            list.append(new TestObject("Sally", 200));
            list.append(new TestObject("Joe", 300));
            list.insertBefore(list.first, new TestObject("Sue", 400));
            expect(list.count).toBe(4);
            expect(ListContents(list)).withContext("Forward").toBe("Sue:400, Bob:100, Sally:200, Joe:300");
            expect(ReverseContents(list)).withContext("Backwards").toBe("Joe:300, Sally:200, Bob:100, Sue:400");
        });

        it('can prepend items', () => {
            const list = new LinkedList<TestObject>();
            list.prepend(new TestObject("Bob", 100));
            list.prepend(new TestObject("Sally", 200));
            list.prepend(new TestObject("Joe", 300));
            expect(list.count).toBe(3);
            expect(ListContents(list)).withContext("Forward").toBe("Joe:300, Sally:200, Bob:100");
            expect(ReverseContents(list)).withContext("Backwards").toBe("Bob:100, Sally:200, Joe:300");
        });

        it('can be ordered', () => {
            const list = new LinkedList<TestObject>();
            const order = (a: TestObject, b: TestObject) => a.name.localeCompare(b.name);
            list.insertOrdered(new TestObject("Bob", 100), order);
            list.insertOrdered(new TestObject("Sally", 200), order);
            list.insertOrdered(new TestObject("Joe", 300), order);
            list.insertOrdered(new TestObject("Albert", 400), order);
            list.insertOrdered(new TestObject("Zoe", 500), order);
            expect(list.count).toBe(5);
            expect(ListContents(list)).withContext("Forward").toBe("Albert:400, Bob:100, Joe:300, Sally:200, Zoe:500");
            expect(ReverseContents(list)).withContext("Backwards").toBe("Zoe:500, Sally:200, Joe:300, Bob:100, Albert:400");
        });

    });
}

function ListContents(list: LinkedList<TestObject>): string {
    let result = "";
    let current = list.first;
    while (current) {
        result += current.value.name + ":" + current.value.score;
        if (current.next) {
            result += ", ";
        }
        current = current.next;
    }
    return result;
}

function ReverseContents(list: LinkedList<TestObject>): string {
    let result = "";
    let current = list.last;
    while (current) {
        result += current.value.name + ":" + current.value.score;
        if (current.previous) {
            result += ", ";
        }
        current = current.previous;
    }
    return result;
}

