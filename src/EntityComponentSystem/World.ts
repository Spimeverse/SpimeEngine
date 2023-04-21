import { ComponentPool } from './ComponentPool';

interface Archetype {
  [key: string]: unknown;
}

interface ComponentType {
  name: string;
  identity: bigint;
  systems: System<unknown>[];
}

class System<T> {
  componentTypes: string[];
  requiredComponentIdentities: bigint;
  private _entitiesArray: number[];
  private _entityIdToIndex: Map<number, number>;
  protected callback: (world: World, allEntities: Array<T>, entityIds: number[]) => void;
  private _world: World | null = null;

  constructor(
    archetype: T,
    callback: (world: World, allEntities: Array<T>, entityIds: number[]) => void
  ) {
    if (typeof archetype !== 'object') {
      throw new Error('archetype must be an object.');
    }
    this.componentTypes = Object.keys(archetype as Archetype);
    if (this.componentTypes.length === 0) {
      throw new Error('archetype has no component properties. System must have at least one component type.');
    }
    this._entitiesArray = [];
    this._entityIdToIndex = new Map<number, number>();
    this.callback = callback;
    this.requiredComponentIdentities = 0n;
  }

  setup(world: World) {
    this._world = world;
    this.requiredComponentIdentities = world.getComponentIdentities(this.componentTypes);
  }

  addEntity(entityId: number): void {
    const newIndex = this._entitiesArray.length;
    this._entitiesArray.push(entityId);
    this._entityIdToIndex.set(entityId, newIndex);
  }

  removeEntity(entityId: number): void {
    const indexToRemove = this._entityIdToIndex.get(entityId);
    if (indexToRemove === undefined) {
      return;
    }

    const lastIndex = this._entitiesArray.length - 1;

    if (indexToRemove !== lastIndex) {
      const lastEntityId = this._entitiesArray[lastIndex];
      this._entitiesArray[indexToRemove] = lastEntityId;
      this._entityIdToIndex.set(lastEntityId, indexToRemove);
    }

    this._entitiesArray.pop();
    this._entityIdToIndex.delete(entityId);
  }

  tick(): void {
    const callback = this.callback;
    const world = this._world;

    // Call the callback with the world and the array of entities
    if (world !== null) {
      callback(world, world.getEntities() as Array<T>, this._entitiesArray);
    }
  }

}

class WorldBuilder {
  private _pools: Array<ComponentPool<unknown>>;
  private _componentTypes: ComponentType[];
  private _systems: System<unknown>[];

  constructor() {
    this._pools = [];
    this._componentTypes = [];
    this._systems = [];
  }

  public registerComponentPool<T>(pool: ComponentPool<T>, typeName: string): number {
    const componentIndex = this._componentTypes.length;
    this._pools.push(pool as ComponentPool<unknown>);
    this._componentTypes.push({
      name: typeName,
      identity: BigInt(1) << BigInt(componentIndex),
      systems: [],
    });
    return componentIndex;
  }

  public registerSystem<T>(system: System<T>): void {
    this._systems.push(system as System<unknown>);
    system.componentTypes.forEach(typeName => {
      const type = this._componentTypes.find(type => type.name === typeName);
      if (type) {
        type.systems.push(system as System<unknown>);
      }
      else {
        throw new Error(`Component type "${typeName}" not found.`);
      }
    });
  }

  createWorld(): World {
    const world = new World(this._pools, this._componentTypes, this._systems);

    // Call the 'setup' method for each system
    this._systems.forEach(system => system.setup(world));

    return world;
  }
}


interface EntityType {
  [key: string]: unknown;
}

class World {

  private _pools: Array<ComponentPool<unknown>>;
  private _componentTypes: ComponentType[];
  private _systems: System<unknown>[];
  private _entityComponents: Array<bigint>;
  private _lookupBlockRecords: number;
  private _componentLookupBlock: Int16Array;
  private _componentCount: number;
  private _pipeline: System<unknown>[];
  private _entityPool: ComponentPool<EntityType>;


  constructor(
    pools: Array<ComponentPool<unknown>>,
    componentTypes: ComponentType[],
    systems: System<unknown>[],
    blockSize = 10000) {
    this._pools = pools;
    this._componentTypes = componentTypes;
    this._systems = systems;
    this._entityComponents = new Array<bigint>(blockSize).fill(0n);
    this._lookupBlockRecords = blockSize;
    this._componentCount = componentTypes.length;
    this._pipeline = [];
    this._componentLookupBlock = new Int16Array(this._lookupBlockRecords * this._componentCount);

    this._entityPool = new ComponentPool<EntityType>(
      this._initializeEntity.bind(this),
      this._resetEntity.bind(this),
      blockSize
    );
  }

  private _initializeEntity(): EntityType {
    const entity: EntityType = {};
    for (const componentType of this._componentTypes) {
      entity[componentType.name] = null;
    }
    return entity;
  }

  private _resetEntity(entity: EntityType): void {
    for (const componentType of this._componentTypes) {
      entity[componentType.name] = null;
    }
  }


  public createPipeline(...systems: System<unknown>[]): void {
    this._pipeline = systems;
  }

  public createEntity(): number {
    const entityId = this._entityPool.add();
    this._entityComponents[entityId] = BigInt(0);

    if (entityId >= this._lookupBlockRecords) {
      this._resizeComponentLookupBlock();
    }

    return entityId;
  }

  private _resizeComponentLookupBlock(): void {
    const oldBlockSize = this._lookupBlockRecords;
    const newBlockSize = Math.floor(oldBlockSize * 1.5);
    const newBlock = new Int16Array(newBlockSize * this._componentCount);

    // Copy old data into the new block
    newBlock.set(this._componentLookupBlock);

    this._lookupBlockRecords = newBlockSize;
    this._componentLookupBlock = newBlock;
  }

  public releaseEntity(entityId: number): void {
    // Remove entity from all systems.
    for (const system of this._systems) {
      system.removeEntity(entityId);
    }

    // Reset the entity's components.
    this._entityComponents[entityId] = BigInt(0);

    // Release the entity back to the pool.
    this._entityPool.release(entityId);
  }

  public addComponent(entityId: number, componentIndex: number) {
    if (componentIndex >= this._componentCount || componentIndex < 0) {
      console.warn(`Component type ${componentIndex} not found.`);
      return false;
    }
    const entity = this._entityPool.get(entityId);
    if (!entity) {
      console.warn(`Entity ${entityId} not found.`);
      return false;
    }
    const existingComponents = this._entityComponents[entityId];
    const componentIdentity = this._componentTypes[componentIndex].identity;

    if ((existingComponents & componentIdentity)) {
      console.warn(`Entity ${entityId} already has a component of type ${componentIndex}.`);
      return false;
    }
  
    const index = entityId * this._componentCount + componentIndex;

    const entityComponentIdentities = existingComponents | componentIdentity;
    this._entityComponents[entityId] = entityComponentIdentities;

    const componentPool = this._pools[componentIndex];
    const componentID = componentPool.add();
    this._componentLookupBlock[index] = componentID;

    // Set the component property on the entity
    const componentTypeName = this._componentTypes[componentIndex].name;
    entity[componentTypeName] = componentPool.get(componentID);

    const systems = this._componentTypes[componentIndex].systems;
    for (const system of systems) {
      // check all bits in the system's required components are set in the entity's components
      // using xor to check if the result is 0
      if ((entityComponentIdentities ^ system.requiredComponentIdentities) === 0n) {
        system.addEntity(entityId);
      }
    }
    return true;
  }

  public removeComponent(entityId: number, componentIndex: number): boolean {
    if (componentIndex >= this._componentCount || componentIndex < 0) {
      console.warn(`Component type ${componentIndex} not found.`);
      return false;
    }

    const componentIdentity = this._componentTypes[componentIndex].identity;
    
    const entity = this._entityPool.get(entityId);
    if (!entity) {
      console.warn(`Entity ${entityId} not found.`);
      return false;
    }

    const existingComponents = this._entityComponents[entityId];
    if (!(existingComponents & componentIdentity)) {
      console.warn(`Entity ${entityId} does not have a component of type ${componentIndex}.`);
      return false;
    }

    this._entityComponents[entityId] = existingComponents ^ componentIdentity;

    const index = entityId * this._componentCount + componentIndex;
    const componentID = this._componentLookupBlock[index];
    const componentPool = this._pools[componentIndex];
    componentPool.release(componentID);


    const systems = this._componentTypes[componentIndex].systems;
    for (const system of systems) {
      // check if this system requires the component we just removed
      if (componentIdentity & system.requiredComponentIdentities) {
        system.removeEntity(entityId);
      }
    }
    return true;
  }

  public getEntity(entityId: number): EntityType | null{
    if (this._entityComponents[entityId] === 0n) {
      return null;
    }
    return this._entityPool.get(entityId);
  }
  
  public getComponentIdentities(componentTypes: string[]): bigint {
    let componentIdentities = BigInt(0);
    for (const typeName of componentTypes) {
      const componentIndex = this._componentTypes.findIndex(ct => ct.name === typeName);
      if (componentIndex < 0) {
        console.warn(`Component type "${typeName}" not found.`);
        continue;
      }
      const identity = this._componentTypes[componentIndex].identity;
      componentIdentities |= identity;
    }
    return componentIdentities;
  }

  public getEntities(): Array<{ [key: string]: unknown }> {
    return this._entityPool.contents();
  }

  public tick(): void {
    for (const system of this._pipeline) {
      system.tick();
    }
  }
}

export { WorldBuilder, World, System };
