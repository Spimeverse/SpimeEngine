class ResourcePool<T> {
  private _pool: (T)[];
  private _free: Uint32Array;
  private _createFn: (id: number) => T;
  private _resetFn: (item: T) => void;
  private _capacity: number;
  private _freeCount: number;
  private _poolCount: number;
  private _allocated: Uint8Array;
  private _blockSize: number;

  constructor(createFn: (id: number) => T, resetFn: (item: T) => void, initialSize = 1000) {
    this._createFn = createFn;
    this._resetFn = resetFn;
    this._capacity = initialSize;
    this._pool = new Array<T>(this._capacity);
    this._free = new Uint32Array(this._capacity);
    for (let i = 0; i < this._capacity; i++) {
      this._free[i] = i;
      this._pool[i] = this._createFn(i);
    }
    this._freeCount = this._capacity;
    this._poolCount = this._capacity;
    this._allocated = new Uint8Array(this._capacity);
    this._blockSize = initialSize;
  }

  private _resizeArrays(): void {
    const newSize = this._capacity + this._blockSize;
    console.warn('Resizing resource pool arrays', this._capacity, '->', newSize);

    // Resize _free and _allocated arrays
    const newFree = new Uint32Array(newSize);
    const newAllocated = new Uint8Array(newSize);

    newFree.set(this._free);
    newAllocated.set(this._allocated);

    this._free = newFree;
    this._allocated = newAllocated;
    this._capacity = newSize;
  }

  public add(): number {
    let id: number;
    if (this._freeCount > 0) {
      id = this._free[--this._freeCount];
    } else {
      id = this._poolCount++;

      if (id >= this._capacity) {
        this._resizeArrays();
      }
      this._pool[id] = this._createFn(id);
    }

    this._allocated[id] = 1;
    return id;
  }

  public release(id: number): void {
    const item = this._pool[id];
    if (item && this._allocated[id]) {
      this._resetFn(item);
      this._free[this._freeCount++] = id;
      this._allocated[id] = 0;
    }
  }

  public get count(): number {
    return this._poolCount - this._freeCount;
  }

  public get capacity(): number {
    return this._capacity;
  }

  /**
   * 
   * @param id the ID of a previously added resource
   * @returns the item with the given ID or null if the ID is invalid
   */
  public get(id: number): T | null {
    if (id >= this._pool.length || this._allocated[id] === 0) {
      return null;
    }
    return this._pool[id] || null;
  }

  public contents(): T[] {
    return this._pool;
  }
}

export { ResourcePool };
