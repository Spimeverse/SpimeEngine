import { DistanceCache } from "..";
import { Chunk } from "..";
import { SdfFloor } from "..";
import { Vector3 } from "@babylonjs/core";

export function TestDistanceCache() {


    describe("DistanceCache", () => {

        it('caches sdf distances', () => {
            const cache = new DistanceCache(10);
            expect(cache.toString()).toBe("")
            cache.cacheDistance(1, 2, 3, 4);
            expect(cache.toString()).toBe("(1, 2, 3):[4]")
            cache.cacheDistance(4, 5, 6, 7);
            expect(cache.toString()).toBe("(1, 2, 3):[4], (4, 5, 6):[7]")
        })

        it('fills in samples from parent', () => {
            const parent = new DistanceCache(2);
            parent.cacheDistance(6, 6, 6, 1);

            const cache = new DistanceCache(1);
            cache.addParent(parent);
            const chunk = new Chunk();
            chunk.setSize({ x: 10, y: 10, z: 10 }, 1);
            const sdf = new SdfFloor(5, 100);
            let fillInSamples = 0;
            const sdfFunc = (samplePoint: Vector3) => {
                fillInSamples++;
                return sdf.sample(samplePoint);
            }
            expect(cache.getCachedCount()).toBe(0);
            cache.fillIn(chunk, sdfFunc);
            expect(cache.getCachedCount()).toBe(8);
            expect(fillInSamples).toBe(7);
            expect(cache.toString()).toEqual(
                // copied from parent
                "(6, 6, 6):[1], " +
                // filled in samples
                "(6, 7, 6):[2], " +
                "(7, 6, 6):[1], " +
                "(7, 7, 6):[2], " +
                "(6, 6, 7):[1], " +
                "(6, 7, 7):[2], " +
                "(7, 6, 7):[1], " +
                "(7, 7, 7):[2]");
        })

        it('fills in samples from children', () => {
            const child1 = new DistanceCache(1);
            child1.cacheDistance(0, 6, 0, 1);
            child1.cacheDistance(0, 7, 0, 1.5);
            // this is child point is in the middle of a parent voxel
            // so it shouldn't be used but should cause the parent to be sampled
            child1.cacheDistance(11, 7, 1, 1.5);

            const child2 = new DistanceCache(1);
            child2.cacheDistance(20, 6, 10, 1);
            child2.cacheDistance(20, 6.5, 10, 1.5);

            const cache = new DistanceCache(2);
            cache.addChild(child1);
            cache.addChild(child2);
            const chunk = new Chunk();
            chunk.setSize({ x: 40, y: 10, z: 10 }, 2);
            const sdf = new SdfFloor(5, 100);
            let fillInSamples = 0;
            const sdfFunc = (samplePoint: Vector3) => {
                fillInSamples++;
                return sdf.sample(samplePoint);
            }
            expect(cache.getCachedCount()).toBe(0);
            cache.fillIn(chunk, sdfFunc);
            expect(cache.getCachedCount()).toBe(24);
            expect(fillInSamples).toBe(22);
            expect(cache.toString()).toEqual(
                // these two child samples matched a parent sample position and were copied to the new cache
                "(0, 6, 0):[1], " +
                "(20, 6, 10):[1], " +
                // filled in 7 samples in the parent next to the child sample
                "(2, 6, 0):[1], " +
                "(0, 8, 0):[3], " +
                "(0, 6, 2):[1], " +
                "(2, 8, 0):[3], " +
                "(2, 6, 2):[1], " +
                "(0, 8, 2):[3], " +
                "(2, 8, 2):[3], " +
                // these 8 samples were around the child sample that didn't match a parent sample position exactly i.e (11,7,1)
                "(10, 6, 0):[1], " +
                "(12, 6, 0):[1], " +
                "(10, 8, 0):[3], " +
                "(10, 6, 2):[1], " +
                "(12, 8, 0):[3], " +
                "(12, 6, 2):[1], " +
                "(10, 8, 2):[3], " +
                "(12, 8, 2):[3], " +
                // filled in 7 samples in the parent next to the child sample
                "(22, 6, 10):[1], " +
                "(20, 8, 10):[3], " +
                "(20, 6, 12):[1], " +
                "(22, 8, 10):[3], " +
                "(22, 6, 12):[1], " +
                "(20, 8, 12):[3], " +
                "(22, 8, 12):[3]"
            );
        })

        it("ignores samples away from the surface", () => {
            const cache = new DistanceCache(0.5);
            cache.cacheDistance(0, 3, 0, 3);
            cache.cacheDistance(0, 2, 0, 2);
            cache.cacheDistance(0, 1, 0, 1);
            cache.cacheDistance(0, 0, 0, 0);
            cache.cacheDistance(0, -0.5, 0, -0.5);
            cache.cacheDistance(0, -1, 0, -1);
            cache.cacheDistance(0, -1.5, 0, -1.5);
            cache.cacheDistance(0, -2, 0, -2);
            expect(cache.toString()).toEqual(
                "(0, 1, 0):[1], " +
                "(0, 0, 0):[0], " +
                "(0, -0.5, 0):[-0.5], " +
                "(0, -1, 0):[-1]");
        });
        
    });



}

