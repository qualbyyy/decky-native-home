import { DEMO_APP_TYPE, GAME_APP_TYPE, SHORTCUT_APP_TYPE } from '../data/installedGames';
import { homeCollections } from '../home/collections';
import { addedTime, isRowApp, RawApp } from '../home/recents';
import { isRussianSystem, tr } from '../i18n/steamText';
import type { PluginLanguage } from '../data/settings';

export type LibrarySort = 'lastPlayed' | 'name' | 'playtime' | 'added';
export type LibraryTabId = 'all' | 'installed' | 'favorites' | 'nonsteam' | string;

export const LIBRARY_SORTS: readonly LibrarySort[] = ['lastPlayed', 'name', 'playtime', 'added'];

export interface LibraryGame {
    appId: number;
    name: string;
    sortAs: string;
    installed: boolean;
    shortcut: boolean;
    demo: boolean;
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
}

type RawLibraryApp = RawApp & {
    installed?: boolean;
    m_gameid?: string;
    sort_as?: unknown;
};

type LibraryGlobals = {
    appStore?: { allApps?: RawLibraryApp[] };
    collectionStore?: {
        localGamesCollection?: { allApps?: Array<{ appid?: number }> };
        userCollections?: Array<{ id?: unknown; displayName?: unknown; allApps?: Array<{ appid?: number }> } | null | undefined>;
        BIsHidden?(appId: number): boolean;
    };
};

function toLibraryGame(app: RawLibraryApp, installedIds: Set<number>): LibraryGame {
    const sortAs = typeof app.sort_as === 'string' && app.sort_as.trim() !== '' ? app.sort_as : app.display_name;
    return {
        appId: app.appid,
        name: app.display_name,
        sortAs,
        installed: app.installed === true || installedIds.has(app.appid),
        shortcut: app.app_type === SHORTCUT_APP_TYPE,
        demo: app.app_type === DEMO_APP_TYPE,
        lastPlayed: Math.max(0, Number(app.rt_last_time_played) || 0),
        playedMinutes: Math.max(0, Number(app.minutes_playtime_forever) || 0),
        addedAt: addedTime(app),
        gameId: typeof app.m_gameid === 'string' ? app.m_gameid : undefined,
    };
}

export function readLibrarySnapshot(
    _language?: PluginLanguage,
    globals: LibraryGlobals = globalThis as unknown as LibraryGlobals,
): { games: LibraryGame[]; tabs: LibraryTab[] } {
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
        const games: LibraryGame[] = [];
        for (const app of rawAll) {
            if (!app || !Number.isInteger(app.appid) || seen.has(app.appid)) continue;
            if (!(app.app_type === GAME_APP_TYPE || app.app_type === SHORTCUT_APP_TYPE || app.app_type === DEMO_APP_TYPE || isRowApp(app))) continue;
            if (typeof app.display_name !== 'string' || app.display_name === '' || isHidden(app.appid)) continue;
            seen.add(app.appid);
            games.push(toLibraryGame(app, installedIds));
        }

        const visibleIds = new Set(games.map((g) => g.appId));
        const installedCount = games.filter((g) => g.installed).length;
        const nonSteamCount = games.filter((g) => g.shortcut).length;
        const userCols = store?.userCollections ?? [];
        const favoriteCol = userCols.find((c) => c?.id === 'favorite');
        const favoriteIds = new Set(
            (favoriteCol?.allApps ?? [])
                .map((a) => a?.appid)
                .filter((id): id is number => typeof id === 'number' && visibleIds.has(id)),
        );

        const tabs: LibraryTab[] = [
            { id: 'all', label: tr('myGames'), count: games.length },
            { id: 'installed', label: tr('installed'), count: installedCount },
        ];
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

        return { games, tabs };
    } catch {
        return { games: [], tabs: [{ id: 'all', label: tr('myGames'), count: 0 }] };
    }
}

export function filterAndSortLibraryGames(
    games: LibraryGame[],
    tab: LibraryTab | undefined,
    installedOnly: boolean,
    sort: LibrarySort,
): LibraryGame[] {
    const tabId = tab?.id ?? 'all';
    const filtered = games.filter((g) => {
        if (installedOnly && !g.installed) return false;
        if (tabId === 'installed') return g.installed;
        if (tabId === 'nonsteam') return g.shortcut;
        if (tabId === 'favorites' || tabId.startsWith('col:')) return tab?.appIds ? tab.appIds.has(g.appId) : false;
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
