import {
    findClassModule,
    footerClasses,
    gamepadContextMenuClasses,
    gamepadUIClasses,
    mainMenuAppRunningClasses,
    quickAccessControlsClasses,
    quickAccessMenuClasses,
} from '@decky/ui';
import { LOG_PREFIX } from '../constants';
import { buildMainMenuCss, buildMenuChromeCss, buildQuickAccessCss, ClassMap } from './menuCss';

interface MenuChromeClassMaps {
    ui: ClassMap;
    navigation: ClassMap;
    mainMenu: ClassMap;
    footer: ClassMap;
    quickAccessMenu: ClassMap;
    quickAccessControls: ClassMap;
    contextMenu: ClassMap;
}

const cached: Partial<MenuChromeClassMaps> = {};

function safeFind(filter: (m: Record<string, string>) => boolean): ClassMap {
    try {
        return (findClassModule(filter) || undefined) as ClassMap;
    } catch (error) {
        console.warn(`${LOG_PREFIX} menu class module lookup failed`, error);
        return undefined;
    }
}

function validMap(mod: unknown, key: string): ClassMap {
    const map = mod as ClassMap | undefined;
    const val = map?.[key];
    return typeof val === 'string' && val.length > 0 ? map : undefined;
}

function menuChromeClasses(): MenuChromeClassMaps {
    cached.ui ??=
        validMap(gamepadUIClasses, 'MainNavMenuAnchor') ??
        safeFind((m) => Boolean(m.BasicUiRoot && m.MainNavMenuAnchor));
    cached.navigation ??=
        validMap(mainMenuAppRunningClasses, 'NavigationColumn') ??
        safeFind((m) => Boolean(m.NavigationColumn && m.NavigationMenuItem));
    cached.mainMenu ??= safeFind((m) => Boolean(m.Item && m.ItemIcon && m.ItemLabel && m.Menu && !m.NavigationColumn));
    cached.footer ??=
        validMap(footerClasses, 'BasicFooter') ??
        safeFind((m) => Boolean(m.BasicFooter && m.FooterLegend));
    cached.quickAccessMenu ??=
        validMap(quickAccessMenuClasses, 'QuickAccessMenu') ??
        safeFind((m) => Boolean(m.QuickAccessMenu && m.Tabs));
    cached.quickAccessControls ??=
        validMap(quickAccessControlsClasses, 'PanelSection') ??
        safeFind((m) => Boolean(m.BatteryPercentageLabel && m.PanelSection && !m.QuickAccessMenu));
    cached.contextMenu ??=
        validMap(gamepadContextMenuClasses, 'contextMenuItem') ??
        safeFind((m) => Boolean(m.BasicContextMenuContainer && m.contextMenuItem));
    return cached as MenuChromeClassMaps;
}

export function menuChromeCss(): string {
    const c = menuChromeClasses();
    return buildMenuChromeCss(c.ui, c.navigation, c.footer, c.quickAccessMenu, c.quickAccessControls, c.mainMenu, c.contextMenu);
}

export function quickAccessCss(): string {
    const c = menuChromeClasses();
    return buildQuickAccessCss(c.quickAccessMenu, c.quickAccessControls);
}

export function mainMenuCss(): string {
    const c = menuChromeClasses();
    return buildMainMenuCss(c.ui, c.navigation, c.mainMenu);
}

export function menuChromeClassesReady(): boolean {
    const c = menuChromeClasses();
    return Boolean(c.footer && c.quickAccessMenu && (c.mainMenu || c.navigation));
}
