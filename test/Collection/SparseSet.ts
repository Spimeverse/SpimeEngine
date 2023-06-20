import { SparseSet } from ".."; 

export function TestSparseSet() {

  describe("Sparse Set", () => {
    const initialSize = 10;
    let set: SparseSet;

    beforeEach(() => {
      set = new SparseSet(initialSize);
    });

    it("should add items correctly", () => {
      for (let i = 0; i < initialSize; i++) {
        set.add(i);
        expect(set.contains(i)).toBe(true);
      }
      expect(set.usedCount).toBe(initialSize);
    });

    it("should not add duplicate items", () => {
      set.add(1);
      set.add(1);
      expect(set.usedCount).toBe(1);
      expect(set.contains(1)).toBe(true);
    });

    it("should remove items correctly", () => {
      set.add(1);
      set.remove(1);
      expect(set.contains(1)).toBe(false);
      expect(set.usedCount).toBe(0);
    });

    it("should not remove items not in the set", () => {
      set.add(1);
      set.remove(2);
      expect(set.usedCount).toBe(1);
      expect(set.contains(1)).toBe(true);
      expect(set.contains(2)).toBe(false);
    });

    it("should clear the set correctly", () => {
      for (let i = 0; i < initialSize; i++) {
        set.add(i);
      }
      set.clear();
      expect(set.usedCount).toBe(0);
      for (let i = 0; i < initialSize; i++) {
        expect(set.contains(i)).toBe(false);
      }
    });

    it("should handle contains checks for items not in the set", () => {
      expect(set.contains(1)).toBe(false);
      set.add(1);
      expect(set.contains(1)).toBe(true);
      expect(set.contains(2)).toBe(false);
    });
      
      it("should resize the set correctly", () => {
          const initialSize = 10;
          const set = new SparseSet(initialSize);

          // Add items beyond the initial size to trigger resizing
          for (let i = 0; i < initialSize * 2; i++) {
              set.add(i);
          }

          // Check if all items were added correctly
          for (let i = 0; i < initialSize * 2; i++) {
              expect(set.contains(i)).toBe(true);
          }

          // Check if the count is correct
          expect(set.usedCount).toBe(initialSize * 2);
      });

  });

}
