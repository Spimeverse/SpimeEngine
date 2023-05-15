import { ResourcePool } from '../Collection/ResourcePool';
import { StateHandler } from './StateHandler';


interface StateType {
  name: string;
  stateFlag: number;
  handlerIndicies: number[];
}

// we don't really expect this many items
// mainly used to identify items for deferred removal
// item to remove item = item id - MAX_ITEMS
const MAX_ITEMS = 10_000_000;

const REMOVE_ALL_STATES = -1;

class StateMachineBuilder<T> {
  private _pool: ResourcePool<T>;
  private _stateTypes: StateType[];
  private _handlers: StateHandler<T>[];
  private _requiredStates: number[];
  private _pipeline: StateHandler<T>[];

  constructor(pool: ResourcePool<T>) {
    this._pool = pool;
    this._stateTypes = [];
    this._handlers = [];
    this._requiredStates = [];
    this._pipeline = [];
  }

  public registerState(typeName: string): number {
    const stateIndex = this._stateTypes.length;
    const stateFlag = 1 << stateIndex;
    this._stateTypes.push({
      name: typeName,
      stateFlag: stateFlag,
      handlerIndicies: [],
    });
    return stateIndex;
  }

  public registerHandler(...requiredStates: number[]): StateHandler<T> {
    if (requiredStates.length === 0) {
      throw new Error('No required states specified.');
    }
    const handler = new StateHandler<T>(this._pool.capacity);
    this._handlers.push(handler as StateHandler<T>);
    let requiredStateFlags = 0;
    for (const state of requiredStates) {
      const stateType = this._stateTypes[state];
      if (stateType) {
        requiredStateFlags |= stateType.stateFlag;
      } else {
        throw new Error(`State type "${state}" not found.`);
      }
      stateType.handlerIndicies.push(this._handlers.length - 1);
    }
    this._requiredStates.push(requiredStateFlags);
    return handler;
  }

  public registerPipeline(...handlers: StateHandler<T>[]): void {
    for (const handler of handlers) {
      if (this._handlers.indexOf(handler) === -1) {
        throw new Error('Unregistered handler passed to pipeline.');
      }
    }
    this._pipeline = handlers;
  }

  create(): StateMachine<T> {
    if (this._pipeline.length === 0) {
      throw new Error('No pipeline.');
    }
    if (this._handlers.length === 0) {
      throw new Error('No state handlers registered.');
    }
    if (this._stateTypes.length === 0) {
      throw new Error('No states registered.');
    }
    const stateMachine = new StateMachine(this._pool, this._stateTypes, this._handlers, this._requiredStates,this._pipeline,this._pool.capacity);

    return stateMachine;
  }
}

class StateMachine<T> {
  private _pool: ResourcePool<T>;
  private _registeredStates: StateType[];
  private _handlers: StateHandler<T>[];
  private _pipeline: StateHandler<T>[];
  private _itemStates: Uint32Array;
  private _itemStatesSize: number;
  private _blockSize: number;
  private _handlerRequiredStates: number[];

  private _deferredStateItemIds: Int32Array;
  private _deferredStateHandler: Int32Array;
  private _deferredStateCount: number;
  
  private _deferredReleaseItemIds: Int32Array;
  private _deferredReleaseCount: number;

  constructor(
      pool: ResourcePool<T>,
      stateTypes: StateType[],
      handlers: StateHandler<T>[],
      handlerRequiredStates: number[],
      pipeline: StateHandler<T>[],
      initialSize = 10000) {
    this._pool = pool;
    this._registeredStates = stateTypes;
    this._handlers = handlers;
    this._handlerRequiredStates = handlerRequiredStates;
    this._pipeline = pipeline;
    this._itemStatesSize = initialSize;
    this._blockSize = initialSize;
    this._itemStates = new Uint32Array(initialSize);
    this._deferredStateItemIds = new Int32Array(initialSize);
    this._deferredStateHandler = new Int32Array(initialSize);
    this._deferredStateCount = 0;
    this._deferredReleaseItemIds = new Int32Array(initialSize);
    this._deferredReleaseCount = 0;
  }

  public addItem(): number {
    const itemId = this._pool.add();
    if (itemId >= this._itemStatesSize) {
      this._resizeItemStates();
    }
    this._itemStates[itemId] = 0;

    return itemId;
  }

  private _resizeItemStates(): void {
    const newSize = this._itemStatesSize + this._blockSize;
    console.log('Resizing state machine ',this._itemStatesSize,' -> ',newSize);

    // Resize _itemStates
    const newItemStates = new Uint32Array(newSize);
    newItemStates.set(this._itemStates);
    this._itemStates = newItemStates;
    this._itemStatesSize = newSize;

    // go through all handlers and resize their arrays
    for (const handler of this._handlers) {
      handler.resize(newSize);
    }
  }

  public releaseItem(itemId: number): void {
    // Remove item from all handlers.
    if (this._deferredStateCount >= this._deferredStateItemIds.length) {
      this._resizeDeferredArrays();
    }

    const deferredIndex = this._deferredStateCount++;
    this._deferredStateItemIds[deferredIndex] = (itemId - MAX_ITEMS);
    this._deferredStateHandler[deferredIndex] = REMOVE_ALL_STATES;

    // Reset the item's states.
    this._itemStates[itemId] = 0;

  }

  private _resizeDeferredArrays(): void {
    const newSize = this._deferredStateItemIds.length + this._blockSize;
    console.log('Resizing deferred arrays ',this._deferredStateItemIds.length,' -> ',newSize);

    // Resize _deferredStateItemIds
    const newDeferredStateItemIds = new Int32Array(newSize);
    newDeferredStateItemIds.set(this._deferredStateItemIds);
    this._deferredStateItemIds = newDeferredStateItemIds;

    // Resize _deferredStateHandler
    const newDeferredStateHandler = new Int32Array(newSize);
    newDeferredStateHandler.set(this._deferredStateHandler);
    this._deferredStateHandler = newDeferredStateHandler;
  }

  public addState(itemId: number, newState: number) {
    const currentStates = this._itemStates[itemId];
    const registeredState = this._registeredStates[newState];
    if (!registeredState) {
      throw new Error(`State "${newState}" not registered.`);
    }
    const newStateFlag = registeredState.stateFlag;

    // ignore if the item already has the new states
    if (currentStates & newStateFlag) {
      return false;
    }
  
    const itemStates = currentStates | newStateFlag;
    this._itemStates[itemId] = itemStates;

    const handlersForState = registeredState.handlerIndicies;
    for (let i = 0; i < handlersForState.length; i++) {
      const requiredStates = this._handlerRequiredStates[handlersForState[i]];
      // check all bits in the handlers's required state are set in the item
      if ((itemStates & requiredStates) === requiredStates) {
        if (this._deferredStateCount >= this._deferredStateItemIds.length) {
          this._resizeDeferredArrays();
        }
        const deferredIndex = this._deferredStateCount++;
        this._deferredStateItemIds[deferredIndex] = itemId;
        this._deferredStateHandler[deferredIndex] = registeredState.handlerIndicies[i];

      }
    }
    return true;
  }

  public removeState(itemId: number, removedState: number): boolean {
    const currentStates = this._itemStates[itemId];
    const registeredState = this._registeredStates[removedState];
    const removeStateFlag = registeredState.stateFlag;

    // ignore if the item doesn't have the states
    if (!(currentStates & removeStateFlag)) {
      return false;
    }
  
    const itemStates = currentStates ^ removeStateFlag;
    this._itemStates[itemId] = itemStates;

    const handlersForState = registeredState.handlerIndicies;
    for (let i = 0; i < handlersForState.length; i++) {
      const requiredStates = this._handlerRequiredStates[handlersForState[i]];
      // if this handler no longer has all the required states, remove it
      if ((removeStateFlag & requiredStates) !== 0) {
        // queue the item for removal from the handler
        if (this._deferredStateCount >= this._deferredStateItemIds.length) {
          this._resizeDeferredArrays();
        }
        const deferredIndex = this._deferredStateCount++;
        this._deferredStateItemIds[deferredIndex] = itemId - MAX_ITEMS;
        this._deferredStateHandler[deferredIndex] = registeredState.handlerIndicies[i];
      }
    }
    return true;
  }

  public tick(): void {
    // release any items that have been removed from all handlers in the previous tick
    this._processDeferredRelease();

    // Process deferred state changes.
    this._updateHandlerItems();
    const allItems = this._pool.contents();
    for (const handler of this._pipeline) {
      handler.tick(this, allItems);
      // Process deferred state changes from the handler.
      this._updateHandlerItems();
    }
  }

  public cleanup(): void {
    this._updateHandlerItems();
    this._processDeferredRelease();
  }

  private _processDeferredRelease() {
    for (let i = 0; i < this._deferredReleaseCount; i++) {
      const itemId = this._deferredReleaseItemIds[i];
      this._pool.release(itemId);
    }
    this._deferredReleaseCount = 0;
  }

  private _updateHandlerItems() {
    for (let i = 0; i < this._deferredStateCount; i++) {
      let itemId = this._deferredStateItemIds[i];
      const handlerIndex = this._deferredStateHandler[i];
      if (itemId >= 0) {
        // item id is positive, so it's an add
        this._handlers[handlerIndex].addItem(itemId);
      } else {
        // if the item id is negative, it means it's a remove
        // if the handler index is positive, it means it's a remove from a specific handler
        itemId += MAX_ITEMS;
        if (handlerIndex >= 0) {
          this._handlers[handlerIndex].removeItems(itemId);
        } else {
          // otherwise, it's a remove from all handlers
          for (let i = 0; i < this._handlers.length; i++) {
            this._handlers[i].removeItems(itemId);
          }
          // queue the item for release to give exit handlers a chance to run in the next tick
          if (this._deferredReleaseCount >= this._deferredReleaseItemIds.length) {
            const newSize = this._deferredReleaseItemIds.length + this._blockSize;
            const newDeferredReleaseItemIds = new Int32Array(newSize);
            newDeferredReleaseItemIds.set(this._deferredReleaseItemIds);
            this._deferredReleaseItemIds = newDeferredReleaseItemIds;
          }
          this._deferredReleaseItemIds[this._deferredReleaseCount++] = itemId;
        }
      }
    }
    this._deferredStateCount = 0;
  }
}

export { StateMachineBuilder, StateMachine };
