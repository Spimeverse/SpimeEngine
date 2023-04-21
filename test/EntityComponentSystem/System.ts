// spec/system.spec.ts


import { WorldBuilder, World, System } from '..';
import { ComponentPool } from '..';

let positionComponent = 0;
let velocityComponent = 0;
let processedEntities: number[] = [];

function TestComponentSystem() {

  describe('ComponentSystem', () => {
      
    let world: World;
    const archetype = { position: { x: 0, y: 0 } };
    let system: System<typeof archetype>;
    let tickCalled: boolean;

    beforeEach(() => {
      const worldBuilder = new WorldBuilder();

      const positionPool = new ComponentPool<{ x: number; y: number }>(
        () => ({ x: 0, y: 0 }),
        item => {
          item.x = 0;
          item.y = 0;
        }
      );
      positionComponent = worldBuilder.registerComponentPool(positionPool, 'position');

      system = new System(archetype, (world, allEntities, validEntityIds) => {
        tickCalled = true;
        for (let i = 0; i < validEntityIds.length; i++) {
          const entity = allEntities[validEntityIds[i]];
          entity.position.x += 10;
          entity.position.y += 20;
        }
      });

      worldBuilder.registerSystem(system);

      world = worldBuilder.createWorld();
    });

    it('should initialize with the correct archetype', () => {
      expect(system.componentTypes).toEqual(['position']);
    });

    it('should add an entity and update its archetype', () => {
      const entityId = world.createEntity();
      world.addComponent(entityId, positionComponent);

      const position = world.getEntity(entityId)?.position;
      tickCalled = false;
      expect(position).toEqual({ x: 0, y: 0 });

      system.tick();
      expect(tickCalled).toBe(true);
      expect(position).toEqual({ x: 10, y: 20 });

      system.tick();
      expect(tickCalled).toBe(true);
      expect(position).toEqual({ x: 20, y: 40 });

    });

    it('should not add a non-existent component to the archetype', () => {
      const entityId = world.createEntity();
      const nonExistentComponent = 52;
      const added = world.addComponent(entityId, nonExistentComponent);
      expect(added).toBe(false);
    });

  });

  describe('ComponentSystem with Velocity', () => {
    let world: World;
    const archetype = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 }
    };
    let system: System<typeof archetype>;
    let tickCalled: boolean;

    beforeEach(() => {
      const worldBuilder = new WorldBuilder();

      const positionPool = new ComponentPool<{ x: number; y: number }>(
        () => ({ x: 0, y: 0 }),
        item => {
          item.x = 0;
          item.y = 0;
        }
      );
      positionComponent = worldBuilder.registerComponentPool(positionPool, 'position');

      const velocityPool = new ComponentPool<{ x: number; y: number }>(
        () => ({ x: 0, y: 0 }),
        item => {
          item.x = 0;
          item.y = 0;
        }
      );
      velocityComponent = worldBuilder.registerComponentPool(velocityPool, 'velocity');

      system = new System(archetype, (world, allEntities, validEntityIds) => {
        tickCalled = true;
        processedEntities = validEntityIds;
        for (let i = 0; i < validEntityIds.length; i++) {
          const entity = allEntities[validEntityIds[i]];
          entity.position.x += entity.velocity.x;
          entity.position.y += entity.velocity.y;
        }
      });

      worldBuilder.registerSystem(system);

      world = worldBuilder.createWorld();
    });


    it('should initialize with the correct archetype', () => {
      expect(system.componentTypes).toEqual(['position', 'velocity']);
    });

    it('should add an entity and update its archetype with velocity', () => {
      const entityId = world.createEntity();
      world.addComponent(entityId, positionComponent);
      world.addComponent(entityId, velocityComponent);

      const position = world.getEntity(entityId)?.position;
 
      tickCalled = false;
      expect(position).toEqual({ x: 0, y: 0 });

      const velocity = world.getEntity(entityId)?.velocity as { x: number; y: number }
      if (velocity) {
        velocity.x = 5;
        velocity.y = 10;
      }

      system.tick();
      expect(tickCalled).toBe(true);
      expect(position).toEqual({ x: 5, y: 10 });

      system.tick();
      expect(tickCalled).toBe(true);
      expect(position).toEqual({ x: 10, y: 20 });

      if (velocity) {
        velocity.x = 2;
        velocity.y = 3;
      }

      system.tick();
      expect(tickCalled).toBe(true);
      expect(position).toEqual({ x: 12, y: 23 });
    });

    it('should not process removed entities', () => {
      const entityIds = [];
      for (let i = 0; i < 5; i++) {
        const entityId = world.createEntity();
        world.addComponent(entityId, positionComponent);
        world.addComponent(entityId, velocityComponent);
        entityIds.push(entityId);
      }

      let i = 1;
      entityIds.forEach(entityId => {
        const entity = world.getEntity(entityId) as { velocity: { x: number; y: number } }
        if (entity && entity.velocity) {
          entity.velocity.x = i;
          entity.velocity.y = i * 2;
          i++;
        }
      });

      system.tick();

      let positions = "";
      entityIds.forEach((entityId, index) => {
        const position = world.getEntity(entityId)?.position;
        positions += `${index}: ${JSON.stringify(position)}\n`;
      });
      expect(positions).toEqual(
        `0: {"x":1,"y":2}\n` +
        `1: {"x":2,"y":4}\n` +
        `2: {"x":3,"y":6}\n` +
        `3: {"x":4,"y":8}\n` +
        `4: {"x":5,"y":10}\n`);

      expect(processedEntities).toEqual([0, 1, 2, 3, 4]);

      world.releaseEntity(entityIds[2]); // Remove the 3rd entity

      system.tick();

      positions = "";
      entityIds.forEach((entityId, index) => {
        const position = world.getEntity(entityId)?.position;
        positions += `${index}: ${JSON.stringify(position)}\n`;
      });
      expect(positions).toEqual(
        `0: {"x":2,"y":4}\n` +
        `1: {"x":4,"y":8}\n` +
        `2: undefined\n` +
        `3: {"x":8,"y":16}\n` +
        `4: {"x":10,"y":20}\n`);
      
      expect(processedEntities).toEqual([0, 1, 4, 3]);

      expect(world.getEntity(entityIds[2])).toBeNull();

      const reusedId = world.createEntity(); // Reuse the removed entity's id
      world.addComponent(reusedId, positionComponent);
      world.addComponent(reusedId, velocityComponent);

      const newId = world.createEntity(); // Add a new entity
      world.addComponent(newId, positionComponent);
      world.addComponent(newId, velocityComponent);
      entityIds.push(newId);

      const entity = world.getEntity(reusedId) as { velocity: { x: number; y: number } }
      if (entity && entity.velocity) {
        entity.velocity.x = 222;
        entity.velocity.y = 333;
      }

      const newEntity = world.getEntity(newId) as { velocity: { x: number; y: number } }
      if (newEntity && entity.velocity) {
        newEntity.velocity.x = 444;
        newEntity.velocity.y = 555;
      }

      system.tick();

      positions = "";
      entityIds.forEach((entityId, index) => {
        const position = world.getEntity(entityId)?.position;
        positions += `${index}: ${JSON.stringify(position)}\n`;
      });
      expect(positions).toEqual(
        `0: {"x":3,"y":6}\n` +
        `1: {"x":6,"y":12}\n` +
        `2: {"x":222,"y":333}\n` +
        `3: {"x":12,"y":24}\n` +
        `4: {"x":15,"y":30}\n` +
        `5: {"x":444,"y":555}\n`);
      
      expect(processedEntities).toEqual([0, 1, 4, 3, 2, 5]);
    });

    it("should not process entities with removed velocity component, and process them again after re-adding", () => {
      const entityIds = [];
      for (let i = 0; i < 5; i++) {
        const entityId = world.createEntity();
        world.addComponent(entityId, positionComponent);
        world.addComponent(entityId, velocityComponent);
        entityIds.push(entityId);
      }

      let i = 1;
      entityIds.forEach(entityId => {
        const entity = world.getEntity(entityId) as { velocity: { x: number; y: number } };
        if (entity && entity.velocity) {
          entity.velocity.x = i;
          entity.velocity.y = i * 2;
          i++;
        }
      });

      system.tick();

      expect(processedEntities).toEqual([0, 1, 2, 3, 4]);

      world.removeComponent(entityIds[2], velocityComponent); // Remove the velocity component from the 3rd entity

      system.tick();

      expect(processedEntities).toEqual([0, 1, 4, 3]);

      world.addComponent(entityIds[2], velocityComponent); // Re-add the velocity component to the 3rd entity
      const entity = world.getEntity(entityIds[2]) as { velocity: { x: number; y: number } };
      if (entity && entity.velocity) {
        entity.velocity.x = 222;
        entity.velocity.y = 333;
      }

      system.tick();

      expect(processedEntities).toEqual([0, 1, 4, 3, 2]);
    });


  });

  
}

export { TestComponentSystem }