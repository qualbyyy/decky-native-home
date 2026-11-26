import { useSyncExternalStore } from 'react';
import { RECENT_ROW, RowSort, rowSortOf } from '../home/collections';
import { RowStyle, rowStyleOf } from '../home/recentsLayout';
import { backendKv, KvBackend } from './kv';
import { readScreensaverOptions, SCREENSAVER_DEFAULTS, ScreensaverOptions } from '../screensaver/options';

export type HomeLayout = 'carousel' | 'minimal';
export type MinimalSide = 'left' | 'right';
export type PluginLanguage = 'en' | 'ru';
export type GamePageLayout = 'auto' | 'full' | 'minimal';
export type LibraryLayout = 'auto' | 'grid' | 'minimal';
export type LibraryGridSize = 'compact' | 'standard' | 'large';
export type HeroPosition = 'center' | 'left' | 'right' | 'top' | 'bottom';

export function heroPositionCss(position: HeroPosition): string {
    switch (position) {
        case 'left': return '0% 30%';
        case 'right': return '100% 30%';
        case 'top': return '50% 0%';
        case 'bottom': return '50% 100%';
        default: return '50% 30%';
    }
}

export interface Settings {
    settingsVersion: number;
    language: PluginLanguage;
    enabled: boolean;
    autoPreload: boolean; // pre-load game data for installed games in the background
    spotlightHome: boolean; // replace Steam's Home screen with Native Home
    homeLayout: HomeLayout;
    minimalSide: MinimalSide;
    minimalShowDetails: boolean;
    gamePageLayout: GamePageLayout;
    customLibrary: boolean;
    libraryLayout: LibraryLayout;
    libraryGridColumns: number;
    libraryGridSize: LibraryGridSize;
    showPlaytime: boolean;
    showHltb: boolean;
    wishlistDeals: boolean; // look up wishlist sales on Steam's public store
    cleanPage: boolean; // legacy compatibility flag synced with gamePageLayout
    homeStatusBar: boolean; // Spotlight Home's status bar: clock, battery and connection in Steam's top strip
    hideStatusBarBackground: boolean; // hide the glass background behind the custom status bar
    customMenus: boolean; // restyle Steam main menu, Quick Access Menu, and context menus
    statusAvatar: boolean; // your avatar, round and ringed in your status colour, in the status bar instead of the dot
    hideGameCover: boolean; // hide the game's cover art on the game page
    heroPosition: HeroPosition; // hero background alignment across Home, Library, and Game Page
    gameLogo: boolean; // the game's logo instead of its name on Home and the game page (the name when it has none)
    showNewLabel: boolean; // show the 'New' marker for games new to the library
    showLastPlayedLabel: boolean; // show the 'Last played' eyebrow on Home and the game page
    homeRow: string; // Home's games row: 'recent' (Steam's recent games, with those new to the library) or a collection id
    homeRowSort: RowSort; // how a collection's games are sorted in the row
    homeRowStyle: RowStyle; // how the row moves: 'steam' (Steam's Home: the first game wide) or 'spotlight' (the selected game wide, at the left)
    screensaver: ScreensaverOptions; // Steam's screensaver drawn by Native Home (screensaver/options)
}

const KEY = 'native_home_settings';
export const CURRENT_SETTINGS_VERSION = 2;
const DEFAULTS: Settings = {
    settingsVersion: CURRENT_SETTINGS_VERSION,
    language: 'en',
    enabled: true,
    autoPreload: true,
    spotlightHome: true,
    homeLayout: 'minimal',
    minimalSide: 'left',
    minimalShowDetails: false,
    gamePageLayout: 'auto',
    customLibrary: true,
    libraryLayout: 'auto',
    libraryGridColumns: 6,
    libraryGridSize: 'standard',
    showPlaytime: true,
    showHltb: true,
    wishlistDeals: false,
    cleanPage: false,
    homeStatusBar: false,
    hideStatusBarBackground: true,
    customMenus: true,
    statusAvatar: false,
    hideGameCover: false,
    heroPosition: 'center',
    gameLogo: true,
    showNewLabel: true,
    showLastPlayedLabel: true,
    homeRow: RECENT_ROW,
    homeRowSort: 'lastPlayed',
    homeRowStyle: 'steam',
    screensaver: SCREENSAVER_DEFAULTS,
};

function heroPositionOf(value: unknown): HeroPosition {
    return value === 'center' || value === 'left' || value === 'right' || value === 'top' || value === 'bottom'
        ? value
        : DEFAULTS.heroPosition;
}

function gamePageLayoutOf(value: unknown, cleanPage: unknown): GamePageLayout {
    if (value === 'auto' || value === 'full' || value === 'minimal') return value;
    return cleanPage === true ? 'minimal' : DEFAULTS.gamePageLayout;
}

function libraryLayoutOf(value: unknown): LibraryLayout {
    return value === 'auto' || value === 'grid' || value === 'minimal' ? value : DEFAULTS.libraryLayout;
}

function libraryGridColumnsOf(value: unknown): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 4 && value <= 7 ? value : DEFAULTS.libraryGridColumns;
}

function libraryGridSizeOf(value: unknown): LibraryGridSize {
    return value === 'compact' || value === 'standard' || value === 'large' ? value : DEFAULTS.libraryGridSize;
}

export function createSettingsStore(kv: KvBackend) {
    let current: Settings = { ...DEFAULTS };
    let saveChain: Promise<void> | null = null;
    const listeners = new Set<() => void>();
    const emit = () => listeners.forEach((listener) => listener());
    const persist = (snapshot: Settings): Promise<void> => {
        const run = () => kv.set(KEY, snapshot);
        const next = saveChain ? saveChain.catch(() => undefined).then(run) : run();
        const tracked = next.finally(() => {
            if (saveChain === tracked) saveChain = null;
        });
        saveChain = tracked;
        return next;
    };
    const update = (patch: Partial<Settings>): Promise<void> => {
        current = { ...current, ...patch };
        emit();
        return persist(current);
    };
    return {
        async load(): Promise<void> {
            const raw = (await kv.get(KEY)) as Partial<Settings> | null;
            const pick = <K extends keyof Settings>(key: K): Settings[K] =>
                typeof raw?.[key] === 'boolean' ? (raw[key] as Settings[K]) : DEFAULTS[key];
            const isLegacy = raw !== null && (typeof raw.settingsVersion !== 'number' || raw.settingsVersion < CURRENT_SETTINGS_VERSION);
            const homeLayout: HomeLayout = isLegacy
                ? DEFAULTS.homeLayout
                : raw?.homeLayout === 'carousel' || raw?.homeLayout === 'minimal'
                    ? raw.homeLayout
                    : DEFAULTS.homeLayout;
            const minimalShowDetails = isLegacy ? DEFAULTS.minimalShowDetails : pick('minimalShowDetails');
            const gamePageLayout = gamePageLayoutOf(raw?.gamePageLayout, raw?.cleanPage);
            current = {
                settingsVersion: CURRENT_SETTINGS_VERSION,
                language: raw?.language === 'ru' ? 'ru' : 'en',
                enabled: pick('enabled'),
                autoPreload: pick('autoPreload'),
                spotlightHome: pick('spotlightHome'),
                homeLayout,
                minimalSide: raw?.minimalSide === 'right' ? 'right' : 'left',
                minimalShowDetails,
                gamePageLayout,
                customLibrary: pick('customLibrary'),
                libraryLayout: libraryLayoutOf(raw?.libraryLayout),
                libraryGridColumns: libraryGridColumnsOf(raw?.libraryGridColumns),
                libraryGridSize: libraryGridSizeOf(raw?.libraryGridSize),
                showPlaytime: pick('showPlaytime'),
                showHltb: pick('showHltb'),
                wishlistDeals: false,
                cleanPage: gamePageLayout === 'minimal',
                homeStatusBar: false,
                hideStatusBarBackground: raw?.hideStatusBarBackground !== false,
                customMenus: raw?.customMenus !== false,
                statusAvatar: false,
                hideGameCover: pick('hideGameCover'),
                heroPosition: heroPositionOf(raw?.heroPosition),
                gameLogo: pick('gameLogo'),
                showNewLabel: pick('showNewLabel'),
                showLastPlayedLabel: pick('showLastPlayedLabel'),
                homeRow: typeof raw?.homeRow === 'string' && raw.homeRow !== '' ? raw.homeRow : DEFAULTS.homeRow,
                homeRowSort: rowSortOf(raw?.homeRowSort),
                homeRowStyle: rowStyleOf(raw?.homeRowStyle),
                screensaver: readScreensaverOptions(raw?.screensaver),
            };
            emit();
            if (isLegacy) void persist(current).catch(() => undefined);
        },
        get: (): Settings => current,
        setLanguage: (language: PluginLanguage): Promise<void> => update({ language }),
        setMinimalShowDetails: (minimalShowDetails: boolean): Promise<void> => update({ minimalShowDetails }),
        setHomeLayout: (homeLayout: HomeLayout): Promise<void> => update({ homeLayout }),
        setMinimalSide: (minimalSide: MinimalSide): Promise<void> => update({ minimalSide }),
        setGamePageLayout: (gamePageLayout: GamePageLayout): Promise<void> =>
            update({ gamePageLayout, cleanPage: gamePageLayout === 'minimal' }),
        setCustomLibrary: (customLibrary: boolean): Promise<void> => update({ customLibrary }),
        setLibraryLayout: (libraryLayout: LibraryLayout): Promise<void> => update({ libraryLayout }),
        setLibraryGridColumns: (libraryGridColumns: number): Promise<void> =>
            update({ libraryGridColumns: libraryGridColumnsOf(libraryGridColumns) }),
        setLibraryGridSize: (libraryGridSize: LibraryGridSize): Promise<void> =>
            update({ libraryGridSize: libraryGridSizeOf(libraryGridSize) }),
        setShowPlaytime: (showPlaytime: boolean): Promise<void> => update({ showPlaytime }),
        setShowHltb: (showHltb: boolean): Promise<void> => update({ showHltb }),
        setEnabled: (enabled: boolean): Promise<void> => update({ enabled }),
        setStatusAvatar: (statusAvatar: boolean): Promise<void> => update({ statusAvatar }),
        setHideStatusBarBackground: (hideStatusBarBackground: boolean): Promise<void> => update({ hideStatusBarBackground }),
        setCustomMenus: (customMenus: boolean): Promise<void> => update({ customMenus }),
        setHideGameCover: (hideGameCover: boolean): Promise<void> => update({ hideGameCover }),
        setHeroPosition: (heroPosition: HeroPosition): Promise<void> =>
            update({ heroPosition: heroPositionOf(heroPosition) }),
        setAutoPreload: (autoPreload: boolean): Promise<void> => update({ autoPreload }),
        setSpotlightHome: (spotlightHome: boolean): Promise<void> => update({ spotlightHome }),
        setWishlistDeals: (wishlistDeals: boolean): Promise<void> => update({ wishlistDeals }),
        setHomeRow: (homeRow: string): Promise<void> => update({ homeRow }),
        setHomeRowSort: (homeRowSort: RowSort): Promise<void> => update({ homeRowSort }),
        setHomeRowStyle: (homeRowStyle: RowStyle): Promise<void> => update({ homeRowStyle }),
        setCleanPage: (cleanPage: boolean): Promise<void> =>
            update({ cleanPage, gamePageLayout: cleanPage ? 'minimal' : 'full' }),
        setHomeStatusBar: (homeStatusBar: boolean): Promise<void> => update({ homeStatusBar }),
        setGameLogo: (gameLogo: boolean): Promise<void> => update({ gameLogo }),
        setShowNewLabel: (showNewLabel: boolean): Promise<void> => update({ showNewLabel }),
        setShowLastPlayedLabel: (showLastPlayedLabel: boolean): Promise<void> => update({ showLastPlayedLabel }),
        /** One or more screensaver options. */
        setScreensaver: (change: Partial<ScreensaverOptions>): Promise<void> =>
            update({ screensaver: { ...current.screensaver, ...change } }),
        subscribe(listener: () => void): () => void {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

export const settings = createSettingsStore(backendKv);

export function useSettings(): Settings {
    return useSyncExternalStore(settings.subscribe, settings.get);
}
