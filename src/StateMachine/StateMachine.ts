import { ResourcePool } from '../Collection/ResourcePool';
import { StateHandler } from './StateHandler';


interface StateType<T> {
  name: string;
  stateFlag: number;
  handlers: StateHandler<T>[];
  handlerIndex: number[];
}

// we don't really expect this many items
// mainly used to identify items for deferred removal
// item to remove item = item id - MAX_ITEMS
const MAX_ITEMS = 10_000_000;

class StateMachineBuilder<T> {
  private _pool: ResourcePool<T>;
  private _stateTypes: StateType<T>[];
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
      handlers: [],
      handlerIndex: [],
    });
    return stateIndex;
  }

  public registerHandler(handler: StateHandler<T>, ...requiredStates: number[]): StateHandler<T> {
    if (requiredStates.length === 0) {
      throw new Error('No required states specified.');
    }
    this._handlers.push(handler as StateHandler<T>);
    let requiredStateFlags = 0;
    for (const state of requiredStates) {
      const stateType = this._stateTypes[state];
      if (stateType) {
        requiredStateFlags |= stateType.stateFlag;
      } else {
        throw new Error(`State type "${state}" not found.`);
      }
      stateType.handlers.push(handler);
      stateType.handlerIndex.push(this._handlers.length - 1);
    }
    handler.requiredStateFlags = requiredStateFlags;
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
    const stateMachine = new StateMachine(this._pool, this._stateTypes, this._handlers, this._requiredStates,this._pipeline);

    return stateMachine;
  }
}

class StateMachine<T> {
  private _pool: ResourcePool<T>;
  private _registeredStates: StateType<T>[];
  private _handlers: StateHandler<T>[];
  private _handlerRequiredStates: number[];
  private _pipeline: StateHandler<T>[];
  private _itemStates: number[];
  private _deferredStateItemIds: number[] = [];
  private _deferredStateHandler: number[] = [];

  constructor(
    pool: ResourcePool<T>,
    stateTypes: StateType<T>[],
    handlers: StateHandler<T>[],
    handlerRequiredStates: number[],
    pipeline: StateHandler<T>[],
    blockSize = 10000) {
      this._pool = pool;
      this._registeredStates = stateTypes;
      this._handlers = handlers;
    this._handlerRequiredStates = handlerRequiredStates;
    this._pipeline = pipeline;
    this._itemStates = new Array(blockSize).fill(0);
  }

  public addItem(): number {
    const itemId = this._pool.add();
    this._itemStates[itemId] = 0;

    return itemId;
  }

  public releaseItem(itemId: number): void {
    // Remove item from all handlers.
    
    this._deferredStateItemIds.push(itemId - MAX_ITEMS);
    this._deferredStateHandler.push(-1);

    // Reset the item's states.
    this._itemStates[itemId] = 0;

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

    const handlers = registeredState.handlers;
    for (let i = 0; i < handlers.length; i++) {
      const requiredStates = handlers[i].requiredStateFlags;
      // check all bits in the handlers's required state are set in the item
      if ((itemStates & requiredStates) === requiredStates) {
        this._deferredStateItemIds.push(itemId);
        this._deferredStateHandler.push(registeredState.handlerIndex[i]);
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

    const handlers = registeredState.handlers;
    for (let i = 0; i < handlers.length; i++) {
      const requiredStates = handlers[i].requiredStateFlags;
      // if this handler no longer has all the required states, remove it
      if ((removeStateFlag & requiredStates) !== 0) {
        // queue the item for removal from the handler
        this._deferredStateItemIds.push(itemId - MAX_ITEMS);
        this._deferredStateHandler.push(registeredState.handlerIndex[i]);
      }
    }
    return true;
  }

  public tick(): void {
    // Process deferred state changes.
    this.updateHandlerItems();
    const allEntities = this._pool.contents();
    for (const handler of this._pipeline) {
      handler.tick(this, allEntities);
      // Process deferred state changes from the handler.
      this.updateHandlerItems();
    }
  }

  public updateHandlerItems() {
    for (let i = 0; i < this._deferredStateItemIds.length; i++) {
      let itemId = this._deferredStateItemIds[i];
      const handlerIndex = this._deferredStateHandler[i];
      // if the item id is negative, it means it's a remove
      if (itemId < 0) {
        // if the handler index is positive, it means it's a remove from a specific handler
        itemId += MAX_ITEMS;
        if (handlerIndex >= 0) {
          this._handlers[handlerIndex].removeItems(itemId);
        } else {
          // otherwise, it's a remove from all handlers
          for (let i = 0; i < this._handlers.length; i++) {
            this._handlers[i].removeItems(itemId);
          }
          // Release the item back to the pool.
          this._pool.release(itemId);
        }
      } else {
        // item id is positive, so it's an add
        this._handlers[handlerIndex].addItem(itemId);
      }
    }
    this._deferredStateItemIds.length = 0;
    this._deferredStateHandler.length = 0;
  }
}

export { StateMachineBuilder, StateMachine };
