/* eslint-disable @typescript-eslint/no-explicit-any */
export type AfterPatchFn = (object: any, property: string, handler: (...args: any[]) => any) => unknown;

/**
 * Guards `@decky/ui`'s `afterPatch` so repeated router renders never stack duplicate wrappers
 * onto the same `renderFunc` or route child `type`.
 */
export function createAfterPatchGuard(apply: AfterPatchFn) {
    const patched = new WeakSet<object>();
    return function afterPatchOnce(object: any, property: string, handler: (...args: any[]) => any): boolean {
        if (!object || (typeof object !== 'object' && typeof object !== 'function')) return false;
        let fn = object[property];
        let steps = 0;
        while (typeof fn === 'function' && steps < 16) {
            if (patched.has(fn)) return false;
            fn = (fn as { __deckyPatch?: { original?: unknown } }).__deckyPatch?.original;
            steps++;
        }
        if (typeof object[property] !== 'function') return false;
        apply(object, property, handler);
        if (typeof object[property] === 'function') patched.add(object[property]);
        return true;
    };
}
