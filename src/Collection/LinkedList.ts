
class LinkedListNode<T> {
    next: LinkedListNode<T> | null = null;
    previous: LinkedListNode<T> | null = null;
    constructor(public value: T) { }
}

class LinkedList<T> {


    count: number;
    first: LinkedListNode<T> | null = null;
    last: LinkedListNode<T> | null = null;

    constructor() {
        this.count = 0;
        this.first = null;
    }

    append(newItem: T) {
        const newNode = new LinkedListNode<T>(newItem);
        if (this.first) {
            if (this.last) {
                this.last.next = newNode;
                newNode.previous = this.last;
                this.last = newNode;
            }
        } else {
            this.first = newNode;
            this.last = newNode;
        }
        this.count++;
    }

    prepend(newItem: T) {
        const newNode = new LinkedListNode<T>(newItem);
        if (this.first) {
            newNode.next = this.first;
            this.first.previous = newNode;
            this.first = newNode;
        } else {
            this.first = newNode;
            this.last = newNode;
        }
        this.count++;
    }

    insertAfter(item: LinkedListNode<T> | null, newItem: T) {
        if (item) {
            const newNode = new LinkedListNode<T>(newItem);
            if (item == this.last) {
                this.last = newNode;
            }
            newNode.next = item.next;
            if (item.next) {
                item.next.previous = newNode;
            }
            newNode.previous = item;
            item.next = newNode;
            this.count++;
        }
    }

    insertBefore(item: LinkedListNode<T> | null, newItem: T) {
        if (item) {
            const newNode = new LinkedListNode<T>(newItem);
            if (item == this.first) {
                this.first = newNode;
            }
            newNode.previous = item.previous;
            if (item.previous) {
                item.previous.next = newNode;
            }
            newNode.next = item;
            item.previous = newNode;
            this.count++;
        }
    }

    insertOrdered(newItem: T, order: (a: T, b: T) => number) {
        if (this.first) {
            let current: LinkedListNode<T> | null = this.first;
            while (current) {
                if (order(newItem, current.value) < 0) {
                    this.insertBefore(current, newItem);
                    return;
                }
                current = current.next;
            }
        }
        this.append(newItem);
    }

    remove(itemNode: LinkedListNode<T> | null | undefined) {
        if (itemNode) {
            if (itemNode.previous) {
                itemNode.previous.next = itemNode.next;
            }
            if (itemNode.next) {
                itemNode.next.previous = itemNode.previous;
            }
            if (itemNode === this.first) {
                this.first = itemNode.next;
            }
            if (itemNode === this.last) {
                this.last = itemNode.previous;
            }
            this.count--;
        }
    }

    findFirst(matchFunction: (x: T) => boolean): LinkedListNode<T> | null {
        let current = this.first;
        while (current) {
            if (matchFunction(current.value)) {
                return current;
            }
            current = current.next;
        }
        return null;
    }

    clear() {
        this.first = null;
        this.last = null;
        this.count = 0;
    }

}

export { LinkedList, LinkedListNode };