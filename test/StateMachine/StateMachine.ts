import { StateMachineBuilder, StateMachine, StateHandler } from '..';
import { ResourcePool, IhasPoolId } from '..';


class Creature implements IhasPoolId{
  public poolId = -1;
  public lifecycle: string;
  public age: number;
  public health: number;
  public attacks: number;

  constructor() {
    this.lifecycle = "created";
    this.age = 0;
    this.health = 100;
    this.attacks = -1;
  }
    
}
    
let aliveHandler: StateHandler<Creature>;
let damageHandler: StateHandler<Creature>;
let deadHandler: StateHandler<Creature>;

export function TestStateMachine() {

  describe('State Handler', () => {

    it('should keep track of partially populated lists of items', () => {
      let item = 1;
      let released = "";
      const pool = new ResourcePool(() => { return { "poolId": -1, "data": item++ } }, (x) => { 
        released += `release ${x.data} `;
       }, 2);
      const builder = new StateMachineBuilder(pool);

      const A = builder.registerState('A');
      const B = builder.registerState('B');

      const addB = builder.registerHandler(A)
        .onTick((stateMachine, allItems, itemIds, itemCount) => {
          for (let i = 0; i < itemCount; i++) {
            const newEntityId = stateMachine.newId();
            stateMachine.addState(newEntityId, B);
          }
        });

      const removeB = builder.registerHandler(B)
        .onTick((stateMachine, allItems, itemIds, itemCount) => {
          for (let i = 0; i < itemCount; i++) {
            const entityId = itemIds[i];
            stateMachine.releaseId(entityId);
          }
        });
      
      builder.registerPipeline(
        addB,
        removeB
      );
      
      const stateMachine = builder.create();

      const count = 5;

      for (let i = 0; i < count; i++) {
        const entityId = stateMachine.newId();
        stateMachine.addState(entityId, A);
      }

      stateMachine.tick();
      stateMachine.cleanup();

      expect(released).toEqual("release 6 release 7 release 8 release 9 release 10 ");
      expect(pool.count).toEqual(count);
            
    });
  });

  describe('State Machine', () => {
    let isAlive = 0;
    let isDamaged = 0;
    let isDead = 0;

    let pool: ResourcePool<Creature>;
    let builder: StateMachineBuilder<Creature>;

    beforeEach(() => {
      pool = new ResourcePool(() => new Creature(), (component: Creature) => {
        component.lifecycle = "reset";
        component.age = 0;
        component.health = 100;
      },5);
      builder = new StateMachineBuilder(pool);
    });

    describe('StateMachineBuilder', () => {
      it('should register state types', () => {
        isAlive = builder.registerState('alive');
        isDamaged = builder.registerState('damaged');
        isDead = builder.registerState('dead');
        expect(isAlive).toEqual(0);
        expect(isDamaged).toEqual(1);
        expect(isDead).toEqual(2);
      });

      it('should register systems', () => {
        const stateIndex = builder.registerState('testState');
        expect(() => builder.registerHandler(stateIndex)).not.toThrow();
      });

      it('should create a pipeline', () => {
        const unregisteredHandler = new StateHandler<Creature>();
        expect(() => builder.registerPipeline(unregisteredHandler)).toThrow(new Error('Unregistered handler passed to pipeline.'));
        
        isAlive = builder.registerState('alive');
        const registeredHandler = builder.registerHandler(isAlive);
        expect(() => builder.registerPipeline(registeredHandler)).not.toThrow();
      });

      it('should create a state machine', () => {
        const stateIndex = builder.registerState('testState');
        const stateIndex2 = builder.registerState('testState2');
        const handler = builder.registerHandler(stateIndex, stateIndex2)
        builder.registerPipeline(handler);
        const stateMachine = builder.create();
        expect(stateMachine).toBeInstanceOf(StateMachine);
      });
    });

    describe('StateMachine', () => {
      let stateMachine: StateMachine<Creature>;
      let creature: Creature | null;
      let creatureId: number;
      let creature2: Creature | null;
      let creature2Id: number;
      let creature3: Creature | null;
      let creature3Id: number;

      beforeEach(() => {
        isAlive = builder.registerState('alive');
        isDamaged = builder.registerState('damaged');
        isDead = builder.registerState('dead');
        aliveHandler = builder.registerHandler(isAlive)
          .onTick((stateMachine, allItems, itemIds, itemCount) => {
            for (let i = 0; i < itemCount; i++) {
              const entity = allItems[itemIds[i]];
              entity.lifecycle = "alive";
              entity.age++;
              if (entity.attacks >= 0) {
                stateMachine.removeState(entity.attacks, isAlive);
                stateMachine.addState(entity.attacks, isDead);
              }
            }
          });
        damageHandler = builder.registerHandler(isAlive, isDamaged)
          .onTick((stateMachine, allItems, itemIds, itemCount) => {
            for (let i = 0; i < itemCount; i++) {
              const entityId = itemIds[i];
              const entity = allItems[entityId];
              entity.lifecycle = "damaged";
              entity.health -= 50;
              if (entity.health <= 0) {
                stateMachine.removeState(entityId, isAlive);
                stateMachine.addState(entityId, isDead);
              }
            }
          });
        deadHandler = builder.registerHandler(isDead)
          .onTick((stateMachine, allItems, itemIds, itemCount) => {
            for (let i = 0; i < itemCount; i++) {
              const entity = allItems[itemIds[i]];
              entity.lifecycle = "dead";
            }
          });
        builder.registerPipeline(
          aliveHandler,
          damageHandler,
          deadHandler);
        stateMachine = builder.create();

        creature = stateMachine.newItem();
        creatureId = creature.poolId;

        creature2 = stateMachine.newItem();
        creature2Id = creature2.poolId;

        creature3 = stateMachine.newItem();
        creature3Id = creature3.poolId;
      });

      it('should get items from the pool', () => {
        const foundItem = stateMachine.getItem(creatureId);
        expect(foundItem).toEqual(creature);
        expect(foundItem).not.toBeNull();
        expect(foundItem).toEqual(pool.getItem(creatureId));
      });

      it('should move through states', () => {
        expect(creature?.lifecycle).toEqual("created");
        expect(creature?.age).toEqual(0);
        expect(creature?.health).toEqual(100);

        stateMachine.addState(creatureId, isAlive);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("alive");
        expect(creature?.age).toEqual(1);
        expect(creature?.health).toEqual(100);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("alive");
        expect(creature?.age).toEqual(2);
        expect(creature?.health).toEqual(100);

        stateMachine.addState(creatureId, isDamaged);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("damaged");
        expect(creature?.age).toEqual(3);
        expect(creature?.health).toEqual(50);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("dead");
        expect(creature?.age).toEqual(4);
        expect(creature?.health).toEqual(0);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("dead");
        expect(creature?.age).toEqual(4);
        expect(creature?.health).toEqual(0);

      });

      it('should defer release an item', () => {
        stateMachine.addState(creatureId, isAlive);

        expect(creature?.lifecycle).toEqual("created");
        expect(creature?.age).toEqual(0);
        expect(creature?.health).toEqual(100);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("alive");
        expect(creature?.age).toEqual(1);
        expect(creature?.health).toEqual(100);

        stateMachine.releaseId(creatureId);

        // release is deferred so the item is still alive
        expect(creature?.lifecycle).toEqual("alive");
        expect(creature?.age).toEqual(1);
        expect(creature?.health).toEqual(100);

        // process deferred changes
        stateMachine.tick();
        
        // item still not released yet in case of exit handlers
        expect(creature?.lifecycle).toEqual("alive");
        expect(creature?.age).toEqual(1);
        expect(creature?.health).toEqual(100);

        // process deferred changes
        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("reset");
        expect(creature?.age).toEqual(0);
        expect(creature?.health).toEqual(100);

        creatureId = stateMachine.newId();
        stateMachine.addState(creatureId, isAlive);
        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("alive");
      });

      it('should keep items even if they are removed from all states', () => {
        stateMachine.addState(creatureId, isAlive);
        stateMachine.addState(creatureId, isDamaged);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("damaged");
        expect(creature?.age).toEqual(1);
        expect(creature?.health).toEqual(50);

        stateMachine.removeState(creatureId, isAlive);
        stateMachine.removeState(creatureId, isDamaged);

        // item has no states it's just dormant until it's released
        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("damaged");
        expect(creature?.age).toEqual(1);
        expect(creature?.health).toEqual(50);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("damaged");
        expect(creature?.age).toEqual(1);
        expect(creature?.health).toEqual(50);
      });

      it('should add and remove states from items', () => {
        const itemId = stateMachine.newId();
        expect(stateMachine.addState(itemId, isAlive)).toBe(true);
        expect(stateMachine.removeState(itemId, isAlive)).toBe(true);
      });

      it('Should show if item is in a state', () => {
        const itemId = stateMachine.newId();
        expect(stateMachine.addState(itemId, isAlive)).toBe(true);
        expect(stateMachine.isInState(itemId, isAlive)).toBe(true);
        expect(stateMachine.isInState(itemId, isDamaged)).toBe(false);
        expect(stateMachine.removeState(itemId, isAlive)).toBe(true);
        expect(stateMachine.isInState(itemId, isAlive)).toBe(false);
      });
      
      it('should not remove items twice', () => {
        const itemId = stateMachine.newId();
        expect(stateMachine.addState(itemId, isAlive)).toBe(true);
        stateMachine.tick();        
        expect(aliveHandler.getItemCount()).toEqual(1);

        expect(stateMachine.removeState(itemId, isAlive)).toBe(true);
        expect(stateMachine.removeState(itemId, isAlive)).toBe(false);
        stateMachine.tick();        
        expect(aliveHandler.getItemCount()).toEqual(0);
      });

      it('Should defer changes while iterating', () => {
        stateMachine.addState(creatureId, isAlive);
        stateMachine.addState(creature2Id, isAlive);
        stateMachine.addState(creature3Id, isAlive);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("alive");
        expect(creature2?.lifecycle).toEqual("alive");
        expect(creature3?.lifecycle).toEqual("alive");

        // each creature should get a turn killing the next
        // before they die

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        creature!.attacks = creature2Id;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        creature2!.attacks = creature3Id;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        creature3!.attacks = creatureId;

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("dead");
        expect(creature2?.lifecycle).toEqual("dead");
        expect(creature3?.lifecycle).toEqual("dead");
      });

    });
  
    describe('StateMachine Entry and Exit', () => {
      let stateMachine: StateMachine<Creature>;
      let creature: Creature | null;
      let creatureId: number;


      beforeEach(() => {
        isAlive = builder.registerState('alive');

        const aliveHandler = builder.registerHandler(isAlive)
          .onEntry((stateMachine, allItems, itemIds, itemCount) => {
            for (let i = 0; i < itemCount; i++) {
              const entityId = itemIds[i];
              const entity = allItems[entityId];
              entity.lifecycle = "born";
            }
          })
          .onTick((stateMachine, allItems, itemIds, itemCount) => {
            for (let i = 0; i < itemCount; i++) {
              const entityId = itemIds[i];
              const entity = allItems[entityId];
              entity.lifecycle += ",alive";
              entity.age++;
            }
          })
          .onExit((stateMachine, allItems, itemIds, itemCount) => {
            for (let i = 0; i < itemCount; i++) {
              const entityId = itemIds[i];
              const entity = allItems[entityId];
              entity.lifecycle += ",dead";
              entity.health = 0;
            }
          });

        
        builder.registerPipeline(
          aliveHandler);
        stateMachine = builder.create();
        creatureId = stateMachine.newId();
        creature = pool.getItem(creatureId);

      });

      it('should perform entry and exit handling for state', () => {
        expect(creature?.lifecycle).toEqual("created");
        expect(creature?.age).toEqual(0);
        expect(creature?.health).toEqual(100);

        stateMachine.addState(creatureId, isAlive);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("born,alive");
        expect(creature?.age).toEqual(1);
        expect(creature?.health).toEqual(100);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("born,alive,alive");
        expect(creature?.age).toEqual(2);
        expect(creature?.health).toEqual(100);

        stateMachine.removeState(creatureId, isAlive);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("born,alive,alive,dead");
        expect(creature?.age).toEqual(2);
        expect(creature?.health).toEqual(0);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("born,alive,alive,dead");
        expect(creature?.age).toEqual(2);
        expect(creature?.health).toEqual(0);

      });

      it('should resize to work with 10 items', () => {
        // Add 10 items to the state machine
        const creatureIds: number[] = [];
        for (let i = 0; i < 10; i++) {
          creatureIds.push(stateMachine.newId());
        }

        // Add alive state to all 10 items
        for (const id of creatureIds) {
          stateMachine.addState(id, isAlive);
        }

        // Tick the state machine
        stateMachine.tick();

        // Verify if all items are in the alive state
        for (const id of creatureIds) {
          const creature = pool.getItem(id);
          expect(creature?.lifecycle).toEqual("born,alive");
          expect(creature?.age).toEqual(1);
          expect(creature?.health).toEqual(100);
        }
      });


    });
    
  });

}