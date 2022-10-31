import { AxisAlignedBoxBound, SphereBound } from ".."

export function TestSphereBoxBounds() {
    
    describe('Spherebound overlaps Spherebound', () => {

        it('overlaps when x separation is less than radius', () => {
            const sphere1 = new SphereBound(0, 0, 0, 0.5);
            const sphere2 = new SphereBound(0.9, 0, 0, 0.5);
            expect(sphere1.overlapSphere(sphere2)).toBe(true);
            expect(sphere2.overlapSphere(sphere1)).toBe(true);
        });

        it('does not overlaps when x separation is greater than radius', () => {
            const sphere1 = new SphereBound(0, 0, 0, 0.5);
            const sphere2 = new SphereBound(1.1, 0, 0, 0.5);
            expect(sphere1.overlapSphere(sphere2)).toBe(false);
            expect(sphere2.overlapSphere(sphere1)).toBe(false);
        });

        it('overlaps when y separation is less than radius', () => {
            const sphere1 = new SphereBound(0, 0, 0, 0.5);
            const sphere2 = new SphereBound(0, 0.9, 0, 0.5);
            expect(sphere1.overlapSphere(sphere2)).toBe(true);
            expect(sphere2.overlapSphere(sphere1)).toBe(true);
        });

        it('does not overlaps when y separation is greater than radius', () => {
            const sphere1 = new SphereBound(0, 0, 0, 0.5);
            const sphere2 = new SphereBound(0, 1.1, 0, 0.5);
            expect(sphere1.overlapSphere(sphere2)).toBe(false);
            expect(sphere2.overlapSphere(sphere1)).toBe(false);
        });

        it('overlaps when z separation is less than radius', () => {
            const sphere1 = new SphereBound(0, 0, 0, 0.5);
            const sphere2 = new SphereBound(0, 0, 0.9, 0.5);
            expect(sphere1.overlapSphere(sphere2)).toBe(true);
            expect(sphere2.overlapSphere(sphere1)).toBe(true);
        });

        it('does not overlaps when z separation is greater than radius', () => {
            const sphere1 = new SphereBound(0, 0, 0, 0.5);
            const sphere2 = new SphereBound(0, 0, 1.1, 0.5);
            expect(sphere1.overlapSphere(sphere2)).toBe(false);
            expect(sphere2.overlapSphere(sphere1)).toBe(false);
        });
            
        it('overlaps when x and y separation is less than radius', () => {
            const sphere1 = new SphereBound(0, 0, 0, 0.5);
            const sphere2 = new SphereBound(0.7, 0.7, 0, 0.5);
            expect(sphere1.overlapSphere(sphere2)).toBe(true);
            expect(sphere2.overlapSphere(sphere1)).toBe(true);
        });

        it('does not overlaps when x and y separation is greater than radius', () => {
            const sphere1 = new SphereBound(0, 0, 0, 0.5);
            const sphere2 = new SphereBound(0.8, 0.8, 0, 0.5);
            expect(sphere1.overlapSphere(sphere2)).toBe(false);
            expect(sphere2.overlapSphere(sphere1)).toBe(false);
        });

        it('overlaps when x and z separation is less than radius', () => {
            const sphere1 = new SphereBound(0, 0, 0, 0.5);
            const sphere2 = new SphereBound(0.7, 0, 0.7, 0.5);
            expect(sphere1.overlapSphere(sphere2)).toBe(true);
            expect(sphere2.overlapSphere(sphere1)).toBe(true);
        });

        it('does not overlaps when x and z separation is greater than radius', () => {
            const sphere1 = new SphereBound(0, 0, 0, 0.5);
            const sphere2 = new SphereBound(0.8, 0, 0.8, 0.5);
            expect(sphere1.overlapSphere(sphere2)).toBe(false);
            expect(sphere2.overlapSphere(sphere1)).toBe(false);
        });

        it('overlaps when y and z separation is less than radius', () => {
            const sphere1 = new SphereBound(0, 0, 0, 0.5);
            const sphere2 = new SphereBound(0, 0.7, 0.7, 0.5);
            expect(sphere1.overlapSphere(sphere2)).toBe(true);
            expect(sphere2.overlapSphere(sphere1)).toBe(true);
        });

        it('does not overlaps when y and z separation is greater than radius', () => {
            const sphere1 = new SphereBound(0, 0, 0, 0.5);
            const sphere2 = new SphereBound(0, 0.8, 0.8, 0.5);
            expect(sphere1.overlapSphere(sphere2)).toBe(false);
            expect(sphere2.overlapSphere(sphere1)).toBe(false);
        });
          

    });

    describe('SphereBounds overlap AABB box', () => {

        it('overlapAABB when x positive overlapAABB', () => {
            const s = new SphereBound(0.9, 0, 0, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).toBe(true);
        });

        it('overlapAABB when y positive overlapAABB', () => {
            const s = new SphereBound(0, 0.9, 0, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).toBe(true);
        });

        it('overlapAABB when z positive overlapAABB', () => {
            const s = new SphereBound(0, 0, 0.9, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).toBe(true);
        });

        it('overlapAABB when x negative overlapAABB', () => {
            const s = new SphereBound(-0.9, 0, 0, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).toBe(true);
        });

        it('overlapAABB when y negative overlapAABB', () => {
            const s = new SphereBound(0, -0.9, 0, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).toBe(true);
        });

        it('overlapAABB when z negative overlapAABB', () => {
            const s = new SphereBound(0, 0, -0.9, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).toBe(true);
        });

        it('overlapAABB when x positive overlapAABB', () => {
            const s = new SphereBound(0.9, 0, 0, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).toBe(true);
        });

        it('overlapAABB with positive x & y', () => {
            const s = new SphereBound(1.7, 1.7, 0, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).toBe(true);
        });

        it('overlapAABB with positive x & z', () => {
            const s = new SphereBound(1.7, 0, 1.7, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).toBe(true);
        });

        it('overlapAABB with positive y & z', () => {
            const s = new SphereBound(0, 1.7, 1.7, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).toBe(true);
        });

        it('overlapAABB with negative x & y', () => {
            const s = new SphereBound(0.7, 0.7, 0, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).toBe(true);
        });

        it('overlapAABB with negative x & z', () => {
            const s = new SphereBound(0.7, 0, 0.7, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).toBe(true);
        });

        it('overlapAABB with negative y & z', () => {
            const s = new SphereBound(0, 0.7, 0.7, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).toBe(true);
        });

        it('does not overlapAABB with positive x & y when a box would', () => {
            const s = new SphereBound(1.72, 1.72, 0, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).withContext('should not overlap the corner, distance to corner is 0.71 at 45 degs to corner ( sin(45deg) = 0.71 )').toBe(false);
        });

        it('does not overlapAABB with positive y & z when a box would', () => {
            const s = new SphereBound(0, 1.72, 1.72, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).withContext('should not overlap the corner, distance to corner is 0.71 at 45 degs to corner ( sin(45deg) = 0.71 )').toBe(false);
        });

        it('does not overlapAABB with positive x & z when a box would', () => {
            const s = new SphereBound(1.72, 0, 1.72, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).withContext('should not overlap the corner, distance to corner is 0.71 at 45 degs to corner ( sin(45deg) = 0.71 )').toBe(false);
        });

        it('does not overlapAABB with negative x & y when a box would', () => {
            const s = new SphereBound(-0.72, -0.72, 0, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).withContext('should not overlap the corner, distance to corner is 0.71 at 45 degs to corner ( sin(45deg) = 0.71 )').toBe(false);
        });

        it('does not overlapAABB with negative y & z when a box would', () => {
            const s = new SphereBound(0, -0.72, -0.72, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).withContext('should not overlap the corner, distance to corner is 0.71 at 45 degs to corner ( sin(45deg) = 0.71 )').toBe(false);
        });

        it('does not overlapAABB with negative x & z when a box would', () => {
            const s = new SphereBound(-0.72, 0, -0.72, 1);
            const b = new AxisAlignedBoxBound(0, 0, 0, 1, 1, 1);
            expect(b.overlapSphere(s)).withContext('should not overlap the corner, distance to corner is 0.71 at 45 degs to corner ( sin(45deg) = 0.71 )').toBe(false);
        });

    });

}