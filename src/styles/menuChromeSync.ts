export const MENU_CHROME_STYLE_ID = 'native-home-menu-chrome';
export const MENU_CHROME_WINDOW_ATTR = 'data-nh-chrome';

export type ChromeWindowKind = 'sp' | 'mainmenu' | 'quickaccess' | 'overlay';

type TimeoutId = ReturnType<typeof setTimeout>;
type ChromeListener = (css: string) => void;

export interface WindowStoreEntry {
    doc: Document;
    kind?: ChromeWindowKind;
}

export interface MenuChromeSyncDeps {
    getCss(): string;
    isReady?(): boolean;
    getNavigationTrees?(): unknown[];
    getPopups?(): unknown;
    subscribePopupCreated?(cb: (popup: unknown) => void): (() => void) | void;
    getWindowStoreWindows?(): WindowStoreEntry[];
    injectCssIntoTab?(tab: string, css: string): Promise<string> | string;
    removeCssFromTab?(tab: string, id: string): Promise<void> | void;
    retryDelaysMs?: number[];
    setTimeoutFn?: (fn: () => void, ms: number) => TimeoutId;
    clearTimeoutFn?: (id: TimeoutId) => void;
    sharedContextDoc?: Document | null;
}

export interface MenuChromeSyncController {
    start(): void;
    stop(): void;
    sync(): void;
    setHostDocument(doc: Document | null): void;
    registerDocument(doc: Document | null, kind: ChromeWindowKind): void;
    subscribe(listener: ChromeListener): () => void;
}

interface FallbackState {
    id: string | null;
    css: string | null;
    targetCss: string | null;
    activeGen: number;
}

const DEFAULT_RETRIES_MS = [250, 1000, 3000];
const MAIN_MENU_MARKER = '#MainNavMenuContainer, #MainNavMenu-Rest';
const QUICK_ACCESS_MARKER = '#QuickAccess-Menu, #QuickAccess-NA';
const SP_MARKER = '#Footer, #header';
const ALLOWED_MARKER = `${MAIN_MENU_MARKER}, ${QUICK_ACCESS_MARKER}, ${SP_MARKER}`;

function safeTitle(doc: Document): string {
    try {
        return typeof doc.title === 'string' ? doc.title : '';
    } catch {
        return '';
    }
}

function safeHref(doc: Document): string {
    try {
        return typeof doc.location?.href === 'string' ? doc.location.href : '';
    } catch {
        return '';
    }
}

function safeHostname(doc: Document): string {
    try {
        return typeof doc.location?.hostname === 'string' ? doc.location.hostname : '';
    } catch {
        return '';
    }
}

function hasSelector(doc: Document, selector: string): boolean {
    try {
        return Boolean(doc.querySelector?.(selector));
    } catch {
        return false;
    }
}

function toList(raw: unknown): unknown[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw instanceof Map || raw instanceof Set) return Array.from(raw.values());
    if (typeof (raw as Iterable<unknown>)[Symbol.iterator] === 'function') {
        try {
            return Array.from(raw as Iterable<unknown>);
        } catch {
            return [];
        }
    }
    if (typeof raw === 'object') {
        try {
            return Object.values(raw as Record<string, unknown>);
        } catch {
            return [];
        }
    }
    return [];
}

function isAllowedSteamDocument(doc: Document | null | undefined, sharedContextDoc: Document | null | undefined, hostDoc: Document | null): doc is Document {
    if (!doc || !doc.head) return false;
    const title = safeTitle(doc);
    if (title === 'SharedJSContext') return false;
    if (sharedContextDoc && doc === sharedContextDoc) return false;
    if (hostDoc && doc === hostDoc) return true;
    const hostname = safeHostname(doc);
    if (hostname === 'steamloopback.host') return true;
    const href = safeHref(doc);
    if (!href || href === 'about:blank' || href.startsWith('about:blank?')) return true;
    if (/^(?:SP|MainMenu|QuickAccess)|Big Picture/i.test(title)) return true;
    return hasSelector(doc, ALLOWED_MARKER);
}

function classifyDocument(doc: Document, hint: ChromeWindowKind | undefined, hostDoc: Document | null): ChromeWindowKind {
    const title = safeTitle(doc);
    if (hint === 'quickaccess' || /QuickAccess/i.test(title)) return 'quickaccess';
    if (hint === 'mainmenu' || /MainMenu/i.test(title)) return 'mainmenu';
    if (hint === 'sp' || (hostDoc && doc === hostDoc) || /^SP$|Big Picture/i.test(title)) return 'sp';
    if (hasSelector(doc, QUICK_ACCESS_MARKER)) return 'quickaccess';
    if (hasSelector(doc, MAIN_MENU_MARKER)) return 'mainmenu';
    if (hasSelector(doc, SP_MARKER)) return 'sp';
    return hint ?? 'overlay';
}

function hintFromName(name: unknown): ChromeWindowKind | undefined {
    const str = typeof name === 'string' ? name : '';
    if (!str) return undefined;
    if (/QuickAccess/i.test(str)) return 'quickaccess';
    if (/MainNavMenu|MainMenu/i.test(str)) return 'mainmenu';
    if (/GamepadUI|^SP$/i.test(str)) return 'sp';
    return undefined;
}

function kindPriority(kind: ChromeWindowKind): number {
    if (kind === 'quickaccess' || kind === 'mainmenu') return 3;
    if (kind === 'sp') return 2;
    return 1;
}

/**
 * Synchronizes menu/QAM/footer CSS across every Steam Big Picture document (`SP`, `MainMenu`, `QuickAccess`, overlays)
 * with `@decky/api` tab-injection fallback while a side-menu DOM document is not reachable yet.
 */
export function createMenuChromeSync(deps: MenuChromeSyncDeps): MenuChromeSyncController {
    const retryDelays = deps.retryDelaysMs ?? DEFAULT_RETRIES_MS;
    const setTimer = deps.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
    const clearTimer = deps.clearTimeoutFn ?? ((id) => clearTimeout(id));
    const listeners = new Set<ChromeListener>();
    const manualDocs = new Map<Document, ChromeWindowKind>();
    const touchedDocs = new Set<Document>();
    const activeTimers = new Set<TimeoutId>();
    const fallbackState: Record<'MainMenu' | 'QuickAccess', FallbackState> = {
        MainMenu: { id: null, css: null, targetCss: null, activeGen: 0 },
        QuickAccess: { id: null, css: null, targetCss: null, activeGen: 0 },
    };

    let hostDoc: Document | null = null;
    let hostWin: Window | null = null;
    let stopped = true;
    let unsubPopup: (() => void) | null = null;
    let lastNotifiedCss: string | null = null;
    let lastHasBothMenus = false;
    let genCounter = 0;

    const onHostWindowActivity = () => {
        if (!stopped) sync();
    };

    const detachHostListeners = () => {
        if (!hostWin) return;
        try {
            hostWin.removeEventListener('focus', onHostWindowActivity);
            hostWin.removeEventListener('blur', onHostWindowActivity);
        } catch {
            // window may already be closed
        }
        hostWin = null;
    };

    const attachHostListeners = (win: Window | null | undefined) => {
        if (!win || win === hostWin) return;
        detachHostListeners();
        try {
            win.addEventListener('focus', onHostWindowActivity);
            win.addEventListener('blur', onHostWindowActivity);
            hostWin = win;
        } catch {
            hostWin = null;
        }
    };

    const upsertStyle = (doc: Document, css: string) => {
        const existing = doc.getElementById(MENU_CHROME_STYLE_ID) as HTMLStyleElement | null;
        if (!css) {
            existing?.remove();
            return;
        }
        if (existing) {
            if (existing.textContent !== css) existing.textContent = css;
            return;
        }
        const style = doc.createElement('style');
        style.id = MENU_CHROME_STYLE_ID;
        style.textContent = css;
        doc.head.appendChild(style);
    };

    const removeManagedFromDoc = (doc: Document) => {
        try {
            doc.getElementById(MENU_CHROME_STYLE_ID)?.remove();
        } catch {
            // ignore detached document
        }
        try {
            doc.documentElement?.removeAttribute(MENU_CHROME_WINDOW_ATTR);
        } catch {
            // ignore detached document
        }
    };

    const clearFallbackTab = (tab: 'MainMenu' | 'QuickAccess') => {
        const state = fallbackState[tab];
        state.activeGen = 0;
        state.targetCss = null;
        if (state.id && deps.removeCssFromTab) {
            const oldId = state.id;
            state.id = null;
            state.css = null;
            try {
                Promise.resolve(deps.removeCssFromTab(tab, oldId)).catch(() => undefined);
            } catch {
                // ignore cleanup errors on unload
            }
        } else {
            state.id = null;
            state.css = null;
        }
    };

    const ensureFallbackTab = (tab: 'MainMenu' | 'QuickAccess', css: string) => {
        const state = fallbackState[tab];
        if (!css || !deps.injectCssIntoTab) {
            clearFallbackTab(tab);
            return;
        }
        if (state.id !== null && state.css === css) return;
        if (state.activeGen > 0 && state.targetCss === css) return;

        if (state.id && deps.removeCssFromTab) {
            const prevId = state.id;
            state.id = null;
            state.css = null;
            try {
                Promise.resolve(deps.removeCssFromTab(tab, prevId)).catch(() => undefined);
            } catch {
                // ignore
            }
        }

        const gen = ++genCounter;
        state.activeGen = gen;
        state.targetCss = css;
        const applyInjected = (injectedId: string | undefined) => {
            if (!injectedId) return;
            if (stopped || state.activeGen !== gen) {
                if (deps.removeCssFromTab) {
                    Promise.resolve(deps.removeCssFromTab(tab, injectedId)).catch(() => undefined);
                }
                return;
            }
            state.id = injectedId;
            state.css = css;
            state.activeGen = 0;
        };

        try {
            const raw = deps.injectCssIntoTab(tab, css);
            if (raw && typeof (raw as Promise<string>).then === 'function') {
                (raw as Promise<string>)
                    .then(applyInjected)
                    .catch(() => {
                        if (state.activeGen === gen) {
                            state.activeGen = 0;
                            state.targetCss = null;
                        }
                    });
            } else {
                applyInjected(typeof raw === 'string' ? raw : undefined);
            }
        } catch {
            if (state.activeGen === gen) {
                state.activeGen = 0;
                state.targetCss = null;
            }
        }
    };

    const collectDocuments = (): Map<Document, ChromeWindowKind> => {
        const candidates = new Map<Document, ChromeWindowKind>();
        const consider = (doc: Document | null | undefined, hint?: ChromeWindowKind) => {
            if (!isAllowedSteamDocument(doc, deps.sharedContextDoc, hostDoc)) return;
            const kind = classifyDocument(doc, hint, hostDoc);
            const prev = candidates.get(doc);
            if (!prev || kindPriority(kind) > kindPriority(prev)) {
                candidates.set(doc, kind);
            }
        };

        if (hostDoc) consider(hostDoc, 'sp');

        for (const [doc, kind] of Array.from(manualDocs.entries())) {
            if ((doc as { isConnected?: boolean }).isConnected === false) {
                manualDocs.delete(doc);
                continue;
            }
            consider(doc, kind);
        }

        try {
            for (const tree of toList(deps.getNavigationTrees?.())) {
                const entry = tree as { id?: string; m_sID?: string; m_Root?: { m_element?: { ownerDocument?: Document } } };
                const doc = entry?.m_Root?.m_element?.ownerDocument;
                consider(doc, hintFromName(entry?.id ?? entry?.m_sID));
            }
        } catch {
            // ignore nav tree read errors
        }

        try {
            for (const popup of toList(deps.getPopups?.())) {
                const p = popup as {
                    m_strName?: string;
                    name?: string;
                    m_popup?: { document?: Document };
                    window?: { document?: Document };
                    BrowserWindow?: { document?: Document };
                    document?: Document;
                };
                const doc = p?.m_popup?.document ?? p?.window?.document ?? p?.BrowserWindow?.document ?? p?.document;
                consider(doc, hintFromName(p?.m_strName ?? p?.name));
            }
        } catch {
            // ignore popup list errors
        }

        try {
            for (const win of toList(deps.getWindowStoreWindows?.())) {
                const entry = win as WindowStoreEntry;
                consider(entry?.doc, entry?.kind);
            }
        } catch {
            // ignore window store errors
        }

        return candidates;
    };

    const sync = () => {
        if (stopped) return;
        const css = deps.getCss();
        const docs = collectDocuments();

        let hasMainMenuDom = false;
        let hasQuickAccessDom = false;

        for (const [doc, kind] of docs.entries()) {
            touchedDocs.add(doc);
            try {
                const root = doc.documentElement;
                if (root && root.getAttribute(MENU_CHROME_WINDOW_ATTR) !== kind) {
                    root.setAttribute(MENU_CHROME_WINDOW_ATTR, kind);
                }
            } catch {
                // ignore attribute errors
            }

            if (hostDoc && doc === hostDoc) {
                doc.getElementById(MENU_CHROME_STYLE_ID)?.remove();
            } else {
                upsertStyle(doc, css);
            }

            if (kind === 'mainmenu') hasMainMenuDom = true;
            if (kind === 'quickaccess') hasQuickAccessDom = true;
            if (kind === 'sp') {
                if (hasSelector(doc, MAIN_MENU_MARKER)) hasMainMenuDom = true;
                if (hasSelector(doc, QUICK_ACCESS_MARKER)) hasQuickAccessDom = true;
            }
        }

        lastHasBothMenus = hasMainMenuDom && hasQuickAccessDom;

        if (hasMainMenuDom) {
            clearFallbackTab('MainMenu');
        } else {
            ensureFallbackTab('MainMenu', css);
        }

        if (hasQuickAccessDom) {
            clearFallbackTab('QuickAccess');
        } else {
            ensureFallbackTab('QuickAccess', css);
        }

        if (css !== lastNotifiedCss) {
            lastNotifiedCss = css;
            for (const listener of listeners) {
                try {
                    listener(css);
                } catch {
                    // ignore subscriber error
                }
            }
        }
    };

    const clearTimers = () => {
        for (const id of activeTimers) {
            clearTimer(id);
        }
        activeTimers.clear();
    };

    const scheduleRetry = (index: number) => {
        if (stopped || index >= retryDelays.length) return;
        const delay = retryDelays[index];
        const id = setTimer(() => {
            activeTimers.delete(id);
            if (stopped) return;
            sync();
            const ready = deps.isReady ? deps.isReady() : true;
            if (!ready || !lastHasBothMenus) {
                scheduleRetry(index + 1);
            }
        }, delay);
        activeTimers.add(id);
    };

    const start = () => {
        stopped = false;
        clearTimers();
        if (unsubPopup) {
            unsubPopup();
            unsubPopup = null;
        }
        if (deps.subscribePopupCreated) {
            let active = true;
            const rawUnsub = deps.subscribePopupCreated(() => {
                if (!active || stopped) return;
                sync();
            });
            unsubPopup = () => {
                active = false;
                if (typeof rawUnsub === 'function') rawUnsub();
            };
        }
        sync();
        const ready = deps.isReady ? deps.isReady() : true;
        if (!ready || !lastHasBothMenus) {
            scheduleRetry(0);
        }
    };

    const stop = () => {
        stopped = true;
        clearTimers();
        if (unsubPopup) {
            try {
                unsubPopup();
            } catch {
                // ignore
            }
            unsubPopup = null;
        }
        detachHostListeners();
        clearFallbackTab('MainMenu');
        clearFallbackTab('QuickAccess');
        for (const doc of touchedDocs) {
            removeManagedFromDoc(doc);
        }
        touchedDocs.clear();
        manualDocs.clear();
        hostDoc = null;
        lastNotifiedCss = null;
        lastHasBothMenus = false;
        listeners.clear();
    };

    const setHostDocument = (doc: Document | null) => {
        if (doc === hostDoc) {
            if (doc && !stopped) sync();
            return;
        }
        detachHostListeners();
        hostDoc = doc;
        if (doc) attachHostListeners(doc.defaultView);
        if (!stopped) sync();
    };

    const registerDocument = (doc: Document | null, kind: ChromeWindowKind) => {
        if (!doc) return;
        manualDocs.set(doc, kind);
        if (!stopped) sync();
    };

    const subscribe = (listener: ChromeListener) => {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    };

    return { start, stop, sync, setHostDocument, registerDocument, subscribe };
}
