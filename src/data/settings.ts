import { useSyncExternalStore } from 'react';
import { RECENT_ROW, RowSort, rowSortOf } from '../home/collections';
import { RowStyle, rowStyleOf } from '../home/recentsLayout';
import { backendKv, KvBackend } from './kv';
import { readScreensaverOptions, SCREENSAVER_DEFAULTS, ScreensaverOptions } from '../screensaver/options';

export type HomeLayout = 'carousel' | 'minimal';
export type MinimalSide = 'left' | 'right';
export type PluginLanguage = 'en' | 'ru';

export interface Settings {
    language: PluginLanguage;
    enabled: boolean;
    autoPreload: boolean; // pre-load game data for installed games in the background
    spotlightHome: boolean; // replace Steam's Home screen with Native Home
    homeLayout: HomeLayout;
    minimalSide: MinimalSide;
    minimalShowDetails: boolean;
    showPlaytime: boolean;
    showHltb: boolean;
    wishlistDeals: boolean; // look up wishlist sales on Steam's public store
    cleanPage: boolean; // the Native Home page's Clean look: one row at the bottom, no description or HowLongToBeat cards
    homeStatusBar: boolean; // Spotlight Home's status bar: clock, battery and connection in Steam's top strip
    hideStatusBarBackground: boolean; // hide the glass background behind the custom status bar
    statusAvatar: boolean; // your avatar, round and ringed in your status colour, in the status bar instead of the dot
    hideGameCover: boolean; // hide the game's cover art on the game page
    gameLogo: boolean; // the game's logo instead of its name on Home and the game page (the name when it has none)
    showNewLabel: boolean; // show the 'New' marker for games new to the library
    showLastPlayedLabel: boolean; // show the 'Last played' eyebrow on Home and the game page
    homeRow: string; // Home's games row: 'recent' (Steam's recent games, with those new to the library) or a collection id
    homeRowSort: RowSort; // how a collection's games are sorted in the row
    homeRowStyle: RowStyle; // how the row moves: 'steam' (Steam's Home: the first game wide) or 'spotlight' (the selected game wide, at the left)
    screensaver: ScreensaverOptions; // Steam's screensaver drawn by Native Home (screensaver/options)
}

const KEY = 'native_home_settings';
const DEFAULTS: Settings = { language: 'en', enabled: true, autoPreload: true, spotlightHome: true, homeLayout: 'carousel', minimalSide: 'left', minimalShowDetails: true, showPlaytime: true, showHltb: true, wishlistDeals: false, cleanPage: false, homeStatusBar: false, hideStatusBarBackground: true, statusAvatar: false, hideGameCover: false, gameLogo: true, showNewLabel: true, showLastPlayedLabel: true, homeRow: RECENT_ROW, homeRowSort: 'lastPlayed', homeRowStyle: 'steam', screensaver: SCREENSAVER_DEFAULTS };

export function createSettingsStore(kv: KvBackend) {
    let current: Settings = { ...DEFAULTS };
    const listeners = new Set<() => void>();
    const emit = () => listeners.forEach((listener) => listener());
    return {
        async load(): Promise<void> {
            const raw = (await kv.get(KEY)) as Partial<Settings> | null;
            const pick = <K extends keyof Settings>(key: K): Settings[K] =>
                typeof raw?.[key] === 'boolean' ? (raw[key] as Settings[K]) : DEFAULTS[key];
            current = {
                language: raw?.language === 'ru' ? 'ru' : 'en',
                enabled: pick('enabled'),
                autoPreload: pick('autoPreload'),
                spotlightHome: pick('spotlightHome'),
                homeLayout: raw?.homeLayout === 'minimal' ? 'minimal' : 'carousel',
                minimalSide: raw?.minimalSide === 'right' ? 'right' : 'left',
                minimalShowDetails: pick('minimalShowDetails'),
                showPlaytime: pick('showPlaytime'),
                showHltb: pick('showHltb'),
                wishlistDeals: false,
                cleanPage: pick('cleanPage'),
                homeStatusBar: false,
                hideStatusBarBackground: raw?.hideStatusBarBackground !== false,
                statusAvatar: false,
                hideGameCover: pick('hideGameCover'),
                gameLogo: pick('gameLogo'),
                showNewLabel: pick('showNewLabel'),
                showLastPlayedLabel: pick('showLastPlayedLabel'),
                homeRow: typeof raw?.homeRow === 'string' && raw.homeRow !== '' ? raw.homeRow : DEFAULTS.homeRow,
                homeRowSort: rowSortOf(raw?.homeRowSort),
                homeRowStyle: rowStyleOf(raw?.homeRowStyle),
                screensaver: readScreensaverOptions(raw?.screensaver),
            };
            emit();
        },
        get: (): Settings => current,
        async setLanguage(language: PluginLanguage): Promise<void> {
            current = { ...current, language };
            emit();
            await kv.set(KEY, current);
        },
        async setMinimalShowDetails(minimalShowDetails: boolean): Promise<void> {
            current = { ...current, minimalShowDetails };
            emit();
            await kv.set(KEY, current);
        },
        async setHomeLayout(homeLayout: HomeLayout): Promise<void> {
            current = { ...current, homeLayout };
            emit();
            await kv.set(KEY, current);
        },
        async setMinimalSide(minimalSide: MinimalSide): Promise<void> {
            current = { ...current, minimalSide };
            emit();
            await kv.set(KEY, current);
        },
        async setShowPlaytime(showPlaytime: boolean): Promise<void> {
            current = { ...current, showPlaytime };
            emit();
            await kv.set(KEY, current);
        },
        async setShowHltb(showHltb: boolean): Promise<void> {
            current = { ...current, showHltb };
            emit();
            await kv.set(KEY, current);
        },
        async setEnabled(enabled: boolean): Promise<void> {
            current = { ...current, enabled };
            emit();
            await kv.set(KEY, current);
        },
        async setStatusAvatar(statusAvatar: boolean): Promise<void> {
            current = { ...current, statusAvatar };
            emit();
            await kv.set(KEY, current);
        },
        async setHideStatusBarBackground(hideStatusBarBackground: boolean): Promise<void> {
            current = { ...current, hideStatusBarBackground };
            emit();
            await kv.set(KEY, current);
        },
        async setHideGameCover(hideGameCover: boolean): Promise<void> {
            current = { ...current, hideGameCover };
            emit();
            await kv.set(KEY, current);
        },
        async setAutoPreload(autoPreload: boolean): Promise<void> {
            current = { ...current, autoPreload };
            emit();
            await kv.set(KEY, current);
        },
        async setSpotlightHome(spotlightHome: boolean): Promise<void> {
            current = { ...current, spotlightHome };
            emit();
            await kv.set(KEY, current);
        },
        async setWishlistDeals(wishlistDeals: boolean): Promise<void> {
            current = { ...current, wishlistDeals };
            emit();
            await kv.set(KEY, current);
        },
        async setHomeRow(homeRow: string): Promise<void> {
            current = { ...current, homeRow };
            emit();
            await kv.set(KEY, current);
        },
        async setHomeRowSort(homeRowSort: RowSort): Promise<void> {
            current = { ...current, homeRowSort };
            emit();
            await kv.set(KEY, current);
        },
        async setHomeRowStyle(homeRowStyle: RowStyle): Promise<void> {
            current = { ...current, homeRowStyle };
            emit();
            await kv.set(KEY, current);
        },
        async setCleanPage(cleanPage: boolean): Promise<void> {
            current = { ...current, cleanPage };
            emit();
            await kv.set(KEY, current);
        },
        async setHomeStatusBar(homeStatusBar: boolean): Promise<void> {
            current = { ...current, homeStatusBar };
            emit();
            await kv.set(KEY, current);
        },
        async setGameLogo(gameLogo: boolean): Promise<void> {
            current = { ...current, gameLogo };
            emit();
            await kv.set(KEY, current);
        },
        async setShowNewLabel(showNewLabel: boolean): Promise<void> {
            current = { ...current, showNewLabel };
            emit();
            await kv.set(KEY, current);
        },
        async setShowLastPlayedLabel(showLastPlayedLabel: boolean): Promise<void> {
            current = { ...current, showLastPlayedLabel };
            emit();
            await kv.set(KEY, current);
        },
        /** One or more screensaver options. */
        async setScreensaver(change: Partial<ScreensaverOptions>): Promise<void> {
            current = { ...current, screensaver: { ...current.screensaver, ...change } };
            emit();
            await kv.set(KEY, current);
        },
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
