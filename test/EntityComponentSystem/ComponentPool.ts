import { ComponentPool } from ".."; // Adjust the import path according to your project structure

export function TestComponentPool() {

    describe("ComponentPool", () => {
        class TestComponent {
            public value: number;

            constructor() {
                this.value = 0;
            }
        }

        function ResetFn(component: TestComponent): void {
            component.value = 0;
        }

        const initialSize = 5;
        let pool: ComponentPool<TestComponent>;

        beforeEach(() => {
            pool = new ComponentPool(() => new TestComponent(), ResetFn, initialSize);
        });

        it("should create an instance with the correct initial size", () => {
            for (let i = 0; i < initialSize; i++) {
                const id = pool.add();
                expect(pool.get(id)).not.toBeNull();
            }
        });

        it("should release and reuse components correctly", () => {
            const ids: number[] = [];
            for (let i = 0; i < 10; i++) {
                ids.push(pool.add());
            }

            const releaseId = ids[2];
            const component = pool.get(releaseId);
            if (component) {
                component.value = 42;
            }

            pool.release(releaseId);

            const reuseId = pool.add();
            expect(reuseId).toBe(releaseId);
            const reusedComponent = pool.get(reuseId);
            expect(reusedComponent).not.toBeNull();
            if (reusedComponent) {
                expect(reusedComponent.value).toBe(0); // Expect the component to be reset
            }

            const newId = pool.add();
            expect(newId).toBe(pool.count - 1);
        });



        it("should handle acquiring components beyond the initial size", () => {
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
            const component = pool.get(releaseId);
            if (component) {
                component.value = 42;
            }

            pool.release(releaseId);

            const reuseId = pool.add();
            expect(reuseId).toBe(releaseId);
            const reusedComponentAfterReAdd = pool.get(reuseId);
            expect(reusedComponentAfterReAdd).not.toBeNull();
            if (reusedComponentAfterReAdd) {
                expect(reusedComponentAfterReAdd.value).toBe(0); // Expect the component to be reset
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                expect(reusedComponentAfterReAdd).toBe(component as any); // Expect the reused component to be the same instance
            }
        });

    });

}