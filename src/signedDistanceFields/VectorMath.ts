import { Vector3, Vector2 } from "@babylonjs/core/Maths";

function Max3(a: number, b: number, c: number): number {
    let result = a;
    if (b > result)
        result = b;
    if (c > result)
        result = c;
    return result;
}

function Max2(a: number, b: number): number {
    if (a > b)
        return a;
    return b;
}

function Min3(a: number, b: number, c: number): number {
    let result = a;
    if (b < result)
        result = b;
    if (c < result)
        result = c;
    return result;
}

function Min2(a: number, b: number): number {
    if (a < b)
        return a;
    return b;
}

/**
 * Maximum of two vector3
 * @param a 
 * @param b 
 * @param result
 */
function MaxVec3(a: Vector3,b: Vector3,result: Vector3): void {
    if (a.x > b.x)
        result.x = a.x;
    else
        result.x = b.x;
    if (a.y > b.y)
        result.y = a.y;
    else
        result.y = b.y;
    if (a.z > b.z)
        result.z = a.z;
    else
        result.z = b.z;
}

/**
 * Maximum of two vector2
 * @param a 
 * @param b 
 * @param result
 */
function MaxVec2(a: Vector2,b: Vector2,result: Vector2): void {
    if (a.x > b.x)
        result.x = a.x;
    else
        result.x = b.x;
    if (a.y > b.y)
        result.y = a.y;
    else
        result.y = b.y;
}

function AbsVec3(a: Vector3, result: Vector3): void {
    if (a.x < 0)
        result.x = -a.x;
    else
        result.x = a.x;
    if (a.y < 0)
        result.y = -a.y;
    else
        result.y = a.y;
    if (a.z < 0)
        result.z = -a.z;
    else
        result.z = a.z;
}

function AbsVec2(a: Vector2, result: Vector2): void {
    if (a.x < 0)
        result.x = -a.x;
    else
        result.x = a.x;
    if (a.y < 0)
        result.y = -a.y;
    else
        result.y = a.y;
}

function SubVec3(a: Vector3, x: number, y: number, z: number, result: Vector3) {
    result.set(a.x - x,a.y - y,a.z - z);
}

function AddVec3(a: Vector3, x: number, y: number, z: number, result: Vector3) {
    result.set(a.x + x,a.y + y,a.z + z);
}

export { Max3, Max2, Min3, Min2, MaxVec3, MaxVec2, AbsVec3, AbsVec2, SubVec3, AddVec3}