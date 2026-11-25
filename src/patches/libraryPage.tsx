import { RoutePatch, routerHook } from '@decky/api';
import { afterPatch } from '@decky/ui';
import { ReactElement } from 'react';
import { LOG_PREFIX } from '../constants';
import { settings } from '../data/settings';
import { isMemoHome, isPatchableHomeType } from '../home/guard';
import { homeMode } from '../home/mode';
import { RouteGuard } from '../home/RouteGuard';
import { LibraryGate } from '../library/LibraryGate';
import { createHomePatchManager } from './homePatchManager';
import { createAfterPatchGuard } from './patchOnce';

const afterPatchOnce = createAfterPatchGuard(afterPatch);

const LIBRARY_ROUTE = '/library';
const KEY = 'native-home-library';
const warned = new Set<string>();

const warnOnce = (message: string, error?: unknown) => {
    if (warned.has(message)) return;
    warned.add(message);
    console.warn(`${LOG_PREFIX} ${message}; leaving Steam's Library unchanged`, ...(error === undefined ? [] : [error]));
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const patchedMemos = new WeakMap<object, any>();

function wrapLibrary(fallback: ReactElement): ReactElement {
    return (
        <RouteGuard key={KEY} fallback={fallback}>
            <LibraryGate>{fallback}</LibraryGate>
        </RouteGuard>
    );
}

function patchedMemo(memoType: any): any {
    const cached = patchedMemos.get(memoType);
    if (cached) return cached;
    const copy = { ...memoType };
    afterPatch(copy, 'type', (_: unknown[], nativeTree: any) => wrapLibrary(nativeTree));
    patchedMemos.set(memoType, copy);
    return copy;
}

const libraryRoutePatch: RoutePatch = (routeProps: any) => {
    try {
        if (!routeProps || typeof routeProps !== 'object') {
            warnOnce('Library route shape changed');
            return routeProps;
        }
        if (typeof routeProps.renderFunc === 'function') {
            afterPatchOnce(routeProps, 'renderFunc', (_: unknown[], ret: any) => wrapLibrary(ret));
            return routeProps;
        }
        const child = routeProps.children;
        if (!child || typeof child !== 'object') {
            warnOnce('Library route child missing');
            return routeProps;
        }
        if (isPatchableHomeType(child.type)) {
            afterPatchOnce(child, 'type', (_: unknown[], element: any) => {
                try {
                    if (isMemoHome(element)) return { ...element, type: patchedMemo(element.type) };
                    return element ? wrapLibrary(element) : element;
                } catch (error) {
                    warnOnce('Library child patch failed', error);
                    return element;
                }
            });
            return routeProps;
        }
        if (isMemoHome(child)) {
            return { ...routeProps, children: { ...child, type: patchedMemo(child.type) } };
        }
        return { ...routeProps, children: wrapLibrary(child) };
    } catch (error) {
        warnOnce('Library route patch failed', error);
        return routeProps;
    }
};

export function patchLibraryPage(): () => void {
    try {
        const manager = createHomePatchManager({
            isOn: () => homeMode(settings.get()).library,
            subscribe: (listener) => settings.subscribe(listener),
            add: () => routerHook.addPatch(LIBRARY_ROUTE, libraryRoutePatch),
            remove: (handle) => routerHook.removePatch(LIBRARY_ROUTE, handle as RoutePatch),
        });
        manager.start();
        return () => {
            try {
                manager.stop();
            } catch (error) {
                console.warn(`${LOG_PREFIX} Library route unpatch failed`, error);
            }
        };
    } catch (error) {
        console.warn(`${LOG_PREFIX} Library route patch failed; leaving Steam's Library unchanged`, error);
        return () => undefined;
    }
}
