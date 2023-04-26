class ResourcePool<T> {
  private _pool: (T)[];
  private _free: number[];
  private _createFn: () => T;
  private _resetFn: (item: T) => void;
  private _initialSize: number;
  private _freeCount: number;
  private _poolCount: number;

  constructor(createFn: () => T, resetFn: (item: T) => void, initialSize = 10) {
    this._createFn = createFn;
    this._resetFn = resetFn;
    this._initialSize = initialSize;
    this._pool = new Array<T>(this._initialSize);
    this._free = new Array<number>(this._initialSize).fill(-1);
    this._freeCount = 0;
    this._poolCount = 0;
  }

  public add(): number {
    let id: number;
    if (this._freeCount > 0) {
      id = this._free[--this._freeCount];
    } else {
      id = this._poolCount;
      this._poolCount++;
      this._pool[id] = this._createFn();
    }

    return id;
  }

  public release(id: number): void {
    const item = this._pool[id];
    if (item) {
      this._resetFn(item);
      this._free[this._freeCount++] = id;
    } else {
      console.warn(`Item with ID ${id} not found in the pool.`);
    }
  }

  public get count(): number {
    return this._poolCount - this._freeCount;
  }

  /**
   * 
   * @param id the ID of a previously added resource
   * @returns the item with the given ID or null if the ID is invalid
   * @WARNING this method does not check if the item has been released
   */
  public get(id: number): T | null {
    if (id >= this._poolCount) {
      return null;
    }
    return this._pool[id] || null;
  }

  public contents(): T[] {
    return this._pool;
  }
}

export { ResourcePool };
