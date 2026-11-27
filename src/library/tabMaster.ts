import { callable } from '@decky/api';
import { DEMO_APP_TYPE, GAME_APP_TYPE, SHORTCUT_APP_TYPE } from '../data/installedGames';
import { tr } from '../i18n/steamText';
import type { RawApp } from '../home/recents';
import type { LibrarySort, LibraryTab } from './libraryData';

export interface TabMasterFilter {
    type: string;
    inverted?: boolean;
    params?: Record<string, unknown>;
}

export interface TabMasterTabConfig {
    id: string;
    title: string;
    position: number;
    filters?: TabMasterFilter[];
    filtersMode?: 'and' | 'or';
    categoriesToInclude?: number;
    autoHide?: boolean;
    sortByOverride?: number;
}

export interface TabMasterConfig {
    available: boolean;
    tabs: Record<string, TabMasterTabConfig>;
    tagOverrides?: Record<string, Record<string, boolean>>;
    friendsGames?: Record<string, number[]>;
}

export type TabMasterApp = RawApp & {
    installed?: boolean;
    steam_deck_compat_category?: number;
    steam_hw_compat_category_packed?: number;
    metacritic_score?: number;
    review_percentage?: number;
    size_on_disk?: number | string;
    rt_original_release_date?: number;
    rt_steam_release_date?: number;
    rt_purchased_time?: number;
    store_tag?: number[];
    store_category?: number[];
    display_status?: number;
    per_client_data?: Array<{ client_name?: string; installed?: boolean }>;
};

export interface TabMasterGlobals {
    collectionStore?: {
        userCollections?: Array<{ id?: unknown; displayName?: unknown; allApps?: Array<{ appid?: number }> } | null | undefined>;
        sharedLibrariesCollections?: Array<{ allApps?: Array<{ appid?: number }> } | null | undefined>;
        appTypeCollectionMap?: { get?(key: string): { allApps?: TabMasterApp[]; visibleApps?: TabMasterApp[] } | undefined };
        GetCollection?(id: string): { allApps?: Array<{ appid?: number }>; visibleApps?: Array<{ appid?: number }> } | undefined;
        BIsHidden?(appId: number): boolean;
    };
    appAchievementProgressCache?: {
        GetAchievementProgress?(appId: number): number;
        m_achievementProgress?: { mapCache?: Map<number, { unlocked?: number }> };
    };
    installFolderStore?: {
        AllInstallFolders?: Array<{ strDriveName?: string; bIsMounted?: boolean; vecApps?: Array<{ nAppID?: number }> }>;
    };
    MicroSDeck?: {
        CurrentCardAndGames?: [unknown, Array<{ uid: string | number }>];
        CardsAndGames?: Array<[{ uid: string }, Array<{ uid: string | number }>]>;
    };
    App?: { m_CurrentUser?: { strSteamID?: string } };
}

export const CATEGORY_GAMES = 1;
export const CATEGORY_SOFTWARE = 2;
export const CATEGORY_HIDDEN = 16;
export const CATEGORY_MUSIC = 8192;

const getTabMasterConfig = callable<[userId: string], TabMasterConfig | null>('get_tabmaster_config');

export function currentSteamUserId(globals: TabMasterGlobals = globalThis as unknown as TabMasterGlobals): string {
    try {
        const steamId = globals.App?.m_CurrentUser?.strSteamID;
        if (!steamId) return '';
        return BigInt.asUintN(32, BigInt(steamId)).toString();
    } catch {
        return '';
    }
}

export async function fetchTabMasterConfig(): Promise<TabMasterConfig | null> {
    try {
        const userId = currentSteamUserId();
        const res = await getTabMasterConfig(userId);
        if (!res || res.available !== true || !res.tabs || typeof res.tabs !== 'object') return null;
        return res;
    } catch {
        return null;
    }
}

function defaultTabTitle(id: string, fallback: string): string {
    if (id === 'AllGames') return tr('myGames');
    if (id === 'Installed') return tr('installed');
    if (id === 'Favorites') return tr('favorites');
    if (id === 'DesktopApps') return tr('nonSteam');
    return fallback;
}

function mapSortOverride(eSortBy: unknown): LibrarySort | undefined {
    const n = Number(eSortBy);
    if (!Number.isFinite(n) || n < 0) return undefined;
    if (n === 1) return 'name';
    if (n === 2) return 'playtime';
    if (n === 4) return 'added';
    if (n === 5 || n === 10) return 'lastPlayed';
    return undefined;
}

function dateMatch(dateMs: number | null, params: Record<string, unknown>): boolean {
    if (!dateMs) return Boolean(params.isUnknown);
    const cond = params.condition === 'below' ? 'below' : 'above';
    const date = params.date as { year?: number; month?: number; day?: number } | undefined;
    if (date && typeof date.year === 'number') {
        const y = date.year;
        const m = date.month;
        const d = date.day;
        if (cond === 'above') return dateMs >= new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
        if (d !== undefined && m !== undefined) return dateMs < new Date(y, m - 1, d + 1).getTime();
        if (m !== undefined) return dateMs < new Date(y, m, 1).getTime();
        return dateMs < new Date(y + 1, 0, 1).getTime();
    }
    const daysAgo = Number(params.daysAgo);
    if (!Number.isFinite(daysAgo)) return false;
    const today = new Date();
    const target = cond === 'above'
        ? Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - daysAgo)
        : Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1 - daysAgo);
    return cond === 'above' ? dateMs >= target : dateMs < target;
}

function collectionAppIds(
    id: string,
    globals: TabMasterGlobals,
    cache: Map<string, Set<number>>,
): Set<number> {
    const hit = cache.get(id);
    if (hit) return hit;
    const col = globals.collectionStore?.GetCollection?.(id) ?? globals.collectionStore?.userCollections?.find((c) => c?.id === id);
    const ids = new Set<number>(
        (col?.allApps ?? [])
            .map((a) => a?.appid)
            .filter((n): n is number => typeof n === 'number' && Number.isInteger(n)),
    );
    cache.set(id, ids);
    return ids;
}

interface FilterContext {
    globals: TabMasterGlobals;
    tagOverrides: Record<string, Record<string, boolean>>;
    friendsGames: Map<number, number[]>;
    collectionCache: Map<string, Set<number>>;
    sharedIds: Set<number>;
}

function runFilter(filter: TabMasterFilter, app: TabMasterApp, ctx: FilterContext): boolean {
    const p = (filter.params ?? {}) as Record<string, unknown>;
    let ok = false;
    switch (filter.type) {
        case 'collection': {
            const cid = String(p.id ?? p.collection ?? '');
            ok = cid !== '' && collectionAppIds(cid, ctx.globals, ctx.collectionCache).has(app.appid);
            break;
        }
        case 'installed':
            ok = Boolean(p.installed) ? app.installed === true : app.installed !== true;
            break;
        case 'regex':
            try {
                ok = new RegExp(String(p.regex ?? '^$')).test(app.display_name ?? '');
            } catch {
                ok = false;
            }
            break;
        case 'friends': {
            const selected = Array.isArray(p.friends) ? p.friends.map(Number) : [];
            const owners = ctx.friendsGames.get(app.appid) ?? [];
            ok = p.mode === 'or'
                ? selected.some((f) => owners.includes(f))
                : selected.every((f) => owners.includes(f));
            break;
        }
        case 'tags': {
            const tags = Array.isArray(p.tags) ? p.tags.map(Number) : [];
            const appTags = Array.isArray(app.store_tag) ? app.store_tag : [];
            const ov = ctx.tagOverrides[String(app.appid)];
            const hasTag = (tag: number) => {
                const inc = appTags.includes(tag);
                if (ov && typeof ov[String(tag)] === 'boolean') return ov[String(tag)];
                return inc;
            };
            ok = p.mode === 'or' ? tags.some(hasTag) : tags.every(hasTag);
            break;
        }
        case 'whitelist':
            ok = Array.isArray(p.games) && p.games.includes(app.appid);
            break;
        case 'blacklist':
            ok = !Array.isArray(p.games) || !p.games.includes(app.appid);
            break;
        case 'merge': {
            const sub = Array.isArray(p.filters) ? (p.filters as TabMasterFilter[]) : [];
            ok = p.mode === 'or'
                ? sub.some((f) => runFilter(f, app, ctx))
                : sub.every((f) => runFilter(f, app, ctx));
            break;
        }
        case 'platform':
            ok = p.platform === 'nonSteam'
                ? app.app_type === SHORTCUT_APP_TYPE
                : app.app_type !== SHORTCUT_APP_TYPE && app.app_type !== 4 && app.app_type !== 2048;
            break;
        case 'deck compatibility':
            ok = app.steam_deck_compat_category === Number(p.category);
            break;
        case 'steamos compatibility':
            ok = (((app.steam_hw_compat_category_packed ?? 0) >> 4) & 3 || 0) === Number(p.category);
            break;
        case 'review score': {
            const score = p.type === 'steampercent' ? Number(app.review_percentage ?? 0) : Number(app.metacritic_score ?? 0);
            const thr = Number(p.scoreThreshold ?? 0);
            ok = p.condition === 'below' ? score <= thr : score >= thr;
            break;
        }
        case 'time played': {
            const thr = Number(p.timeThreshold ?? 0);
            const mins = p.units === 'hours' ? thr * 60 : p.units === 'days' ? thr * 1440 : thr;
            const played = Number(app.minutes_playtime_forever ?? 0);
            ok = p.condition === 'below' ? played <= mins : played >= mins;
            break;
        }
        case 'size on disk': {
            const gb = Number(app.size_on_disk ?? 0) / 1024 ** 3;
            const thr = Number(p.gbThreshold ?? 0);
            ok = p.condition === 'below' ? gb <= thr : gb >= thr;
            break;
        }
        case 'release date': {
            const ms = app.rt_original_release_date ? app.rt_original_release_date * 1000 : app.rt_steam_release_date ? app.rt_steam_release_date * 1000 : null;
            ok = dateMatch(ms, p);
            break;
        }
        case 'purchase date':
            ok = dateMatch(app.rt_purchased_time ? app.rt_purchased_time * 1000 : null, p);
            break;
        case 'last played':
            ok = app.rt_last_time_played ? dateMatch(app.rt_last_time_played * 1000, p) : false;
            break;
        case 'family sharing':
            ok = Boolean(p.isFamilyShared) ? ctx.sharedIds.has(app.appid) : !ctx.sharedIds.has(app.appid);
            break;
        case 'demo':
            ok = Boolean(p.isDemo) ? app.app_type === DEMO_APP_TYPE : app.app_type !== DEMO_APP_TYPE;
            break;
        case 'coming soon':
            ok = Boolean(p.isComingSoon) ? app.display_status === 13 : app.display_status !== 13;
            break;
        case 'streamable': {
            const streamable = (app.per_client_data ?? []).some(
                (c) => c?.client_name !== 'This machine' && Boolean(c?.client_name) && c?.installed === true,
            );
            ok = Boolean(p.isStreamable) ? streamable : !streamable;
            break;
        }
        case 'steam features': {
            const features = Array.isArray(p.features) ? p.features.map(Number) : [];
            const cats = Array.isArray(app.store_category) ? app.store_category : [];
            ok = p.mode === 'or' ? features.some((f) => cats.includes(f)) : features.every((f) => cats.includes(f));
            break;
        }
        case 'achievements': {
            const cache = ctx.globals.appAchievementProgressCache;
            const thr = Number(p.threshold ?? 0);
            if (p.thresholdType === 'count') {
                const unlocked = cache?.m_achievementProgress?.mapCache?.get(app.appid)?.unlocked;
                if (unlocked === undefined) ok = false;
                else ok = p.condition === 'below' ? unlocked <= thr : unlocked >= thr;
            } else {
                const pct = cache?.GetAchievementProgress?.(app.appid) ?? 0;
                ok = p.condition === 'below' ? pct <= thr : pct >= thr;
            }
            break;
        }
        case 'sd card': {
            const ms = ctx.globals.MicroSDeck;
            const hasApp = (games: Array<{ uid: string | number }> | undefined) =>
                Boolean(games?.some((g) => Number(g.uid) === app.appid));
            if (p.card === 1) ok = Boolean(ms?.CardsAndGames?.some(([, g]) => hasApp(g)));
            else if (typeof p.card === 'string') ok = hasApp(ms?.CardsAndGames?.find(([c]) => c.uid === p.card)?.[1]);
            else ok = hasApp(ms?.CurrentCardAndGames?.[1]);
            break;
        }
        case 'install folder': {
            const folder = ctx.globals.installFolderStore?.AllInstallFolders?.find((f) => f.strDriveName === p.driveName);
            ok = Boolean(folder && folder.bIsMounted && folder.vecApps?.some((a) => a.nAppID === app.appid));
            break;
        }
        default:
            ok = true;
            break;
    }
    return filter.inverted ? !ok : ok;
}

function categoryPool(
    bitField: number,
    allApps: TabMasterApp[],
    installedIds: Set<number>,
    isHidden: (appId: number) => boolean,
    globals: TabMasterGlobals,
): TabMasterApp[] {
    const includeHidden = (bitField & CATEGORY_HIDDEN) !== 0;
    const includeGames = (bitField & CATEGORY_GAMES) !== 0;
    const includeSoftware = (bitField & CATEGORY_SOFTWARE) !== 0;
    const includeMusic = (bitField & CATEGORY_MUSIC) !== 0;

    const map = globals.collectionStore?.appTypeCollectionMap;
    if (typeof map?.get === 'function') {
        const keyMode = includeHidden ? 'allApps' : 'visibleApps';
        const seen = new Set<number>();
        const out: TabMasterApp[] = [];
        const addCat = (cat: string) => {
            const apps = map.get?.(cat)?.[keyMode] ?? [];
            for (const a of apps) {
                if (!a || !Number.isInteger(a.appid) || seen.has(a.appid)) continue;
                seen.add(a.appid);
                out.push(a.installed === true || installedIds.has(a.appid) ? { ...a, installed: true } : a);
            }
        };
        if (includeGames) addCat('type-games');
        if (includeSoftware) addCat('type-software');
        if (includeMusic) addCat('type-music');
        if (out.length > 0) return out;
    }

    const out: TabMasterApp[] = [];
    for (const app of allApps) {
        if (!includeHidden && isHidden(app.appid)) continue;
        const t = app.app_type;
        const matchGame = includeGames && (t === GAME_APP_TYPE || t === DEMO_APP_TYPE || t === SHORTCUT_APP_TYPE);
        const matchSoft = includeSoftware && t === 2;
        const matchMusic = includeMusic && t === 8192;
        if (matchGame || matchSoft || matchMusic) {
            out.push(app.installed === true || installedIds.has(app.appid) ? { ...app, installed: true } : app);
        }
    }
    return out;
}

export function evaluateTabMasterTabs(
    config: TabMasterConfig,
    rawAllApps: TabMasterApp[],
    installedIds: Set<number>,
    isHidden: (appId: number) => boolean,
    globals: TabMasterGlobals = globalThis as unknown as TabMasterGlobals,
): { tabs: LibraryTab[]; extraApps: TabMasterApp[] } {
    const rawTabs = Object.values(config.tabs ?? {})
        .filter((t) => t && typeof t === 'object' && typeof t.id === 'string' && typeof t.position === 'number' && t.position >= 0)
        .sort((a, b) => a.position - b.position);

    const friendsGames = new Map<number, number[]>();
    for (const [appKey, friends] of Object.entries(config.friendsGames ?? {})) {
        const id = Number(appKey);
        if (Number.isInteger(id) && Array.isArray(friends)) friendsGames.set(id, friends.map(Number));
    }

    const sharedIds = new Set<number>();
    for (const col of globals.collectionStore?.sharedLibrariesCollections ?? []) {
        for (const a of col?.allApps ?? []) {
            if (typeof a?.appid === 'number') sharedIds.add(a.appid);
        }
    }

    const ctx: FilterContext = {
        globals,
        tagOverrides: config.tagOverrides ?? {},
        friendsGames,
        collectionCache: new Map(),
        sharedIds,
    };

    const visibleGames = rawAllApps.filter(
        (a) => a && Number.isInteger(a.appid) && !isHidden(a.appid)
            && (a.app_type === GAME_APP_TYPE || a.app_type === DEMO_APP_TYPE || a.app_type === SHORTCUT_APP_TYPE),
    );
    const extraMap = new Map<number, TabMasterApp>();
    const tabs: LibraryTab[] = [];

    for (const tab of rawTabs) {
        if (Array.isArray(tab.filters)) {
            const bitField = typeof tab.categoriesToInclude === 'number' ? tab.categoriesToInclude : CATEGORY_GAMES;
            const pool = categoryPool(bitField, rawAllApps, installedIds, isHidden, globals);
            const matched = pool.filter((app) => {
                if (tab.filters!.length === 0) return true;
                return tab.filtersMode === 'or'
                    ? tab.filters!.some((f) => runFilter(f, app, ctx))
                    : tab.filters!.every((f) => runFilter(f, app, ctx));
            });
            if (tab.autoHide && matched.length === 0) continue;
            const ids = new Set<number>();
            for (const app of matched) {
                ids.add(app.appid);
                if (!extraMap.has(app.appid)) extraMap.set(app.appid, app);
            }
            tabs.push({
                id: `tm:${tab.id}`,
                label: tab.title || tab.id,
                count: ids.size,
                appIds: ids,
                includeHidden: (bitField & CATEGORY_HIDDEN) !== 0,
                defaultSort: mapSortOverride(tab.sortByOverride),
            });
            continue;
        }

        // Steam default tabs managed by TabMaster
        if (tab.id === 'Collections') continue;
        let ids: Set<number> | null = null;
        if (tab.id === 'AllGames') {
            ids = new Set(visibleGames.map((g) => g.appid));
        } else if (tab.id === 'Installed') {
            ids = new Set(visibleGames.filter((g) => g.installed === true || installedIds.has(g.appid)).map((g) => g.appid));
        } else if (tab.id === 'Favorites') {
            const favs = collectionAppIds('favorite', globals, ctx.collectionCache);
            ids = new Set(visibleGames.filter((g) => favs.has(g.appid)).map((g) => g.appid));
        } else if (tab.id === 'DesktopApps') {
            ids = new Set(visibleGames.filter((g) => g.app_type === SHORTCUT_APP_TYPE).map((g) => g.appid));
        } else if (tab.id === 'GreatOnDeck' || tab.id === 'DeckGames') {
            ids = new Set(visibleGames.filter((g) => g.steam_deck_compat_category === 3).map((g) => g.appid));
        } else if (tab.id === 'GreatOnMachine' || tab.id === 'SteamOSCompatible') {
            ids = new Set(visibleGames.filter((g) => (((g.steam_hw_compat_category_packed ?? 0) >> 4) & 3) === 2).map((g) => g.appid));
        } else if (tab.id === 'Soundtracks') {
            const music = rawAllApps.filter((a) => a && a.app_type === 8192 && !isHidden(a.appid));
            for (const m of music) extraMap.set(m.appid, m);
            ids = new Set(music.map((m) => m.appid));
        }
        if (!ids) continue;
        if (ids.size === 0 && tab.id !== 'AllGames' && tab.id !== 'Installed') continue;
        tabs.push({
            id: `tm:${tab.id}`,
            label: defaultTabTitle(tab.id, tab.title || tab.id),
            count: ids.size,
            appIds: ids,
        });
    }

    return { tabs, extraApps: [...extraMap.values()] };
}
