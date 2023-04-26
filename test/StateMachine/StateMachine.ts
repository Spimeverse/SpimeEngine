import { StateMachineBuilder, StateMachine, StateHandler } from '..';
import { ResourcePool } from '..';

export function TestStateMachine() {

  describe('State Machine Classes', () => {

    class Creature {
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

    let alive = 0;
    let damaged = 0;
    let dead = 0;

    class SimpleHandler extends StateHandler<Creature> {
      handler(stateMachine: StateMachine<Creature>, allEntities: Array<Creature>, entityIds: number[]): void {
        for (let i = 0; i < entityIds.length; i++) {
          const entity = allEntities[entityIds[i]];
          entity.lifecycle = "handled";
          entity.age++;
        }
      }
    }

    class AliveHandler extends StateHandler<Creature> {
      handler(stateMachine: StateMachine<Creature>, allEntities: Array<Creature>, entityIds: number[]): void {
        for (let i = 0; i < entityIds.length; i++) {
          const entity = allEntities[entityIds[i]];
          entity.lifecycle = "alive";
          entity.age++;
          if (entity.attacks >= 0) {
            stateMachine.removeState(entity.attacks, alive);
            stateMachine.addState(entity.attacks, dead);
          }
        }
      }
    }

    class DeadHandler extends StateHandler<Creature> {
      handler(stateMachine: StateMachine<Creature>, allEntities: Array<Creature>, entityIds: number[]): void {
        for (let i = 0; i < entityIds.length; i++) {
          const entity = allEntities[entityIds[i]];
          entity.lifecycle = "dead";
        }
      }
    }

    class DamagedHandler extends StateHandler<Creature> {
      handler(stateMachine: StateMachine<Creature>, allEntities: Array<Creature>, entityIds: number[]): void {
        for (const entityId of entityIds) {
          const entity = allEntities[entityId];
          entity.lifecycle = "damaged";
          entity.health -= 50;
          if (entity.health <= 0) {
            stateMachine.removeState(entityId, alive);
            stateMachine.addState(entityId, dead);
          }
        }
      }
    }

    let pool: ResourcePool<Creature>;
    let builder: StateMachineBuilder<Creature>;

    beforeEach(() => {
      pool = new ResourcePool(() => new Creature(), (component: Creature) => {
        component.lifecycle = "reset";
        component.age = 0;
        component.health = 100;
      });
      builder = new StateMachineBuilder(pool);
    });

    describe('StateMachineBuilder', () => {
      it('should register state types', () => {
        alive = builder.registerState('alive');
        damaged = builder.registerState('damaged');
        dead = builder.registerState('dead');
        expect(alive).toEqual(0);
        expect(damaged).toEqual(1);
        expect(dead).toEqual(2);
      });

      it('should register systems', () => {
        const stateIndex = builder.registerState('testState');
        const handler = new SimpleHandler();
        expect(() => builder.registerHandler(handler, stateIndex)).not.toThrow();
      });

      it('should create a pipeline', () => {
        const handler = new SimpleHandler();
        expect( () => builder.registerPipeline(handler)).toThrow(new Error('Unregistered handler passed to pipeline.'));
        
        alive = builder.registerState('alive');
        builder.registerHandler(handler, alive);
        expect( () => builder.registerPipeline(handler)).not.toThrow();
      });

      it('should create a state machine', () => {
        const stateIndex = builder.registerState('testState');
        const stateIndex2 = builder.registerState('testState2');
        const handler = new SimpleHandler();
        builder.registerHandler(handler, stateIndex | stateIndex2)
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
        alive = builder.registerState('alive');
        damaged = builder.registerState('damaged');
        dead = builder.registerState('dead');
        const aliveHandler = builder.registerHandler(new AliveHandler(), alive);
        const damageHandler = builder.registerHandler(new DamagedHandler(), alive,damaged);
        const deadHandler  = builder.registerHandler(new DeadHandler(), dead);
        builder.registerPipeline(
          aliveHandler,
          damageHandler,
          deadHandler);
        stateMachine = builder.create();
        creatureId = stateMachine.addItem();
        creature = pool.get(creatureId);
        creature2Id = stateMachine.addItem();
        creature2 = pool.get(creature2Id);
        creature3Id = stateMachine.addItem();
        creature3 = pool.get(creature3Id);
      });

      it('should move through states', () => {
        expect(creature?.lifecycle).toEqual("created");
        expect(creature?.age).toEqual(0);
        expect(creature?.health).toEqual(100);

        stateMachine.addState(creatureId, alive);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("alive");
        expect(creature?.age).toEqual(1);
        expect(creature?.health).toEqual(100);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("alive");
        expect(creature?.age).toEqual(2);
        expect(creature?.health).toEqual(100);

        stateMachine.addState(creatureId, damaged);

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
        stateMachine.addState(creatureId, alive);

        expect(creature?.lifecycle).toEqual("created");
        expect(creature?.age).toEqual(0);
        expect(creature?.health).toEqual(100);

        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("alive");
        expect(creature?.age).toEqual(1);
        expect(creature?.health).toEqual(100);

        stateMachine.releaseItem(creatureId);

        // release is deferred so the item is still alive
        expect(creature?.lifecycle).toEqual("alive");
        expect(creature?.age).toEqual(1);
        expect(creature?.health).toEqual(100);

        // process deferred changes
        stateMachine.updateHandlerItems();

        expect(creature?.lifecycle).toEqual("reset");
        expect(creature?.age).toEqual(0);
        expect(creature?.health).toEqual(100);

        creatureId = stateMachine.addItem();
        stateMachine.addState(creatureId, alive);
        stateMachine.tick();

        expect(creature?.lifecycle).toEqual("alive");


      });

      it('should add and remove states from items', () => {
        const itemId = stateMachine.addItem();
        expect(stateMachine.addState(itemId, alive)).toBe(true);
        expect(stateMachine.removeState(itemId, alive)).toBe(true);
      });

      it('Should defer changes while iterating', () => {
        stateMachine.addState(creatureId, alive);
        stateMachine.addState(creature2Id, alive);
        stateMachine.addState(creature3Id, alive);

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
  });

}