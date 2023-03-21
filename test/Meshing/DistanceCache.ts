import { DistanceCache } from "..";
import { Chunk } from "..";
import { SdfFloor } from "..";

export function TestDistanceCache() {


    describe("DistanceCache", () => {

        it('caches sdf distances', () => {
            const cache = new DistanceCache();
            cache.cacheDistance(1, 2, 3, 4);
            expect(cache.getCachedCount()).toBe(1);
            expect(DistancesToString(cache.getDistances())).toEqual("4");
            expect(PositionsToString(cache.getPositions())).toEqual("(1,2,3)");
        })

        it('fills in samples from parent', () => {
            const parent = new DistanceCache();
            parent.cacheDistance(6, 6, 6, 1);

            const cache = new DistanceCache();
            cache.addParent(parent);
            const chunk = new Chunk();
            chunk.setSize({ x: 10, y: 10, z: 10 }, 1);
            const sdf = new SdfFloor(5, 100);
            cache.fillIn(chunk, sdf);
            expect(cache.getCachedCount()).toBe(8);
            expect(DistancesToString(cache.getDistances())).toEqual("1, 2, 1, 2, 1, 2, 1, 2");
            expect(PositionsToString(cache.getPositions())).toEqual("(6,6,6),(6,7,6),(7,6,6),(7,7,6),(6,6,7),(6,7,7),(7,6,7),(7,7,7)");
        })
    });

}

function PositionsToString(positions: number[]) {
    let result = "";
    for (let i = 0; i < positions.length; i += 3) {
        if (result.length > 0)
            result += ",";
        result += `(${positions[i]},${positions[i + 1]},${positions[i + 2]})`
    }
    return result;
}

function DistancesToString(distances: number[]) {
    return distances.join(", ");
}