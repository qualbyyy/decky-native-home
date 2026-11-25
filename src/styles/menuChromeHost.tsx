import { injectCssIntoTab, removeCssFromTab, routerHook } from '@decky/api';
import { getGamepadNavigationTrees, Router } from '@decky/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LOG_PREFIX } from '../constants';
import { settings, useSettings } from '../data/settings';
import { ChromeWindowKind, createMenuChromeSync, WindowStoreEntry } from './menuChromeSync';
import { menuChromeClassesReady, menuChromeCss } from './menuCssRuntime';

const GLOBAL_COMPONENT_NAME = 'NativeHomeMenuChrome';

/* eslint-disable @typescript-eslint/no-explicit-any */
function collectNavigationTrees(): unknown[] {
    const trees: unknown[] = [];
    const seen = new Set<unknown>();
    const push = (item: unknown) => {
        if (!item || seen.has(item)) return;
        seen.add(item);
        trees.push(item);
    };

    try {
        const direct = getGamepadNavigationTrees();
        if (Array.isArray(direct)) {
            for (const t of direct) push(t);
        }
    } catch {
        // ignore if FocusNavController is not initialized yet
    }

    try {
        const contexts = (globalThis as any).FocusNavController?.m_rgAllContexts;
        if (Array.isArray(contexts)) {
            for (const ctx of contexts) {
                const list = ctx?.m_rgGamepadNavigationTrees;
                if (Array.isArray(list)) {
                    for (const t of list) push(t);
                }
            }
        }
    } catch {
        // ignore
    }

    return trees;
}

function collectPopups(): unknown[] {
    try {
        const manager = (globalThis as any).g_PopupManager;
        if (!manager) return [];
        const raw = typeof manager.GetPopups === 'function' ? manager.GetPopups() : manager.m_mapPopups;
        if (Array.isArray(raw)) return raw;
        if (raw instanceof Map || raw instanceof Set) return Array.from(raw.values());
        if (raw && typeof raw === 'object') return Object.values(raw);
        return [];
    } catch {
        return [];
    }
}

function subscribePopupCreated(cb: (popup: unknown) => void): (() => void) | void {
    try {
        const manager = (globalThis as any).g_PopupManager;
        if (!manager || typeof manager.AddPopupCreatedCallback !== 'function') return undefined;
        let disposed = false;
        const token = manager.AddPopupCreatedCallback((popup: unknown) => {
            if (!disposed) cb(popup);
        });
        return () => {
            disposed = true;
            if (typeof token === 'function') {
                token();
            } else if (token && typeof token.Unregister === 'function') {
                token.Unregister();
            }
        };
    } catch {
        return undefined;
    }
}

function collectWindowStoreWindows(): WindowStoreEntry[] {
    const result: WindowStoreEntry[] = [];
    const seenDocs = new Set<Document>();
    const pushWin = (win: any, kind?: ChromeWindowKind) => {
        const doc = win?.BrowserWindow?.document as Document | undefined;
        if (!doc || seenDocs.has(doc)) return;
        seenDocs.add(doc);
        result.push({ doc, kind });
    };

    const stores = [(Router as any)?.WindowStore, (globalThis as any).SteamUIStore?.WindowStore];
    for (const store of stores) {
        if (!store) continue;
        pushWin(store.GamepadUIMainWindowInstance, 'sp');
        if (Array.isArray(store.SteamUIWindows)) {
            for (const win of store.SteamUIWindows) pushWin(win);
        }
        if (Array.isArray(store.OverlayWindows)) {
            for (const win of store.OverlayWindows) pushWin(win, 'overlay');
        }
    }
    return result;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const menuChromeSync = createMenuChromeSync({
    getCss: menuChromeCss,
    isReady: menuChromeClassesReady,
    getNavigationTrees: collectNavigationTrees,
    getPopups: collectPopups,
    subscribePopupCreated,
    getWindowStoreWindows: collectWindowStoreWindows,
    injectCssIntoTab,
    removeCssFromTab,
    sharedContextDoc: typeof document !== 'undefined' ? document : null,
});

/** Persistent global component mounted in Big Picture so menu/QAM/footer chrome applies on every route. */
export function MenuChromeHost() {
    const { customMenus } = useSettings();
    const [css, setCss] = useState(() => (customMenus ? menuChromeCss() : ''));
    const hostElRef = useRef<HTMLSpanElement | null>(null);

    const attachHost = useCallback((el: HTMLSpanElement | null) => {
        hostElRef.current = el;
        if (settings.get().customMenus) menuChromeSync.setHostDocument(el?.ownerDocument ?? null);
    }, []);

    useEffect(() => {
        if (!customMenus) {
            setCss('');
            return undefined;
        }
        const nextInitial = menuChromeCss();
        setCss((prev) => (prev === nextInitial ? prev : nextInitial));
        const unsubscribe = menuChromeSync.subscribe((nextCss) => {
            setCss((prev) => (prev === nextCss ? prev : nextCss));
        });
        menuChromeSync.setHostDocument(hostElRef.current?.ownerDocument ?? null);
        return () => {
            unsubscribe();
            menuChromeSync.setHostDocument(null);
        };
    }, [customMenus]);

    return (
        <>
            <span ref={attachHost} style={{ display: 'none' }} aria-hidden="true" />
            {customMenus && css ? <style data-native-home-chrome="host">{css}</style> : null}
        </>
    );
}

export function registerMenuChromeDocument(doc: Document | null, kind: ChromeWindowKind): void {
    if (!settings.get().customMenus) return;
    menuChromeSync.registerDocument(doc, kind);
}

export function installMenuChrome(): () => void {
    try {
        routerHook.addGlobalComponent(GLOBAL_COMPONENT_NAME, MenuChromeHost);
    } catch (error) {
        console.warn(`${LOG_PREFIX} failed to register global menu chrome host`, error);
    }
    let active = settings.get().customMenus;
    if (active) menuChromeSync.start();
    const unsubSettings = settings.subscribe(() => {
        const next = settings.get().customMenus;
        if (next === active) return;
        active = next;
        if (next) menuChromeSync.start();
        else menuChromeSync.stop();
    });

    return () => {
        unsubSettings();
        try {
            routerHook.removeGlobalComponent(GLOBAL_COMPONENT_NAME);
        } catch (error) {
            console.warn(`${LOG_PREFIX} failed to remove global menu chrome host`, error);
        }
        try {
            menuChromeSync.stop();
        } catch (error) {
            console.warn(`${LOG_PREFIX} failed to stop menu chrome sync`, error);
        }
    };
}
