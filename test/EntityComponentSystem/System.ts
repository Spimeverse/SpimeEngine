// spec/system.spec.ts


import { World, System } from '..';
import { ComponentPool } from '..';

function TestComponentSystem() {

    describe('ComponentSystem', () => {
        let world: World;
        const archetype = { position: { x: 0, y: 0 } };
        let system: System<typeof archetype>;
        let tickCalled: boolean;

        beforeEach(() => {
            world = new World();

            const positionPool = new ComponentPool<{ x: number; y: number }>(
                () => ({ x: 0, y: 0 }),
                item => {
                    item.x = 0;
                    item.y = 0;
                }
            );
            world.registerComponentPool(positionPool, 'position');

            system = new System(world, archetype, (world,archetype) => {
                tickCalled = true;
                archetype.position.x += 10;
                archetype.position.y += 20;
            });

            world.registerSystem(system);
        });

        it('should initialize with the correct archetype', () => {
            expect(system.componentTypes).toEqual(['position']);
        });

        it('should add an entity and update its archetype', () => {
            const entityId = world.createEntity();
            world.addComponent(entityId, world.getComponentTypeIndex('position'));

            tickCalled = false;
            expect(archetype.position).toEqual({ x: 0, y: 0 });

            system.tick();
            expect(tickCalled).toBe(true);
            expect(archetype.position).toEqual({ x: 10, y: 20 });

                        system.tick();
            expect(tickCalled).toBe(true);
            expect(archetype.position).toEqual({ x: 20, y: 40 });

        });

        it('should not add a non-existent component to the archetype', () => {
            const entityId = world.createEntity();
            const added = world.addComponent(entityId, world.getComponentTypeIndex('non_existent_component'));
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
          world = new World();

          const positionPool = new ComponentPool<{ x: number; y: number }>(
              () => ({ x: 0, y: 0 }),
              item => {
                  item.x = 0;
                  item.y = 0;
              }
          );
          world.registerComponentPool(positionPool, 'position');

          const velocityPool = new ComponentPool<{ x: number; y: number }>(
              () => ({ x: 0, y: 0 }),
              item => {
                  item.x = 0;
                  item.y = 0;
              }
          );
          world.registerComponentPool(velocityPool, 'velocity');

          system = new System(world, archetype, (world, archetype) => {
              tickCalled = true;
              archetype.position.x += archetype.velocity.x;
              archetype.position.y += archetype.velocity.y;
          }
          );

          world.registerSystem(system);
      });

    it('should initialize with the correct archetype', () => {
      expect(system.componentTypes).toEqual(['position', 'velocity']);
    });

    it('should add an entity and update its archetype with velocity', () => {
      const entityId = world.createEntity();
      world.addComponent(entityId, world.getComponentTypeIndex('position'));
      world.addComponent(entityId, world.getComponentTypeIndex('velocity'));

      tickCalled = false;
      expect(archetype.position).toEqual({ x: 0, y: 0 });

      const velocityIndex = world.getComponentTypeIndex('velocity');
        const velocity = world.getComponent(entityId, velocityIndex) as { x: number; y: number };
      if (velocity) {
        velocity.x = 5;
        velocity.y = 10;
      }

      system.tick();
      expect(tickCalled).toBe(true);
      expect(archetype.position).toEqual({ x: 5, y: 10 });

      system.tick();
      expect(tickCalled).toBe(true);
      expect(archetype.position).toEqual({ x: 10, y: 20 });

      if (velocity) {
        velocity.x = 2;
        velocity.y = 3;
      }

      system.tick();
      expect(tickCalled).toBe(true);
      expect(archetype.position).toEqual({ x: 12, y: 23 });
    });

    it('should not add a non-existent component to the archetype', () => {
      const entityId = world.createEntity();
      const added = world.addComponent(entityId, world.getComponentTypeIndex('non_existent_component'));
      expect(added).toBe(false);
    });

  });


}

export { TestComponentSystem }