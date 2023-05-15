import { StateMachine } from './StateMachine';

type StateCallback<T> = (stateMachine: StateMachine<T>, allItems: Array<T>, itemIds: Uint32Array, itemCount: number) => void;

class StateHandler<T> {

  private _items: Uint32Array;
  private _itemsEntered: Uint32Array;
  private _itemsExited: Uint32Array;
  private _itemIndex: Uint32Array;
  private _itemsCount: number;
  private _itemsEnteredCount: number;
  private _itemsExitedCount: number;
  private _onEntryHandler: StateCallback<T> | null = null;
  private _onExitHandler: StateCallback<T> | null = null;
  private _onTick: StateCallback<T> | null = null;
  private _blockSize = 1000;

  constructor(initialSize = 1000) {
    this._items = new Uint32Array(initialSize);
    this._itemsEntered = new Uint32Array(initialSize);
    this._itemsExited = new Uint32Array(initialSize);
    this._itemIndex = new Uint32Array(initialSize);
    this._itemsCount = 0;
    this._itemsEnteredCount = 0;
    this._itemsExitedCount = 0;
    this._blockSize = initialSize;
  }

  private _resizeArray(array: Uint32Array, newSize: number): Uint32Array {
    const newArray = new Uint32Array(newSize);
    newArray.set(array);
    return newArray;
  }

  resize(newSize: number) {
    this._itemIndex = this._resizeArray(this._itemIndex, newSize);
  }

  addItem(itemId: number): void {
    // Resize the arrays if needed
    if (this._itemsCount >= this._items.length) {
      const newSize = this._items.length + this._blockSize;
      console.warn('Resizing state handler arrays', this._items.length, '->', newSize);

      this._items = this._resizeArray(this._items, newSize);
    }
    const newIndex = this._itemsCount;
    this._items[this._itemsCount++] = itemId;
    this._itemIndex[itemId] = newIndex;
    if (this._onEntryHandler !== null) {
      // Resize the arrays if needed
      if (this._itemsEnteredCount === this._itemsEntered.length) {
        console.warn('Resizing state handler item entered', this._itemsEntered.length, '->', this._itemsEntered.length + this._blockSize);
        this._itemsEntered = this._resizeArray(this._itemsEntered, this._itemsEntered.length + this._blockSize);
      }
      this._itemsEntered[this._itemsEnteredCount++] = itemId;
    }
  }

  removeItems(itemId: number): void {
    const indexToRemove = this._itemIndex[itemId];
    if (indexToRemove === undefined) {
      return;
    }

    const lastIndex = this._itemsCount - 1;

    if (indexToRemove !== lastIndex) {
      const lastItemId = this._items[lastIndex];
      this._items[indexToRemove] = lastItemId;
      this._itemIndex[lastItemId] = indexToRemove;
    }

    if (this._onExitHandler !== null) {
      // Resize the arrays if needed
      if (this._itemsExitedCount === this._itemsExited.length) {
        console.warn('Resizing state handler item exited', this._itemsExited.length, '->', this._itemsExited.length + this._blockSize);
        this._itemsExited = this._resizeArray(this._itemsExited, this._itemsExited.length + this._blockSize);
      }

      this._itemsExited[this._itemsExitedCount++] = itemId;
    }
    this._itemsCount--;
  }

  onTick(callback: StateCallback<T>) {
    this._onTick = callback;
    return this;
  }

  onEntry(callback: StateCallback<T>) {
    this._onEntryHandler = callback;
    return this;
  }

  onExit(callback: StateCallback<T>) {
    this._onExitHandler = callback;
    return this;
  }

  tick(stateMachine: StateMachine<T>, allItems: Array<T>): void {
    if (this._onEntryHandler !== null) {
      this._onEntryHandler(stateMachine, allItems, this._itemsEntered, this._itemsEnteredCount);
      this._itemsEnteredCount = 0;
    }

    if (this._onTick !== null) {
      this._onTick(stateMachine, allItems, this._items, this._itemsCount);
    }

    if (this._onExitHandler !== null) {
      this._onExitHandler(stateMachine, allItems, this._itemsExited, this._itemsExitedCount);
      this._itemsExitedCount = 0;
    }
  }

}

export { StateHandler, StateCallback };
