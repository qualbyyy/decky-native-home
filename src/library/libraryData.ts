import { DEMO_APP_TYPE, GAME_APP_TYPE, SHORTCUT_APP_TYPE } from '../data/installedGames';
import type { CustomLibraryTab, PluginLanguage } from '../data/settings';
import { homeCollections } from '../home/collections';
import { addedTime, isRowApp, RawApp } from '../home/recents';
import { isRussianSystem, tr } from '../i18n/steamText';
import { evaluateTabMasterTabs, type TabMasterApp, type TabMasterConfig, type TabMasterGlobals } from './tabMaster';

export type LibrarySort = 'lastPlayed' | 'name' | 'playtime' | 'added';
export type LibraryTabId = 'all' | 'installed' | 'favorites' | 'nonsteam' | 'hidden' | string;

export const LIBRARY_SORTS: readonly LibrarySort[] = ['lastPlayed', 'name', 'playtime', 'added'];

export interface LibraryGame {
    appId: number;
    name: string;
    sortAs: string;
    installed: boolean;
    shortcut: boolean;
    demo: boolean;
    hidden?: boolean;
    deckCompat?: number;
    lastPlayed: number;
    playedMinutes: number;
    addedAt: number;
    gameId?: string;
}

export interface LibraryTab {
    id: LibraryTabId;
    label: string;
    count: number;
    appIds?: Set<number>;
    includeHidden?: boolean;
    defaultSort?: LibrarySort;
}

export interface LibrarySnapshotOptions {
    tabMasterConfig?: TabMasterConfig | null;
    useTabMaster?: boolean;
    showHiddenTab?: boolean;
    customTabs?: CustomLibraryTab[];
}

type RawLibraryApp = RawApp & TabMasterApp & {
    sort_as?: unknown;
    m_gameid?: string;
};

type LibraryGlobals = TabMasterGlobals & {
    appStore?: { allApps?: RawLibraryApp[] };
    collectionStore?: {
        localGamesCollection?: { allApps?: Array<{ appid?: number }> };
        userCollections?: Array<{ id?: unknown; displayName?: unknown; allApps?: Array<{ appid?: number }> } | null | undefined>;
        BIsHidden?(appId: number): boolean;
    };
};

function toLibraryGame(app: RawLibraryApp, installedIds: Set<number>, hidden = false): LibraryGame {
    const sortAs = typeof app.sort_as === 'string' && app.sort_as.trim() !== '' ? app.sort_as : app.display_name;
    return {
        appId: app.appid,
        name: app.display_name,
        sortAs,
        installed: app.installed === true || installedIds.has(app.appid),
        shortcut: app.app_type === SHORTCUT_APP_TYPE,
        demo: app.app_type === DEMO_APP_TYPE,
        hidden,
        deckCompat: typeof app.steam_deck_compat_category === 'number' ? app.steam_deck_compat_category : undefined,
        lastPlayed: Math.max(0, Number(app.rt_last_time_played) || 0),
        playedMinutes: Math.max(0, Number(app.minutes_playtime_forever) || 0),
        addedAt: addedTime(app),
        gameId: typeof app.m_gameid === 'string' ? app.m_gameid : undefined,
    };
}

function hiddenTabLabel(): string {
    return isRussianSystem() ? 'Скрытые' : 'Hidden';
}

function evaluateCustomTab(
    tab: CustomLibraryTab,
    visibleGames: LibraryGame[],
    hiddenGames: LibraryGame[],
    userCols: NonNullable<NonNullable<LibraryGlobals['collectionStore']>['userCollections']>,
): LibraryTab {
    const hiddenMode = tab.hiddenMode ?? 'exclude';
    const pool = hiddenMode === 'only'
        ? hiddenGames
        : hiddenMode === 'include'
            ? [...visibleGames, ...hiddenGames]
            : visibleGames;
    let colIds: Set<number> | null = null;
    if (tab.collectionId) {
        const col = userCols.find((c) => c?.id === tab.collectionId);
        colIds = new Set(
            (col?.allApps ?? [])
                .map((a) => a?.appid)
                .filter((id): id is number => typeof id === 'number' && Number.isInteger(id)),
        );
    }

    const matched = pool.filter((g) => {
        const checks: boolean[] = [];
        if (tab.installed === 'installed') checks.push(g.installed);
        else if (tab.installed === 'uninstalled') checks.push(!g.installed);
        if (tab.platform === 'steam') checks.push(!g.shortcut);
        else if (tab.platform === 'nonsteam') checks.push(g.shortcut);
        if (tab.deckCompat === 'verified') checks.push(g.deckCompat === 3);
        else if (tab.deckCompat === 'playable') checks.push(g.deckCompat === 2 || g.deckCompat === 3);
        if (tab.unplayedOnly) checks.push(g.playedMinutes === 0);
        if (colIds) checks.push(colIds.has(g.appId));
        if (checks.length === 0) return true;
        return tab.mode === 'any' ? checks.some(Boolean) : checks.every(Boolean);
    });

    return {
        id: `custom:${tab.id}`,
        label: tab.title,
        count: matched.length,
        appIds: new Set(matched.map((g) => g.appId)),
        includeHidden: hiddenMode !== 'exclude',
    };
}

export function readLibrarySnapshot(
    _language?: PluginLanguage,
    globals: LibraryGlobals = globalThis as unknown as LibraryGlobals,
    options: LibrarySnapshotOptions = {},
): { games: LibraryGame[]; allGames: LibraryGame[]; tabs: LibraryTab[] } {
    try {
        const store = globals.collectionStore;
        const isHidden = (appId: number) => {
            try {
                return store?.BIsHidden?.(appId) === true;
            } catch {
                return false;
            }
        };
        const installedIds = new Set<number>(
            (store?.localGamesCollection?.allApps ?? [])
                .map((a) => a?.appid)
                .filter((id): id is number => typeof id === 'number' && Number.isInteger(id)),
        );
        const rawAll = globals.appStore?.allApps ?? [];
        const seen = new Set<number>();
        const visibleGames: LibraryGame[] = [];
        const hiddenGames: LibraryGame[] = [];
        const appIndex = new Map<number, LibraryGame>();

        for (const app of rawAll) {
            if (!app || !Number.isInteger(app.appid) || seen.has(app.appid)) continue;
            if (!(app.app_type === GAME_APP_TYPE || app.app_type === SHORTCUT_APP_TYPE || app.app_type === DEMO_APP_TYPE || isRowApp(app))) continue;
            if (typeof app.display_name !== 'string' || app.display_name === '') continue;
            seen.add(app.appid);
            const hidden = isHidden(app.appid);
            const game = toLibraryGame(app, installedIds, hidden);
            appIndex.set(game.appId, game);
            if (hidden) hiddenGames.push(game);
            else visibleGames.push(game);
        }

        const userCols = store?.userCollections ?? [];
        const tabs: LibraryTab[] = [];
        const useTabMaster = options.useTabMaster !== false && Boolean(options.tabMasterConfig?.available);

        if (useTabMaster && options.tabMasterConfig) {
            const tm = evaluateTabMasterTabs(options.tabMasterConfig, rawAll, installedIds, isHidden, globals);
            for (const extra of tm.extraApps) {
                if (!appIndex.has(extra.appid) && typeof extra.display_name === 'string' && extra.display_name !== '') {
                    appIndex.set(extra.appid, toLibraryGame(extra, installedIds, isHidden(extra.appid)));
                }
            }
            tabs.push(...tm.tabs);
        }

        if (tabs.length === 0) {
            const visibleIds = new Set(visibleGames.map((g) => g.appId));
            const installedCount = visibleGames.filter((g) => g.installed).length;
            const nonSteamCount = visibleGames.filter((g) => g.shortcut).length;
            const favoriteCol = userCols.find((c) => c?.id === 'favorite');
            const favoriteIds = new Set(
                (favoriteCol?.allApps ?? [])
                    .map((a) => a?.appid)
                    .filter((id): id is number => typeof id === 'number' && visibleIds.has(id)),
            );

            tabs.push(
                { id: 'all', label: tr('myGames'), count: visibleGames.length },
                { id: 'installed', label: tr('installed'), count: installedCount },
            );
            if (favoriteIds.size > 0) {
                tabs.push({ id: 'favorites', label: tr('favorites'), count: favoriteIds.size, appIds: favoriteIds });
            }
            if (nonSteamCount > 0) {
                tabs.push({ id: 'nonsteam', label: tr('nonSteam'), count: nonSteamCount });
            }

            const offered = homeCollections(userCols).filter((c) => c.id !== 'favorite' && c.id !== 'local-install');
            for (const col of offered) {
                const rawCol = userCols.find((c) => c?.id === col.id);
                const appIds = new Set(
                    (rawCol?.allApps ?? [])
                        .map((a) => a?.appid)
                        .filter((id): id is number => typeof id === 'number' && visibleIds.has(id)),
                );
                if (appIds.size > 0) tabs.push({ id: `col:${col.id}`, label: col.name, count: appIds.size, appIds });
            }
        }

        for (const custom of options.customTabs ?? []) {
            if (!custom.enabled) continue;
            tabs.push(evaluateCustomTab(custom, visibleGames, hiddenGames, userCols));
        }

        if (options.showHiddenTab) {
            tabs.push({
                id: 'hidden',
                label: hiddenTabLabel(),
                count: hiddenGames.length,
                includeHidden: true,
            });
        }

        return { games: visibleGames, allGames: [...appIndex.values()], tabs };
    } catch {
        const emptyTabs: LibraryTab[] = [{ id: 'all', label: tr('myGames'), count: 0 }];
        return { games: [], allGames: [], tabs: emptyTabs };
    }
}

export function filterAndSortLibraryGames(
    games: LibraryGame[],
    tab: LibraryTab | undefined,
    installedOnly: boolean,
    sort: LibrarySort,
): LibraryGame[] {
    const tabId = tab?.id ?? 'all';
    const allowHidden = tab?.includeHidden === true || tabId === 'hidden';
    const filtered = games.filter((g) => {
        if (!allowHidden && g.hidden) return false;
        if (installedOnly && !g.installed) return false;
        if (tabId === 'hidden') return g.hidden === true;
        if (tabId === 'installed') return g.installed;
        if (tabId === 'nonsteam') return g.shortcut;
        if (tabId === 'favorites' || tabId.startsWith('col:') || tabId.startsWith('tm:') || tabId.startsWith('custom:')) {
            return tab?.appIds ? tab.appIds.has(g.appId) : false;
        }
        return true;
    });
    return [...filtered].sort((a, b) => {
        if (sort === 'lastPlayed') {
            return b.lastPlayed - a.lastPlayed || b.playedMinutes - a.playedMinutes || a.sortAs.localeCompare(b.sortAs);
        }
        if (sort === 'playtime') {
            return b.playedMinutes - a.playedMinutes || b.lastPlayed - a.lastPlayed || a.sortAs.localeCompare(b.sortAs);
        }
        if (sort === 'added') {
            return b.addedAt - a.addedAt || b.lastPlayed - a.lastPlayed || a.sortAs.localeCompare(b.sortAs);
        }
        return a.sortAs.localeCompare(b.sortAs);
    });
}

export function nextLibrarySort(current: LibrarySort): LibrarySort {
    const idx = LIBRARY_SORTS.indexOf(current);
    return LIBRARY_SORTS[(idx + 1) % LIBRARY_SORTS.length];
}

export function librarySortLabel(sort: LibrarySort, _language?: PluginLanguage): string {
    if (sort === 'lastPlayed') return tr('sortLastPlayed');
    if (sort === 'name') return tr('sortName');
    if (sort === 'added') return tr('sortAdded');
    return tr('sortPlaytime');
}

export function librarySortShortLabel(sort: LibrarySort): string {
    const ru = isRussianSystem();
    if (sort === 'name') return ru ? 'А–Я' : 'A–Z';
    if (sort === 'lastPlayed') return ru ? 'Недавние' : 'Recent';
    if (sort === 'added') return ru ? 'Новые' : 'Added';
    return ru ? 'Время' : 'Time';
}
