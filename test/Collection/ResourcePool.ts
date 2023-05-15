import { ResourcePool } from ".."; // Adjust the import path according to your project structure

export function TestResourcePool() {

    describe("Resource Pool", () => {
        class TestItem {
            public value: number;

            constructor() {
                this.value = 0;
            }
        }

        function ResetFn(item: TestItem): void {
            item.value = 0;
        }

        const initialSize = 5;
        let pool: ResourcePool<TestItem>;

        beforeEach(() => {
            pool = new ResourcePool<TestItem>(() => new TestItem(), ResetFn, initialSize);
        });

        it("should resize the pool correctly", () => {
            const additionalItems = 5;
            const totalItems = initialSize + additionalItems;

            // Add items beyond the initial size to trigger resizing
            const ids: number[] = [];
            for (let i = 0; i < totalItems; i++) {
                ids.push(pool.add());
            }

            // Check if all items were added correctly
            for (const id of ids) {
                expect(pool.get(id)).not.toBeNull();
            }

            // Check if the pool has resized correctly
            expect(pool.count).toBe(totalItems);
        });


        it("should return null for freed items", () => {
            const ids: number[] = [];
            for (let i = 0; i < 5; i++) {
                ids.push(pool.add());
            }

            const releaseId = ids[2];
            pool.release(releaseId);

            const freedItem = pool.get(releaseId);
            expect(freedItem).toBeNull();
        });

        it("should create an instance with the correct initial size", () => {
            for (let i = 0; i < initialSize; i++) {
                const id = pool.add();
                expect(pool.get(id)).not.toBeNull();
            }
        });

        it("should return null for unallocated items", () => {
            const id = initialSize + 1;
            const unallocatedItem = pool.get(id);
            expect(unallocatedItem).toBeNull();
        });

        it("should release and reuse items correctly", () => {
            const ids: number[] = [];
            for (let i = 0; i < 10; i++) {
                ids.push(pool.add());
            }

            const releaseId = ids[2];
            const item = pool.get(releaseId);
            if (item) {
                item.value = 42;
            }

            pool.release(releaseId);

            const reuseId = pool.add();
            expect(reuseId).toBe(releaseId);
            const reusedItem = pool.get(reuseId);
            expect(reusedItem).not.toBeNull();
            if (reusedItem) {
                expect(reusedItem.value).toBe(0); // Expect the item to be reset
            }

            const newId = pool.add();
            expect(newId).toBe(pool.count - 1);
        });



        it("should handle acquiring items beyond the initial size", () => {
            for (let i = 0; i < initialSize; i++) {
                pool.add();
            }

            const id = pool.add();
            expect(pool.get(id)).not.toBeNull();
        });

        it("should reset released and re-added pool items without recreating them", () => {
            const ids: number[] = [];
            for (let i = 0; i < 10; i++) {
                ids.push(pool.add());
            }

            const releaseId = ids[2];
            const item = pool.get(releaseId);
            if (item) {
                item.value = 42;
            }

            pool.release(releaseId);

            const reuseId = pool.add();
            expect(reuseId).toBe(releaseId);
            const reusedItemAfterReAdd = pool.get(reuseId);
            expect(reusedItemAfterReAdd).not.toBeNull();
            if (reusedItemAfterReAdd) {
                expect(reusedItemAfterReAdd.value).toBe(0); // Expect the item to be reset
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                expect(reusedItemAfterReAdd).toBe(item as any); // Expect the reused item to be the same instance
            }
        });

    });

}