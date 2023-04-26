import { ResourcePool } from '../Collection/ResourcePool';
import { StateMachine } from './StateMachine';

abstract class StateHandler<T> {
  private _items: number[];
  private _itemIndex: number[];
  public requiredStateFlags: number;

  constructor() {
    this._items = [];
    this._itemIndex = [];
    this.requiredStateFlags = 0;
  }

  addItem(itemId: number): void {
    const newIndex = this._items.length;
    this._items.push(itemId);
    this._itemIndex[itemId] = newIndex;
  }

  removeItems(itemId: number): void {
    const indexToRemove = this._itemIndex[itemId];
    if (indexToRemove === undefined) {
      return;
    }

    const lastIndex = this._items.length - 1;

    if (indexToRemove !== lastIndex) {
      const lastItemId = this._items[lastIndex];
      this._items[indexToRemove] = lastItemId;
      this._itemIndex[indexToRemove] = lastItemId;
    }

    this._items.pop();
  }

  tick(stateMachine: StateMachine<T>,allEntities: Array<T>): void {
    this.handler(stateMachine, allEntities, this._items);
  }

  abstract handler(stateMachine: StateMachine<T>, allEntities: Array<T>, itemIds: number[]): void;

}

export { StateHandler };