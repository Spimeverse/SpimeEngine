import { OctBound } from ".."

export function TestOctBounds() {
        
    describe('OctBound', () => {

        it('intersects when x overlaps', () => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const b2 = new OctBound(0.5, 0, 0, 1, 1, 1);
            expect(b.intersects(b2)).toBe(true);
            expect(b2.intersects(b)).toBe(true);
        });

        it('intersects when y overlaps', () => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const b2 = new OctBound(0, 0.5, 0, 1, 1, 1);
            expect(b.intersects(b2)).toBe(true);
            expect(b2.intersects(b)).toBe(true);
        });

        it('intersects when z overlaps', () => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const b2 = new OctBound(0, 0, 0.5, 1, 1, 1);
            expect(b.intersects(b2)).toBe(true);
            expect(b2.intersects(b)).toBe(true);
        });

        it('does not intersect when x does not overlap', () => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const b2 = new OctBound(1.001, 0, 0, 2, 1, 1);
            expect(b.intersects(b2)).toBe(false);
            expect(b2.intersects(b)).toBe(false);
        });

        it('does not intersect when y does not overlap', () => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const b2 = new OctBound(0, 1.001, 0, 1, 2, 1);
            expect(b.intersects(b2)).toBe(false);
            expect(b2.intersects(b)).toBe(false);
        });

        it('does not intersect when z does not overlap', () => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const b2 = new OctBound(0, 0, 1.001, 1, 1, 2);
            expect(b.intersects(b2)).toBe(false);
            expect(b2.intersects(b)).toBe(false);
        });

        it('clones other bounds', () => {
            const b = new OctBound(0, 1, 2, 3, 4, 5);
            const b2 = b.clone();
            // reset the original to confirm it was not modified
            b.set(0,0,0,1,1,1);
            expect(b2.minX).toBe(0);
            expect(b2.minY).toBe(1);
            expect(b2.minZ).toBe(2);
            expect(b2.maxX).toBe(3);
            expect(b2.maxY).toBe(4);
            expect(b2.maxZ).toBe(5);
        });

        it('calculates extents',() => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            expect(b.extent).toBe(1);
            expect(b.halfExtent).toBe(0.5);
        });

        it('returns frontLeftBottom',() => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const flb = b.frontLeftBottom();
            expect(flb.minX).toBe(0);
            expect(flb.minY).toBe(0);
            expect(flb.minZ).toBe(0);
            expect(flb.maxX).toBe(0.5);
            expect(flb.maxY).toBe(0.5);
            expect(flb.maxZ).toBe(0.5);
        });

        it('returns frontLeftTop',() => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const flt = b.frontLeftTop();
            expect(flt.minX).toBe(0);
            expect(flt.minY).toBe(0.5);
            expect(flt.minZ).toBe(0);
            expect(flt.maxX).toBe(0.5);
            expect(flt.maxY).toBe(1);
            expect(flt.maxZ).toBe(0.5);
        });

        it('returns frontRightBottom',() => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const frb = b.frontRightBottom();
            expect(frb.minX).toBe(0.5);
            expect(frb.minY).toBe(0);
            expect(frb.minZ).toBe(0);
            expect(frb.maxX).toBe(1);
            expect(frb.maxY).toBe(0.5);
            expect(frb.maxZ).toBe(0.5);
        });

        it('returns frontRightTop',() => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const frt = b.frontRightTop();
            expect(frt.minX).toBe(0.5);
            expect(frt.minY).toBe(0.5);
            expect(frt.minZ).toBe(0);
            expect(frt.maxX).toBe(1);
            expect(frt.maxY).toBe(1);
            expect(frt.maxZ).toBe(0.5);
        });

        it('returns backLeftBottom',() => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const blb = b.backLeftBottom();
            expect(blb.minX).toBe(0);
            expect(blb.minY).toBe(0);
            expect(blb.minZ).toBe(0.5);
            expect(blb.maxX).toBe(0.5);
            expect(blb.maxY).toBe(0.5);
            expect(blb.maxZ).toBe(1);
        });

        it('returns backLeftTop',() => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const blt = b.backLeftTop();
            expect(blt.minX).toBe(0);
            expect(blt.minY).toBe(0.5);
            expect(blt.minZ).toBe(0.5);
            expect(blt.maxX).toBe(0.5);
            expect(blt.maxY).toBe(1);
            expect(blt.maxZ).toBe(1);
        });

        it('returns backRightBottom',() => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const brb = b.backRightBottom();
            expect(brb.minX).toBe(0.5);
            expect(brb.minY).toBe(0);
            expect(brb.minZ).toBe(0.5);
            expect(brb.maxX).toBe(1);
            expect(brb.maxY).toBe(0.5);
            expect(brb.maxZ).toBe(1);
        });

        it('returns backRightTop',() => {
            const b = new OctBound(0, 0, 0, 1, 1, 1);
            const brt = b.backRightTop();
            expect(brt.minX).toBe(0.5);
            expect(brt.minY).toBe(0.5);
            expect(brt.minZ).toBe(0.5);
            expect(brt.maxX).toBe(1);
            expect(brt.maxY).toBe(1);
            expect(brt.maxZ).toBe(1);
        });

    });
}

