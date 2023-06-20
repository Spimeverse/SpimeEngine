import { ResourcePool, IhasPoolId } from "..";

class SparseSet {

  private _dense: Uint32Array;
  private _sparse: Uint32Array;
  private _capacity: number;
  private _count = 0;

  constructor(size: number) {
    this._capacity = size;
    this._dense = new Uint32Array(this._capacity);
    this._sparse = new Uint32Array(this._capacity);
  }

  private _resize(): void {
    this._capacity += this._capacity;
    const newDense = new Uint32Array(this._capacity);
    const newSparse = new Uint32Array(this._capacity);

    newDense.set(this._dense);
    newSparse.set(this._sparse);

    this._dense = newDense;
    this._sparse = newSparse;
  }

  public contains(id: number): boolean {
    return this._sparse[id] < this._count && this._dense[this._sparse[id]] === id;
  }

  public add(id: number): void {
    if (id >= this._capacity) {
      this._resize();
    }
    if (!this.contains(id)) {
      this._dense[this._count] = id;
      this._sparse[id] = this._count;
      this._count++;
    }
  }

  public remove(id: number): void {
    if (this.contains(id)) {
      const temp = this._dense[--this._count];
      this._dense[this._sparse[id]] = temp;
      this._sparse[temp] = this._sparse[id];
    }
  }

  public clear(): void {
    this._count = 0;
  }

  public get usedCount(): number {
    return this._count;
  }

  // get all the ids in the set
  public allIndex(): Uint32Array {
    return this._dense;
  }

}

export { SparseSet };
