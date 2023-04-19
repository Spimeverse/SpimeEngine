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
  componentIdentities: bigint;
  systemIdentity: bigint;
  private _entities: Set<number>;
  protected callback: (world: World, archetype: T) => void;
  private _world: World;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _archetype: any;
  private _componentTypeIndices: number[];

  constructor(world: World, archetype: T, callback: (world: World, archetype: T) => void) {
    this._world = world;
    if (typeof archetype !== 'object') {
      throw new Error('archetype must be an object.');
    }
    this._archetype = archetype;
    this.componentTypes = Object.keys(archetype as Archetype);
    if (this.componentTypes.length === 0) {
      throw new Error('archetype has no component properties. System must have at least one component type.');
    }
    this.componentIdentities = this._getComponentIdentities(world);
    this.systemIdentity = this._getSystemIdentity();
    this._entities = new Set<number>();
    this._componentTypeIndices = this.componentTypes.map(typeName => world.getComponentTypeIndex(typeName));
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.callback = callback;
  }

  private _getComponentIdentities(world: World): bigint {
    let componentIdentities = BigInt(0);
    for (const typeName of this.componentTypes) {
      const identity = world.getComponentIdentity(typeName);
      if (identity) {
        componentIdentities |= identity;
      } else {
        console.warn(`Component type "${typeName}" not found.`);
      }
    }
    return componentIdentities;
  }

  private _getSystemIdentity(): bigint {
    return BigInt(0) | this.componentIdentities;
  }

  add(entityId: number): void {
    this._entities.add(entityId);
  }

  tick(): void {
    const archetype = this._archetype;
    const componentTypes = this.componentTypes;
    const componentTypeIndices = this._componentTypeIndices;
    const getComponent = this._world.getComponent.bind(this._world);
    const componentCount = componentTypes.length;
    const callback = this.callback;
    const world = this._world;

    for (const entityId of this._entities) {
      // Set each member of the archetype by getting the value of each named component
      for (let i = 0; i < componentCount; i++) {
        const componentTypeName = componentTypes[i];
        const componentTypeIndex = componentTypeIndices[i];
        archetype[componentTypeName] = getComponent(entityId, componentTypeIndex);
      }

      // Call the callback with the world and the updated archetype
      callback(world, archetype);
    }
  }

}

class World {

  private _pools: Array<ComponentPool<unknown>>;
  private _componentTypes: ComponentType[];
  private _systems: System<unknown>[];
  private _entityComponents: Array<bigint>;
  private _lookupBlockRecords: number;
  private _componentLookupBlock: Int16Array | null;
  private _entityCreated: boolean;
  private _componentCount: number;
  private _pipeline: System<unknown>[];

  constructor(blockSize = 10000) {
    this._pools = [];
    this._componentTypes = [];
    this._systems = [];
    this._entityComponents = [];
    this._lookupBlockRecords = blockSize;
    this._componentCount = 0;
    this._pipeline = [];
    this._componentLookupBlock = null;
    this._entityCreated = false;
  }

  public registerComponentPool<T>(pool: ComponentPool<T>, typeName: string): number {
    if (this._entityCreated) {
      throw new Error('Cannot register more component pools after the first entity is created.');
    }
    const type = this._componentCount;
    this._pools.push(pool as ComponentPool<unknown>);
    this._componentTypes.push({
      name: typeName,
      identity: BigInt(1) << BigInt(type),
      systems: [], // Add the systems array to the ComponentType
    });
    this._componentCount++;
    return type;
  }

  getComponentPool(typeName: string): ComponentPool<unknown> | null {
    const index = this.getComponentTypeIndex(typeName);
    if (index >= 0) {
      return this._pools[index];
    }
    return null;
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

  public createPipeline(...systems: System<unknown>[]): void {
    this._pipeline = systems;
  }

  public createEntity(): number {
    const entityId = this._entityComponents.length;

    if (!this._entityCreated) {
      this._entityCreated = true;
      this._componentLookupBlock = new Int16Array(this._lookupBlockRecords * this._componentCount);
    }

    if (entityId >= this._lookupBlockRecords) {
      this._resizeComponentLookupBlock();
    }

    this._entityComponents.push(BigInt(0));

    return entityId;
  }

  private _resizeComponentLookupBlock(): void {
    const oldBlockSize = this._lookupBlockRecords;
    const newBlockSize = Math.floor(oldBlockSize * 1.5);
    const newBlock = new Int16Array(newBlockSize * this._componentCount);

    // Copy old data into the new block
    if (this._componentLookupBlock) {
      newBlock.set(this._componentLookupBlock);
    }

    this._lookupBlockRecords = newBlockSize;
    this._componentLookupBlock = newBlock;
  }

  public addComponent(entityId: number, componentType: number) {
    if (componentType >= this._componentCount || componentType < 0) {
      console.warn(`Component type ${componentType} not found.`);
      return false;
    }
    const existingComponents = this._entityComponents[entityId];
    const componentIdentity = this._componentTypes[componentType].identity;

    if ((existingComponents & componentIdentity) !== BigInt(0)) {
      console.warn(`Entity ${entityId} already has a component of type ${componentType}.`);
      return false;
    }
  
    const index = entityId * this._componentCount;

    if (this._componentLookupBlock) {
      this._entityComponents[entityId] = existingComponents | componentIdentity;

      const componentPool = this._pools[componentType];
      this._componentLookupBlock[index] = componentPool.add();

      const systems = this._componentTypes[componentType].systems;
      for (const system of systems) {
        system.add(entityId);
      }
    } else {
      console.warn('Entity components have not been initialized. Call the initialize method first.');
      return false;
    }
    return true;
  }


  public getComponent<T>(entityId: number, componentType: number): T {
    if (!this._componentLookupBlock) {
      throw new Error('Entity components have not been initialized. Call the createEntity method first.');
    }

    const index = entityId * this._componentCount;

    const componentPool = this._pools[componentType];
    const componentID = this._componentLookupBlock[index];
    return componentPool.getComponentById(componentID) as T;
  }

  public getComponentIdentity(typeName: string): bigint | null {
    const componentType = this._componentTypes.find(ct => ct.name === typeName);
    return componentType ? componentType.identity : null;
  }

  public getComponentTypeIndex(typeName: string): number {
    return this._componentTypes.findIndex(ct => ct.name === typeName);
  }

  public tick(): void {
    for (const system of this._pipeline) {
      system.tick();
    }
  }
}

export { World, System };
