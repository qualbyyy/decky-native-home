import { parseHTML } from 'linkedom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@decky/api', () => ({ callable: () => async () => null }));

import type { KvBackend } from '../data/kv';
import { memoryKv as createMemoryKv } from '../data/kv';
import { createSettingsStore, CURRENT_SETTINGS_VERSION } from '../data/settings';
import { homeCss } from '../home/homeCss';
import { homeMode } from '../home/mode';
import { openVariant } from '../home/openHome';
import { findTopBar } from '../home/topBar';
import { libraryCss } from '../library/libraryCss';
import {
    filterAndSortLibraryGames,
    nextLibrarySort,
    readLibrarySnapshot,
} from '../library/libraryData';
import { libraryButtonAction, visibleRowRange } from '../library/libraryNav';
import { insertHero } from '../patches/insertHero';
import { createAfterPatchGuard } from '../patches/patchOnce';
import { buildArrivingCss, buildLaunchCss, buildThemeCss, buildUnifideckCss, SETTLE, ThemeClasses, twinTargets } from '../styles/themeCss';
import { buildContextMenuCss, buildFooterCss, buildMainMenuCss, buildMenuChromeCss, buildQuickAccessCss } from '../styles/menuCss';
import { createMenuChromeSync, MENU_CHROME_STYLE_ID, MENU_CHROME_WINDOW_ATTR } from '../styles/menuChromeSync';

function memoryKv(initial: unknown = null): KvBackend & { stored(): unknown } {
    const base = createMemoryKv();
    let val = initial;
    return {
        ...base,
        async get() {
            return val;
        },
        async set(_key, value) {
            val = value;
        },
        stored: () => val,
    };
}

describe('settings defaults and v1->v2 migration', () => {
    it('enables minimalist mode without action panel/logo and enables custom library by default', async () => {
        const store = createSettingsStore(memoryKv(null));
        expect(store.get().homeLayout).toBe('minimal');
        expect(store.get().minimalShowDetails).toBe(false);
        expect(store.get().customLibrary).toBe(true);
        expect(store.get().gamePageLayout).toBe('auto');
        expect(store.get().libraryLayout).toBe('auto');
        expect((store.get() as unknown as Record<string, unknown>).libraryGridColumns).toBe(6);
        expect((store.get() as unknown as Record<string, unknown>).libraryGridSize).toBe('standard');

        await store.load();
        expect(store.get().settingsVersion).toBe(CURRENT_SETTINGS_VERSION);
        expect(store.get().homeLayout).toBe('minimal');
        expect(store.get().minimalShowDetails).toBe(false);
    });

    it('migrates legacy v1 settings to minimalist defaults while keeping user preferences', async () => {
        const kv = memoryKv({
            language: 'ru',
            homeLayout: 'carousel',
            minimalShowDetails: true,
            minimalSide: 'right',
            cleanPage: true,
            hideGameCover: true,
        });
        const store = createSettingsStore(kv);
        await store.load();

        const loaded = store.get();
        expect(loaded.settingsVersion).toBe(CURRENT_SETTINGS_VERSION);
        expect(loaded.homeLayout).toBe('minimal');
        expect(loaded.minimalShowDetails).toBe(false);
        expect(loaded.language).toBe('ru');
        expect(loaded.minimalSide).toBe('right');
        expect(loaded.hideGameCover).toBe(true);
        expect(loaded.gamePageLayout).toBe('minimal');
        expect((kv.stored() as { settingsVersion?: number }).settingsVersion).toBe(CURRENT_SETTINGS_VERSION);
    });

    it('preserves explicit v2 user choices across reloads', async () => {
        const kv = memoryKv({
            settingsVersion: CURRENT_SETTINGS_VERSION,
            homeLayout: 'carousel',
            minimalShowDetails: true,
            customLibrary: false,
            gamePageLayout: 'full',
            libraryLayout: 'grid',
            libraryGridColumns: 4,
            libraryGridSize: 'compact',
        });
        const store = createSettingsStore(kv);
        await store.load();
        expect(store.get().homeLayout).toBe('carousel');
        expect(store.get().minimalShowDetails).toBe(true);
        expect(store.get().customLibrary).toBe(false);
        expect(store.get().gamePageLayout).toBe('full');
        expect(store.get().libraryLayout).toBe('grid');
        expect((store.get() as unknown as Record<string, unknown>).libraryGridColumns).toBe(4);
        expect((store.get() as unknown as Record<string, unknown>).libraryGridSize).toBe('compact');
    });
});

describe('homeMode resolution', () => {
    it('follows Home layout when set to auto and respects explicit overrides', async () => {
        const store = createSettingsStore(memoryKv(null));
        await store.load();

        expect(homeMode(store.get())).toMatchObject({
            home: true,
            library: true,
            minimalDetails: true,
            minimalLibrary: true,
        });

        await store.setHomeLayout('carousel');
        expect(homeMode(store.get())).toMatchObject({
            minimalDetails: false,
            minimalLibrary: false,
        });

        await store.setGamePageLayout('minimal');
        await store.setLibraryLayout('minimal');
        expect(homeMode(store.get())).toMatchObject({
            minimalDetails: true,
            minimalLibrary: true,
        });

        await store.setCustomLibrary(false);
        expect(homeMode(store.get()).library).toBe(false);
    });

    it('uses morph on sameGame full-hero open and heroFade for another game', () => {
        expect(openVariant({ sameGame: true, heroMode: 'full', pageRestyled: true })).toBe('morph');
        expect(openVariant({ sameGame: false, heroMode: 'full', pageRestyled: true })).toBe('heroFade');
    });
});

describe('Steam CSS class-change resilience', () => {
    it('inserts GameHero structurally even when Steam renames InnerContainer', () => {
        const overviewNode = { props: { children: { props: { overview: { appid: 10 } } } } };
        const headerNode = { props: { className: 'UnknownHeader' } };
        const tree = { props: { children: [headerNode, overviewNode] } };
        const find = (node: unknown, pred: (n: unknown) => boolean): unknown => (pred(node) ? node : null);
        const hero = { key: 'native-home-game' };

        const result = insertHero(tree, undefined, hero, find);
        expect(result).toBe('inserted');
        expect(tree.props.children[1]).toBe(hero);
    });

    it('finds Steam top bar via #header even when avatarHolder class is absent', () => {
        const { document } = parseHTML('<html><body><div id="header">Top</div></body></html>');
        const header = document.querySelector('#header')!;
        vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({
            top: 0,
            height: 40,
            width: 1280,
            left: 0,
            right: 1280,
            bottom: 40,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });
        expect(findTopBar(document as unknown as Document, 1280)).toBe(header);
    });
});

describe('GameView and Library stylesheets', () => {
    const sampleClasses: ThemeClasses = {
        header: { TopCapsule: 'TopCapsule', BoxSizer: 'BoxSizer', TitleImageContainer: 'TitleImg', SVGTitle: 'SvgTitle' },
        details: { InnerContainer: 'InnerContainer', AppDetailsOverviewPanel: 'OverviewPanel' },
        overview: { Backdrop: 'Backdrop' },
        root: {
            AppDetailsRoot: 'AppRoot',
            PlaySection: 'PlaySection',
            ActionRow: 'ActionRow',
            ActionButtonAndStatusPanel: 'PlayPanel',
            AppButtons: 'AppButtons',
            AppDetailsContainer: 'AppDetailsContainer',
        },
        play: { MenuButton: 'MenuButton', CloudStatusRow: 'CloudStatusRow', CloudStatusIcon: 'CloudStatusIcon' },
        transition: { TopLevelTransition: 'Trans', Enter: 'Enter', EnterActive: 'EnterActive' },
        feedback: {
            DeckVerifiedFeedbackContainer: 'FeedbackContainer',
            DeckVerifiedFeedbackDetailsCtn: 'FeedbackDetails',
            DeckVerifiedFeedbackConfirmationContainer: 'FeedbackConfirm',
        },
    };

    it('hides Steam Deck compatibility feedback only when GameView restyle is enabled', () => {
        const fullCss = buildThemeCss(sampleClasses, { restyle: true, minimal: false });
        const minCss = buildThemeCss(sampleClasses, { restyle: true, minimal: true });
        const plainCss = buildThemeCss(sampleClasses, { restyle: false, minimal: false });

        for (const css of [fullCss, minCss]) {
            expect(css).toContain('.FeedbackContainer');
            expect(css).toContain('.FeedbackDetails');
            expect(css).toContain('.FeedbackConfirm');
            expect(css).toContain('[class*="DeckVerifiedFeedbackContainer"]');
            expect(css).toContain('display: none !important;');
        }
        expect(fullCss).not.toContain('DeckVerifiedInfo');
        expect(fullCss).not.toContain('DeckVerifiedModalDialog');
        expect(plainCss).not.toContain('FeedbackContainer');
        expect(plainCss).not.toContain('DeckVerifiedFeedback');
    });

    it('generates distinct full and minimalist GameView CSS and avoids transform clobbering on arrival', () => {
        const fullCss = buildThemeCss(sampleClasses, { restyle: true, minimal: false });
        const minCss = buildThemeCss(sampleClasses, { restyle: true, minimal: true });
        expect(fullCss).toContain('.nh-gv-deck');
        expect(fullCss).toContain('border-radius: 0px !important');
        expect(fullCss).not.toContain('var(--gruvbox-radius');
        expect(minCss).toContain('.nh-gv-min-meta');
        expect(minCss).not.toBe(fullCss);

        const arrive = buildArrivingCss(sampleClasses, 'clean', 'all', false);
        expect(arrive).toContain('translate: 0 20px !important');
        expect(arrive).not.toContain('transform: translateY(14px)');
    });

    it('never puts !important on animated transform/opacity or BetterBlur selectors in libraryCss', () => {
        const css = libraryCss({ hideStatusBarBackground: true, cols: 5, cardW: 200, cardH: 300, gap: 14 });
        expect(css).toContain('#header::before');
        expect(css).not.toContain('N9sQLZ3HK0hCd9vbZif0o');
        expect(css).not.toContain('3rsrz7BYWjqGBhzcpn-Auo');
        expect(css).not.toMatch(/(?:^|[\s;{])(transform|opacity)\s*:[^;]*!important/);
    });

    it('keeps library covers compact, centered, and visibly outlined', () => {
        const css = libraryCss({ hideStatusBarBackground: true, cols: 6, cardW: 180, cardH: 252, gap: 12 });
        expect(css).toContain('grid-template-columns: repeat(6, 180px)');
        expect(css).toContain('justify-content: center !important;');
        expect(css).toContain('border: 2px solid');
        expect(css).toContain('0 0 0 3px');
        expect(css).not.toContain('nh-lib-card-dot');
        expect(css).not.toContain('nh-lib-min-dot');
        expect(css).not.toContain('scale(1.035)');
    });

    it('keeps every Unifideck primary state aligned and uses dark text', () => {
        const css = buildUnifideckCss(sampleClasses, { restyle: true, minimal: false });
        expect(css).toContain('align-items: flex-start !important;');
        expect(css).toContain('align-self: flex-start !important;');
        expect(css).toContain('display: flex !important; align-items: center !important;');
        expect(css).toContain('color: var(--ctp-crust, #0b0f14) !important;');
        expect(css).toContain('z-index: 5 !important;');
        expect(css).toContain('pointer-events: auto !important;');
        expect(css).toContain('white-space: nowrap !important;');
    });

    it('keeps the Steam footer aligned cleanly without double padding and preserves the spacer', () => {
        const footer = buildFooterCss({
            BasicFooter: 'Footer',
            FooterLegend: 'Legend',
            PillShapedIcon: 'Pill',
            Spacer: 'Spacer',
            QuickAccessFooter: 'QAFooter',
            WithKeyboard: 'WithKbd',
            FloatingVRFooter: 'VRFooter',
        });
        expect(footer).toContain('justify-content: flex-start !important;');
        expect(footer).toContain('width: 100% !important;');
        expect(footer).toContain('margin-left: 0 !important;');
        expect(footer).toContain('margin-right: 0 !important;');
        expect(footer).toContain('box-sizing: border-box !important;');
        expect(footer).toContain('padding-left: 14px !important;');
        expect(footer).toContain('padding-right: 14px !important;');
        expect(footer).toContain('padding-left: 10px !important;');
        expect(footer).toContain('padding: 3px 0 !important;');
        expect(footer).not.toContain('padding: 0 36px');
        expect(footer).toContain('.Spacer { flex: 1 1 auto !important;');
        expect(footer).toContain('flex-wrap: nowrap');
        expect(footer).toContain('.Pill');
        expect(footer).toContain('min-width: 26px !important;');
        expect(footer).toContain('flex-shrink: 0 !important;');
        expect(footer).not.toContain(' width: 26px !important');
        expect(footer).not.toContain('border-radius: 50% !important');
    });

    it('builds global menu, QAM, and context menu styles without BetterBlur or animated !important overrides', () => {
        const mainOnly = buildMainMenuCss(
            { MainNavMenuAnchor: 'Anchor', MainNavMenuMainSplit: 'Split' },
            { NavigationColumn: 'Column', NavigationBox: 'Box', NavigationMenuItem: 'Item', Active: 'Active', ActiveDot: 'NavDot', NavigationMenuItemSeparator: 'Separator' },
            { Menu: 'MainMenu', Container: 'MainContainer', ItemOuter: 'ItemOuter', Item: 'MainItem', ItemIcon: 'MainIcon', ItemLabel: 'MainLabel', Active: 'MainActive', ActiveDot: 'MainDot', RunnningAppSeparator: 'MainSep' },
        );
        expect(mainOnly).not.toContain('BasicFooter');
        expect(mainOnly).not.toContain('FooterLegend');
        expect(mainOnly).toContain('.MainMenu');
        expect(mainOnly).toContain('.MainItem');
        expect(mainOnly).toContain('.Column');
        expect(mainOnly).toContain('html[data-nh-chrome="mainmenu"] [role="menuitem"]');
        expect(mainOnly).toContain('min-height: 48px !important;');
        expect(mainOnly).toContain('box-sizing: border-box !important;');
        expect(mainOnly).toContain('animation-name: none !important;');
        expect(mainOnly).not.toMatch(/(?:^|[\s;{])(transform|opacity)\s*:[^;]*!important/);

        const qamCss = buildQuickAccessCss(
            {
                QuickAccessMenu: 'Qam',
                Menu: 'QamMenu',
                HeaderAndFooterVisible: 'HeaderFooter',
                Container: 'Container',
                HeaderContainer: 'Header',
                Title: 'Title',
                Tabs: 'Tabs',
                Tab: 'Tab',
                Selected: 'Selected',
                TabContentColumn: 'Content',
                AllTabContents: 'AllTabs',
                TabGroupPanel: 'TabPanel',
                PanelSection: 'MenuSection',
                PanelSectionRow: 'MenuRow',
                PanelSectionTitle: 'MenuSectionTitle',
                Label: 'MenuLabel',
                Text: 'MenuText',
            },
            {
                PanelSection: 'CtrlSection',
                PanelSectionRow: 'CtrlRow',
                PanelSectionTitle: 'CtrlSectionTitle',
                Label: 'CtrlLabel',
                Text: 'CtrlText',
            },
        );
        expect(qamCss).toContain('#QuickAccess-Menu');
        expect(qamCss).toContain('.Qam');
        expect(qamCss).toContain('.CtrlSection');
        expect(qamCss).toContain('.MenuSection');
        expect(qamCss).toContain('.CtrlLabel');
        expect(qamCss).toContain('.MenuLabel');
        expect(qamCss).toContain('.CtrlText');
        expect(qamCss).toContain('.MenuText');
        expect(qamCss).toContain('box-shadow: none !important;');
        expect(qamCss).not.toContain('N9sQLZ3HK0hCd9vbZif0o');
        expect(qamCss).not.toContain('3rsrz7BYWjqGBhzcpn-Auo');
        expect(qamCss).not.toContain('2NQoFicPv3MZKwGD6pJj-f');
        expect(qamCss).not.toMatch(/(?:^|[\s;{])(transform|opacity)\s*:[^;]*!important/);

        const ctxCss = buildContextMenuCss({
            BasicContextMenuContainer: 'CtxContainer',
            contextMenuContents: 'CtxContents',
            BasicContextMenuHeader: 'CtxHeader',
            contextMenuItem: 'CtxItem',
            Focused: 'CtxFocused',
            Destructive: 'Destructive',
            ContextMenuSeparator: 'CtxSep',
        });
        expect(ctxCss).toContain('.CtxContainer');
        expect(ctxCss).not.toContain(':not(.Destructive)');

        const bundle = buildMenuChromeCss(
            { MainNavMenuAnchor: 'Anchor', MainNavMenuMainSplit: 'Split' },
            { NavigationColumn: 'Column', NavigationBox: 'Box', NavigationMenuItem: 'Item', Active: 'Active', NavigationMenuItemSeparator: 'Separator' },
            { BasicFooter: 'Footer', FooterLegend: 'Legend', PillShapedIcon: 'Pill', Spacer: 'Spacer' },
            { QuickAccessMenu: 'Qam', Container: 'Container', HeaderContainer: 'Header', Title: 'Title', Tabs: 'Tabs', Tab: 'Tab', Selected: 'Selected', TabContentColumn: 'Content' },
            { PanelSection: 'Section', PanelSectionRow: 'Row', PanelSectionTitle: 'SectionTitle', Label: 'Label', Text: 'Text' },
            { Menu: 'MainMenu', Container: 'MainContainer', Item: 'MainItem', ItemIcon: 'MainIcon', ItemLabel: 'MainLabel', Active: 'MainActive' },
            { BasicContextMenuContainer: 'CtxContainer', contextMenuContents: 'CtxContents', contextMenuItem: 'CtxItem', Focused: 'CtxFocused', Destructive: 'Destructive' },
        );
        expect(bundle).toContain('--nh-menu-surface');
        expect(bundle).toContain('--nh-qam-surface');
        expect(bundle).toContain('.MainMenu');
        expect(bundle).toContain('.CtxContainer');
        expect(bundle).toContain('border-right: 2px solid');
        expect(bundle).toContain('border-left: 2px solid');
        expect(bundle).toContain('border-top: 2px solid');
        expect(bundle).toContain('border-radius: 0 !important');
    });

    it('syncs menu chrome across Big Picture, MainMenu, and QuickAccess documents while ignoring SharedJSContext', () => {
        const sharedDom = parseHTML('<!doctype html><html><head><title>SharedJSContext</title></head><body></body></html>');
        const spDom = parseHTML('<!doctype html><html><head><title>Режим Big Picture</title></head><body><div id="Footer"></div></body></html>');
        const mainDom = parseHTML('<!doctype html><html><head><title>MainMenu_uid2</title></head><body><div id="MainNavMenuContainer"></div></body></html>');
        const qamDom = parseHTML('<!doctype html><html><head><title>QuickAccess_uid2</title></head><body><div id="QuickAccess-Menu"></div></body></html>');

        const sharedDoc = sharedDom.document as unknown as Document;
        const spDoc = spDom.document as unknown as Document;
        const mainDoc = mainDom.document as unknown as Document;
        const qamDoc = qamDom.document as unknown as Document;

        let cssText = '.a { color: red; }';
        let trees: unknown[] = [{ id: 'GamepadUI_Full_Root', m_Root: { m_element: { ownerDocument: spDoc } } }];
        const injected = new Map<string, string>();
        const injectCssIntoTab = vi.fn((tab: string, _css: string) => {
            const id = `${tab}-1`;
            injected.set(tab, id);
            return id;
        });
        const removeCssFromTab = vi.fn((tab: string, id: string) => {
            if (injected.get(tab) === id) injected.delete(tab);
        });
        const clearedTimers: number[] = [];
        let nextTimerId = 1;
        const controller = createMenuChromeSync({
            getCss: () => cssText,
            isReady: () => false,
            getNavigationTrees: () => trees,
            getPopups: () => [{ m_popup: { document: sharedDoc } }],
            injectCssIntoTab,
            removeCssFromTab,
            sharedContextDoc: sharedDoc,
            setTimeoutFn: () => nextTimerId++ as unknown as ReturnType<typeof setTimeout>,
            clearTimeoutFn: (id) => {
                clearedTimers.push(id as unknown as number);
            },
        });

        controller.setHostDocument(spDoc);
        controller.start();

        // SharedJSContext must never be styled
        expect(sharedDoc.getElementById(MENU_CHROME_STYLE_ID)).toBeNull();
        expect(sharedDoc.documentElement.getAttribute(MENU_CHROME_WINDOW_ATTR)).toBeNull();
        // hostDoc gets attribute but no duplicate <style id>
        expect(spDoc.documentElement.getAttribute(MENU_CHROME_WINDOW_ATTR)).toBe('sp');
        expect(spDoc.getElementById(MENU_CHROME_STYLE_ID)).toBeNull();
        // Fallback injected when side-menu DOM docs are absent
        expect(injectCssIntoTab).toHaveBeenCalledWith('MainMenu', cssText);
        expect(injectCssIntoTab).toHaveBeenCalledWith('QuickAccess', cssText);

        // Now side-menu DOM docs appear via navigation trees
        trees = [
            { id: 'GamepadUI_Full_Root', m_Root: { m_element: { ownerDocument: spDoc } } },
            { id: 'MainNavMenuContainer', m_Root: { m_element: { ownerDocument: mainDoc } } },
            { id: 'QuickAccess-NA', m_Root: { m_element: { ownerDocument: qamDoc } } },
        ];
        controller.sync();

        expect(mainDoc.documentElement.getAttribute(MENU_CHROME_WINDOW_ATTR)).toBe('mainmenu');
        expect(qamDoc.documentElement.getAttribute(MENU_CHROME_WINDOW_ATTR)).toBe('quickaccess');
        expect(mainDoc.head.querySelectorAll(`#${MENU_CHROME_STYLE_ID}`)).toHaveLength(1);
        expect(qamDoc.head.querySelectorAll(`#${MENU_CHROME_STYLE_ID}`)).toHaveLength(1);
        expect(mainDoc.getElementById(MENU_CHROME_STYLE_ID)?.textContent).toBe(cssText);
        // Tab fallback removed once DOM docs were discovered
        expect(removeCssFromTab).toHaveBeenCalledWith('MainMenu', 'MainMenu-1');
        expect(removeCssFromTab).toHaveBeenCalledWith('QuickAccess', 'QuickAccess-1');

        // Updating CSS updates existing tag in-place without duplicating
        cssText = '.b { color: blue; }';
        controller.sync();
        expect(mainDoc.head.querySelectorAll(`#${MENU_CHROME_STYLE_ID}`)).toHaveLength(1);
        expect(mainDoc.getElementById(MENU_CHROME_STYLE_ID)?.textContent).toBe(cssText);

        // stop() cleans up all styles, attributes, and timers
        controller.stop();
        expect(mainDoc.getElementById(MENU_CHROME_STYLE_ID)).toBeNull();
        expect(qamDoc.getElementById(MENU_CHROME_STYLE_ID)).toBeNull();
        expect(spDoc.documentElement.getAttribute(MENU_CHROME_WINDOW_ATTR)).toBeNull();
        expect(mainDoc.documentElement.getAttribute(MENU_CHROME_WINDOW_ATTR)).toBeNull();
        expect(qamDoc.documentElement.getAttribute(MENU_CHROME_WINDOW_ATTR)).toBeNull();
        expect(clearedTimers.length).toBeGreaterThan(0);
    });

    it('guards afterPatch against stacking duplicate wrappers across outer plugin wrappers', () => {
        type WrappedFn = ((x: number) => number) & { __deckyPatch?: { original?: unknown } };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fakeAfterPatch = vi.fn((obj: Record<string, WrappedFn>, prop: string, handler: (...args: any[]) => any) => {
            const orig = obj[prop];
            const wrapped: WrappedFn = ((x: number) => Number(handler([x], orig(x)))) as WrappedFn;
            wrapped.__deckyPatch = { original: orig };
            obj[prop] = wrapped;
            return wrapped;
        });

        const target = { render: ((x: number) => x + 1) as WrappedFn };
        const afterPatchOnce = createAfterPatchGuard(fakeAfterPatch);

        expect(afterPatchOnce(target, 'render', (_args, r: number) => r * 2)).toBe(true);
        // Repeated call on the same wrapper must no-op
        expect(afterPatchOnce(target, 'render', (_args, r) => r * 2)).toBe(false);

        // Simulate another plugin wrapping on top and keeping __deckyPatch.original
        const prev = target.render;
        const otherPluginWrapper: WrappedFn = ((x: number) => prev(x) + 10) as WrappedFn;
        otherPluginWrapper.__deckyPatch = { original: prev };
        target.render = otherPluginWrapper;

        expect(afterPatchOnce(target, 'render', (_args, r) => r * 2)).toBe(false);
        expect(fakeAfterPatch).toHaveBeenCalledTimes(1);
        expect(target.render(3)).toBe(18);
    });
});

describe('CustomLibrary data, navigation, and virtualization', () => {
    const globals = {
        appStore: {
            allApps: [
                { appid: 1, display_name: 'Zelda-like', app_type: 1, rt_last_time_played: 100, minutes_playtime_forever: 60, installed: true },
                { appid: 2, display_name: 'Alpha Game', app_type: 1, rt_last_time_played: 300, minutes_playtime_forever: 20, installed: false },
                { appid: 3, display_name: 'Non-Steam Port', app_type: 1073741824, rt_last_time_played: 200, minutes_playtime_forever: 500, installed: true },
                { appid: 4, display_name: 'Hidden Tool', app_type: 4, rt_last_time_played: 999 },
            ],
        },
        collectionStore: {
            localGamesCollection: { allApps: [{ appid: 1 }, { appid: 3 }] },
            userCollections: [
                { id: 'favorite', displayName: 'Favorites', allApps: [{ appid: 2 }] },
                { id: 'uc-indie', displayName: 'Indie', allApps: [{ appid: 1 }, { appid: 3 }] },
            ],
            BIsHidden: (id: number) => id === 4,
        },
    };

    it('builds tabs and filters/sorts library games accurately', () => {
        const snap = readLibrarySnapshot('en', globals);
        expect(snap.games.map((g) => g.appId)).toEqual([1, 2, 3]);
        expect(snap.tabs.map((t) => t.id)).toEqual(['all', 'installed', 'favorites', 'nonsteam', 'col:uc-indie']);

        const byName = filterAndSortLibraryGames(snap.games, snap.tabs[0], false, 'name');
        expect(byName.map((g) => g.appId)).toEqual([2, 3, 1]);

        const installedOnly = filterAndSortLibraryGames(snap.games, snap.tabs[0], true, 'playtime');
        expect(installedOnly.map((g) => g.appId)).toEqual([3, 1]);

        const favs = filterAndSortLibraryGames(snap.games, snap.tabs.find((t) => t.id === 'favorites'), false, 'lastPlayed');
        expect(favs.map((g) => g.appId)).toEqual([2]);

        expect(nextLibrarySort('added')).toBe('lastPlayed');
    });

    it('handles grid/list gamepad actions, top-row header escape, and B passthrough', () => {
        // Fresh Up on top row yields null so Steam top bar can take focus
        expect(libraryButtonAction(9, 2, 20, 5, false)).toBeNull();
        // Held Up on top row stops cleanly
        expect(libraryButtonAction(9, 2, 20, 5, true)).toEqual({ type: 'move', index: 2 });
        // Down moves by row
        expect(libraryButtonAction(10, 2, 20, 5, false)).toEqual({ type: 'move', index: 7 });
        // L1/R1 switch tabs; L2/R2 jump pages
        expect(libraryButtonAction(5, 0, 20, 5, false)).toEqual({ type: 'tab', delta: -1 });
        expect(libraryButtonAction(6, 0, 20, 5, false)).toEqual({ type: 'tab', delta: 1 });
        expect(libraryButtonAction(8, 0, 30, 5, false)).toEqual({ type: 'move', index: 15 });
        // X filter, Y sort, Start menu, B passthrough (null)
        expect(libraryButtonAction(3, 0, 20, 5, false)).toEqual({ type: 'filter' });
        expect(libraryButtonAction(4, 0, 20, 5, false)).toEqual({ type: 'sort' });
        expect(libraryButtonAction(14, 0, 20, 5, false)).toEqual({ type: 'menu' });
        expect(libraryButtonAction(2, 0, 20, 5, false)).toBeNull();
    });

    it('computes bounded visible row ranges for virtualization', () => {
        expect(visibleRowRange(400, 600, 200, 50, 1)).toEqual({ startRow: 1, endRow: 6 });
        expect(visibleRowRange(0, 600, 200, 2, 2)).toEqual({ startRow: 0, endRow: 2 });
    });
});

describe('audit regression checks', () => {
    const classes: ThemeClasses = {
        header: { TopCapsule: 'TopCapsule', BoxSizer: 'BoxSizer', TitleImageContainer: 'TitleImg', SVGTitle: 'SvgTitle' },
        details: { InnerContainer: 'Inner', AppDetailsOverviewPanel: 'Overview' },
        overview: {},
        root: { AppDetailsContainer: 'AppDetails', PlaySection: 'PlaySection', ActionButtonAndStatusPanel: 'PlayBtn', AppButtons: 'AppButtons' },
        play: { MenuButton: 'MenuBtn', CloudStatusRow: 'CloudRow', CloudStatusIcon: 'CloudIcon' },
        launch: { Container: 'LaunchOverlay' },
    };

    it('avoids !important on animated transform/opacity and targets .nh-gv-desc', () => {
        const launch = buildLaunchCss(classes);
        expect(launch).not.toMatch(/opacity\s*:[^;]*!important/);

        const arrivingHidden = buildArrivingCss(classes, 'spotlight', 'all', false);
        const arrivingShown = buildArrivingCss(classes, 'spotlight', 'all', true);
        expect(arrivingHidden).not.toMatch(/opacity\s*:[^;]*!important/);
        expect(arrivingShown).not.toMatch(/opacity\s*:[^;]*!important/);

        const uni = buildUnifideckCss(classes, { restyle: true, minimal: false });
        expect(uni).not.toMatch(/(?:^|[\s;{])transform\s*:[^;]*!important/);

        const theme = buildThemeCss(classes, { restyle: true, minimal: false });
        expect(theme).not.toMatch(/transform\s*:\s*scale\([^;]*!important/);

        expect(twinTargets(classes, 'spotlight')[SETTLE.desc]).toContain('.nh-gv-desc');
    });

    it('wraps minimal home action bar and scrolls overflowing library tabs', () => {
        const home = homeCss();
        expect(home).toContain('.gh-root.nh-layout-minimal .gh-action-bar { flex-wrap: wrap !important; }');

        const lib = libraryCss({ cols: 5, cardW: 160, cardH: 240, gap: 14, hideStatusBarBackground: true });
        expect(lib).toContain('.nh-lib-tabs { display: flex !important; align-items: center !important; gap: 8px !important; overflow-x: auto !important;');
        expect(lib).toContain('.nh-lib-min-tabs { display: flex !important; align-items: center !important; gap: 12px !important; overflow-x: auto !important;');
    });

    it('serializes rapid settings writes and syncs setCleanPage with gamePageLayout', async () => {
        const writes: Array<Record<string, unknown>> = [];
        let releaseFirst: (() => void) | null = null;
        let call = 0;
        const slowKv: KvBackend = {
            ...createMemoryKv(),
            async set(_key, value) {
                call += 1;
                if (call === 1) {
                    await new Promise<void>((resolve) => { releaseFirst = resolve; });
                }
                writes.push({ ...(value as Record<string, unknown>) });
            },
        };
        const store = createSettingsStore(slowKv);
        const p1 = store.setHomeLayout('carousel');
        const p2 = store.setCleanPage(true);
        expect(store.get().gamePageLayout).toBe('minimal');
        releaseFirst!();
        await Promise.all([p1, p2]);
        expect(writes).toHaveLength(2);
        expect(writes[0].homeLayout).toBe('carousel');
        expect(writes[0].cleanPage).toBe(false);
        expect(writes[1].homeLayout).toBe('carousel');
        expect(writes[1].cleanPage).toBe(true);
        expect(writes[1].gamePageLayout).toBe('minimal');
    });

    it('keeps hero cover scale locked on Game Page and applies heroPosition across Home, Library, and Game Page', () => {
        const home = homeCss(undefined, { heroPosition: 'right' });
        expect(home).toContain('.gh-hero-full { position: absolute !important; inset: 0 !important; background-size: cover !important; background-position: 100% 30% !important;');
        expect(home).toContain('.gh-hero-open { position: absolute !important; inset: 0 !important; pointer-events: none !important; background-image: var(--gho-hero, none) !important; background-size: cover !important; background-position: 100% 30% !important;');

        const lib = libraryCss({ cols: 5, cardW: 160, cardH: 240, gap: 14, hideStatusBarBackground: true, heroPosition: 'right' });
        expect(lib).toContain('.nh-lib-root .gh-hero-full { position: absolute !important; inset: 0 !important; background-size: cover !important; background-position: 100% 30% !important;');

        const page = buildThemeCss(
            {
                ...classes,
                header: { ...classes.header, Background: 'HdrBg', HeaderBackgroundImage: 'HdrBgImg', ImgSrc: 'HdrImg' },
            },
            { restyle: true, minimal: false, heroPosition: 'right' },
        );
        expect(page).toContain('object-fit: cover !important;');
        expect(page).toContain('object-position: 100% 30% !important;');
        expect(page).toContain('transform: none !important;');
        expect(page).toContain('.TopCapsule img:not(.TitleImg img)');
        expect(page).toContain('.TopCapsule { height: 100vh !important; min-height: 0 !important; }');
    });

    it('includes compositor-safe return animations on Home and open/return/tab animations in Library', () => {
        const home = homeCss();
        expect(home).toContain('@keyframes gh-return-left');
        expect(home).toContain('@keyframes gh-return-up');
        expect(home).toContain('.gh-root.gh-back:not(.gh-bridge) .gh-recents');

        const lib = libraryCss({ cols: 5, cardW: 160, cardH: 240, gap: 14, hideStatusBarBackground: true });
        expect(lib).toContain('.nh-lib-root.nh-lib-back .nh-lib-grid-shell');
        expect(lib).toContain('.nh-lib-root.nh-lib-opening .nh-lib-grid-shell');
        expect(lib).toContain('.nh-lib-root .nh-lib-tab-stage');
        expect(lib).not.toMatch(/(?:^|[\s;{])(transform|opacity)\s*:[^;]*!important/);
    });
});
