interface IhasPoolId {
  poolId: number;
}

class ResourcePool<T extends IhasPoolId> {
  private _pool: (T)[];
  private _free: Uint32Array;
  private _createFn: () => T;
  private _resetFn: (item: T) => void;
  private _capacity: number;
  private _freeCount: number;
  private _poolCount: number;
  private _allocated: Uint8Array;
  private _blockSize: number;

  constructor(createFn: () => T, resetFn: (item: T) => void, initialSize = 1000) {
    this._createFn = createFn;
    this._resetFn = resetFn;
    this._capacity = initialSize;
    this._pool = new Array<T>(this._capacity);
    this._free = new Uint32Array(this._capacity);
    for (let i = 0; i < this._capacity; i++) {
      this._free[i] = i;
      this._pool[i] = this._createFn();
      this._pool[i].poolId = i;
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

  public newItem(): T {
    const id = this.newId();
    return this._pool[id];
  }

/**
 * Returns a new ID for an item in the pool.
 * If there are any free IDs available, it will reuse one of those.
 * Otherwise, it will create a new ID and resize the pool if necessary.
 * @returns A new ID for an item in the pool.
 */
public newId(): number {
  let id: number;

  // If there are any free IDs available, reuse one of those
  if (this._freeCount > 0) {
    id = this._free[--this._freeCount];
  } else {
    // Otherwise, create a new ID and resize the pool if necessary
    id = this._poolCount++;

    if (id >= this._capacity) {
      this._resizeArrays();
    }

    // Create a new item using the _createFn and assign it the new ID
    this._pool[id] = this._createFn();
    this._pool[id].poolId = id;
  }

  // Mark the ID as allocated and return it
  this._allocated[id] = 1;
  return id;
}

  public releaseItem(item: T): void {
    this.releaseId(item.poolId);
  }

  public releaseId(id: number): void {
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
  public getItem(id: number): T | null {
    if (id >= this._pool.length || this._allocated[id] === 0) {
      return null;
    }
    return this._pool[id] || null;
  }

  /**
   * 
   * @returns an array of all items in the pool (including free items)
   */
  public contents(): T[] {
    return this._pool;
  }
}

export { ResourcePool, IhasPoolId };
