export type ClassMap = Record<string, string | undefined> | undefined;

function cls(map: ClassMap, key: string): string | null {
    const value = map?.[key];
    return typeof value === 'string' && value.length > 0 ? `.${value}` : null;
}

function present(selectors: Array<string | null | undefined>): string[] {
    return Array.from(new Set(selectors.filter((value): value is string => Boolean(value))));
}

function rule(selector: string | null | Array<string | null | undefined>, body: string): string {
    const selectors = present(Array.isArray(selector) ? selector : [selector]);
    return selectors.length > 0 ? `${selectors.join(', ')} { ${body} }` : '';
}

export function buildMainMenuCss(ui: ClassMap, navigation: ClassMap, mainMenu?: ClassMap): string {
    const anchor = cls(ui, 'MainNavMenuAnchor');
    const split = cls(ui, 'MainNavMenuMainSplit');
    const column = cls(navigation, 'NavigationColumn');
    const box = cls(navigation, 'NavigationBox');
    const appColumn = cls(navigation, 'AppColumn');
    const item = cls(navigation, 'NavigationMenuItem');
    const active = cls(navigation, 'Active');
    const activeDot = cls(navigation, 'ActiveDot');
    const separator = cls(navigation, 'NavigationMenuItemSeparator');

    const menu = cls(mainMenu, 'Menu');
    const menuContainer = cls(mainMenu, 'Container');
    const menuItemOuter = cls(mainMenu, 'ItemOuter');
    const menuItem = cls(mainMenu, 'Item');
    const menuItemIcon = cls(mainMenu, 'ItemIcon');
    const menuItemLabel = cls(mainMenu, 'ItemLabel');
    const menuActive = cls(mainMenu, 'Active');
    const menuActiveDot = cls(mainMenu, 'ActiveDot');
    const runnningSep = cls(mainMenu, 'RunnningAppSeparator');
    const itemFocused = present([
        item && `${item}.gpfocus`,
        item && `${item}:focus`,
        item && `${item}.gpfocuswithin`,
        item && `${item}:hover`,
    ]);
    const itemActiveIdle = present([
        active && item && `${item}${active}:not(.gpfocus):not(:focus):not(.gpfocuswithin):not(:hover)`,
    ]);
    const mainItems = present([menuItem, 'html[data-nh-chrome="mainmenu"] [role="menuitem"]']);
    const mainItemFocused = mainItems.flatMap((sel) => [
        `${sel}.gpfocus`,
        `${sel}:focus`,
        `${sel}.gpfocuswithin`,
        `${sel}:hover`,
    ]);
    const mainItemActiveIdle = mainItems.flatMap((sel) => [
        menuActive && `${sel}${menuActive}:not(.gpfocus):not(:focus):not(.gpfocuswithin):not(:hover)`,
    ]);
    const itemChildren = present([
        item && `${item} > div`,
        item && `${item} > span`,
        ...mainItems.flatMap((sel) => [`${sel} > div`, `${sel} > span`]),
        menuItemIcon,
        menuItemLabel,
    ]);
    const menuOuter = menu ?? 'html[data-nh-chrome="mainmenu"] #MainNavMenuContainer > div:first-child';

    return [
        `:root { --nh-menu-surface: var(--ctp-surface0, rgba(20, 28, 38, 0.96)); --nh-menu-surface-strong: var(--ctp-surface1, rgba(32, 44, 60, 0.98)); --nh-menu-border: var(--ctp-surface2, rgba(255, 255, 255, 0.12)); }`,
        rule(anchor, 'background: transparent !important; border: none !important; box-shadow: none !important;'),
        rule(split, 'background: transparent !important; border: none !important; box-shadow: none !important;'),
        rule(
            column,
            'background: var(--nh-menu-surface) !important; border-top: 2px solid var(--nh-menu-border) !important; border-right: 2px solid var(--nh-menu-border) !important; border-bottom: none !important; border-left: none !important; border-radius: 0 !important; box-shadow: none !important; padding: 12px 10px !important; box-sizing: border-box !important;',
        ),
        rule(column && `${column}::before`, 'background: none !important; border: none !important;'),
        rule(box, 'background: transparent !important; border: none !important; box-shadow: none !important;'),
        rule(
            appColumn,
            'background: var(--nh-menu-surface) !important; border-top: 2px solid var(--nh-menu-border) !important; border-right: 2px solid var(--nh-menu-border) !important; border-bottom: none !important; border-left: none !important; border-radius: 0 !important; box-shadow: none !important; box-sizing: border-box !important;',
        ),
        rule(
            item,
            'min-height: 48px !important; margin: 2px 4px !important; padding: 0 16px !important; display: flex !important; align-items: center !important; line-height: 1.2 !important; box-sizing: border-box !important; border-radius: 0 !important; color: var(--ctp-text, #dcdedf) !important; background: transparent !important; box-shadow: none !important; outline: none !important; transition: background 140ms ease, color 140ms ease !important;',
        ),
        rule(item && [`${item}::before`, `${item}::after`], 'border-radius: 0 !important; outline: none !important;'),
        rule(
            itemActiveIdle,
            'color: var(--ctp-accent-color, #1a9fff) !important; background: transparent !important; box-shadow: none !important;',
        ),
        rule(
            itemFocused,
            'color: var(--ctp-crust, #0b0f14) !important; background: var(--ctp-accent-color, #1a9fff) !important; box-shadow: none !important; outline: none !important; border-radius: 0 !important; animation-name: none !important;',
        ),
        rule(itemFocused.map((s) => `${s} svg`), 'color: inherit !important;'),
        rule(activeDot, 'background: var(--ctp-accent-color, #1a9fff) !important; border-radius: 0 !important;'),
        rule(separator, 'height: 2px !important; margin: 8px 16px !important; background: var(--nh-menu-border) !important;'),
        rule(
            menuOuter,
            'background: var(--nh-menu-surface) !important; border-top: 2px solid var(--nh-menu-border) !important; border-right: 2px solid var(--nh-menu-border) !important; border-bottom: none !important; border-left: none !important; border-radius: 0 !important; box-shadow: none !important; box-sizing: border-box !important;',
        ),
        rule(present([menuContainer, menuItemOuter, 'html[data-nh-chrome="mainmenu"] #MainNavMenu-Rest']), 'background: transparent !important; border: none !important; box-shadow: none !important;'),
        rule(
            mainItems,
            'min-height: 48px !important; margin: 2px 6px !important; padding: 0 16px !important; display: flex !important; align-items: center !important; line-height: 1.2 !important; box-sizing: border-box !important; border-radius: 0 !important; color: var(--ctp-text, #dcdedf) !important; background: transparent !important; box-shadow: none !important; outline: none !important; transition: background 140ms ease, color 140ms ease !important;',
        ),
        rule(itemChildren, 'display: flex !important; align-items: center !important; margin-top: 0 !important; margin-bottom: 0 !important; padding-top: 0 !important; padding-bottom: 0 !important; line-height: 1.2 !important;'),
        rule(mainItems.flatMap((s) => [`${s}::before`, `${s}::after`]), 'display: none !important; box-shadow: none !important; border-radius: 0 !important;'),
        rule(present([menuItemIcon, menuItemLabel]), 'color: inherit !important;'),
        rule(
            mainItemActiveIdle,
            'color: var(--ctp-accent-color, #1a9fff) !important; background: transparent !important; box-shadow: none !important;',
        ),
        rule(
            mainItemFocused,
            'color: var(--ctp-crust, #0b0f14) !important; background: var(--ctp-accent-color, #1a9fff) !important; box-shadow: none !important; outline: none !important; border-radius: 0 !important; animation-name: none !important;',
        ),
        rule(menuActiveDot, 'background: var(--ctp-accent-color, #1a9fff) !important; border-radius: 0 !important;'),
        rule(present([runnningSep, 'html[data-nh-chrome="mainmenu"] hr']), 'background: var(--nh-menu-border) !important; border-color: var(--nh-menu-border) !important;'),
    ]
        .filter(Boolean)
        .join('\n');
}

export function buildMenuChromeCss(
    ui: ClassMap,
    navigation: ClassMap,
    footer: ClassMap,
    quickAccessMenu: ClassMap,
    quickAccessControls: ClassMap,
    mainMenu?: ClassMap,
    contextMenu?: ClassMap,
): string {
    return [
        buildMainMenuCss(ui, navigation, mainMenu),
        buildFooterCss(footer),
        buildQuickAccessCss(quickAccessMenu, quickAccessControls),
        buildContextMenuCss(contextMenu),
    ]
        .filter(Boolean)
        .join('\n');
}

export function buildQuickAccessCss(menu: ClassMap, controls: ClassMap): string {
    const roots = present([cls(menu, 'QuickAccessMenu'), '#QuickAccess-Menu']);
    const menuCls = cls(menu, 'Menu');
    const headerAndFooter = cls(menu, 'HeaderAndFooterVisible');
    const container = cls(menu, 'Container');
    const header = cls(menu, 'HeaderContainer');
    const title = cls(menu, 'Title');
    const tabs = cls(menu, 'Tabs');
    const tab = cls(menu, 'Tab');
    const selected = cls(menu, 'Selected');
    const transparentContainers = present([
        container,
        cls(menu, 'TabContentColumn'),
        cls(menu, 'AllTabContents'),
        cls(menu, 'TabGroupPanel'),
    ]);
    const section = present([cls(controls, 'PanelSection'), cls(menu, 'PanelSection')]);
    const row = present([cls(controls, 'PanelSectionRow'), cls(menu, 'PanelSectionRow')]);
    const sectionTitle = present([cls(controls, 'PanelSectionTitle'), cls(menu, 'PanelSectionTitle')]);
    const labelsAndText = present([cls(controls, 'Label'), cls(menu, 'Label'), cls(controls, 'Text'), cls(menu, 'Text')]);
    return [
        `:root { --nh-qam-surface: var(--ctp-surface0, rgba(20, 28, 38, 0.96)); --nh-qam-panel: var(--ctp-surface1, rgba(32, 44, 60, 0.96)); --nh-qam-border: var(--ctp-surface2, rgba(255, 255, 255, 0.12)); }`,
        rule(
            roots,
            'background: var(--nh-qam-surface) !important; border-top: 2px solid var(--nh-qam-border) !important; border-left: 2px solid var(--nh-qam-border) !important; border-right: none !important; border-bottom: none !important; border-radius: 0 !important; box-shadow: none !important; backdrop-filter: none !important; box-sizing: border-box !important;',
        ),
        rule(
            present([
                headerAndFooter && menuCls ? `${headerAndFooter} ${menuCls}::before` : null,
                tabs ? `${tabs}::after` : null,
            ]),
            'background: var(--nh-qam-surface) !important;',
        ),
        rule(transparentContainers, 'background: transparent !important; border: none !important;'),
        rule(
            present([header, '#QuickAccess-Menu [class*="HeaderContainer"]']),
            'background: var(--nh-qam-surface) !important; border-bottom: 2px solid var(--nh-qam-border) !important; position: relative !important; z-index: 5 !important;',
        ),
        rule(
            present([title, '#QuickAccess-Menu [class*="Title"]']),
            'color: var(--ctp-text, #ffffff) !important; font-weight: 800 !important; background: var(--nh-qam-surface) !important; position: relative !important; z-index: 5 !important; box-shadow: none !important;',
        ),
        rule(tabs, 'background: var(--ctp-mantle, #11161d) !important; border-right: 2px solid var(--nh-qam-border) !important;'),
        rule(
            tab,
            'border-radius: 0 !important; outline: none !important; color: var(--ctp-subtext0, #8b929a) !important; transition: background 140ms ease, color 140ms ease !important;',
        ),
        rule(tab && [`${tab}::before`, `${tab}::after`], 'border-radius: 0 !important; outline: none !important;'),
        rule(tab && `${tab} svg`, 'color: inherit !important;'),
        rule(
            [
                selected && tab && `${tab}${selected}`,
                tab && `${tab}.gpfocus`,
                tab && `${tab}:focus`,
                tab && `${tab}.gpfocuswithin`,
                tab && `${tab}:hover`,
            ],
            'background: var(--ctp-accent-color, #1a9fff) !important; color: var(--ctp-crust, #0b0f14) !important; border-radius: 0 !important; outline: none !important; animation-name: none !important;',
        ),
        rule(
            section,
            'margin: 8px 0 !important; padding: 12px !important; border: 2px solid var(--nh-qam-border) !important; border-radius: 0 !important; box-sizing: border-box !important; background: var(--nh-qam-panel) !important;',
        ),
        rule(row, 'border-color: var(--nh-qam-border) !important;'),
        rule(sectionTitle, 'color: var(--ctp-accent-color, #1a9fff) !important; letter-spacing: 0.08em !important;'),
        rule(labelsAndText, 'color: var(--ctp-text, #dcdedf) !important;'),
    ]
        .filter(Boolean)
        .join('\n');
}

export function buildContextMenuCss(contextMenu?: ClassMap): string {
    const container = cls(contextMenu, 'BasicContextMenuContainer');
    const contents = cls(contextMenu, 'contextMenuContents');
    const header = cls(contextMenu, 'BasicContextMenuHeader');
    const item = cls(contextMenu, 'contextMenuItem');
    const focused = cls(contextMenu, 'Focused');
    const sep = cls(contextMenu, 'ContextMenuSeparator');
    const outer = container ?? contents;
    return [
        rule(
            outer,
            'background: var(--nh-menu-surface, var(--ctp-surface0, rgba(20, 28, 38, 0.96))) !important; border: 2px solid var(--nh-menu-border, var(--ctp-surface2, rgba(255, 255, 255, 0.12))) !important; border-radius: 0 !important; box-sizing: border-box !important; box-shadow: 0 12px 28px rgba(0, 0, 0, 0.32) !important;',
        ),
        container && contents
            ? rule(contents, 'background: transparent !important; border: none !important; border-radius: 0 !important; box-shadow: none !important;')
            : '',
        rule(header, 'color: var(--ctp-subtext0, #8b929a) !important;'),
        rule(item, 'border-radius: 0 !important; outline: none !important; color: var(--ctp-text, #dcdedf) !important; background: transparent !important;'),
        rule(item && [`${item}::before`, `${item}::after`], 'border-radius: 0 !important; outline: none !important;'),
        rule(
            [
                focused && item && `${item}${focused}`,
                item && `${item}.gpfocus`,
                item && `${item}:focus`,
                item && `${item}.gpfocuswithin`,
                item && `${item}:hover`,
            ],
            'background: var(--ctp-accent-color, #1a9fff) !important; color: var(--ctp-crust, #0b0f14) !important; border-radius: 0 !important; outline: none !important; animation-name: none !important;',
        ),
        rule(sep, 'height: 2px !important; background: var(--nh-menu-border, var(--ctp-surface2, rgba(255, 255, 255, 0.12))) !important;'),
    ]
        .filter(Boolean)
        .join('\n');
}

export function buildFooterCss(footer: ClassMap, scope = ''): string {
    const basic = cls(footer, 'BasicFooter');
    const legend = cls(footer, 'FooterLegend');
    const pill = cls(footer, 'PillShapedIcon');
    const spacer = cls(footer, 'Spacer');
    const qaFooter = cls(footer, 'QuickAccessFooter');
    const withKeyboard = cls(footer, 'WithKeyboard');
    const floatingVr = cls(footer, 'FloatingVRFooter');
    const prefix = scope ? `${scope} ` : '';
    const notMod = [withKeyboard, qaFooter, floatingVr]
        .filter(Boolean)
        .map((sel) => `:not(${sel})`)
        .join('');
    return [
        rule(
            basic && `${prefix}${basic}`,
            'height: 41px !important; min-height: 41px !important; max-height: 41px !important; width: 100% !important; margin-left: 0 !important; margin-right: 0 !important; box-sizing: border-box !important; overflow: hidden !important; background: var(--ctp-mantle, #11161d) !important; border-top: 2px solid var(--ctp-surface2, rgba(255, 255, 255, 0.14)) !important;',
        ),
        rule(
            basic && `${prefix}${basic}${notMod}`,
            'padding-left: 14px !important; padding-right: 14px !important;',
        ),
        rule(
            basic && qaFooter && `${prefix}${basic}${qaFooter}`,
            'padding-left: 10px !important; padding-right: 10px !important;',
        ),
        rule(
            legend && `${prefix}${legend}`,
            'display: flex !important; align-items: center !important; justify-content: flex-start !important; flex-wrap: nowrap !important; gap: 8px !important; width: 100% !important; margin: 0 !important; padding: 3px 0 !important; box-sizing: border-box !important; max-width: 100% !important; min-width: 0 !important; overflow: hidden !important; white-space: nowrap !important; font-size: 12.5px !important; line-height: 1 !important;',
        ),
        rule(
            basic && legend && `${prefix}${basic}${legend}`,
            'padding-left: 14px !important; padding-right: 14px !important;',
        ),
        rule(
            legend && `${prefix}${legend} > *`,
            'display: inline-flex !important; align-items: center !important; flex: 0 0 auto !important; margin-left: 0 !important; margin-right: 0 !important; min-width: 0 !important; max-width: 100% !important; white-space: nowrap !important;',
        ),
        rule(legend && spacer && `${prefix}${legend} ${spacer}`, 'flex: 1 1 auto !important; min-width: 0 !important;'),
        rule(pill && `${prefix}${pill}`, 'height: 26px !important; min-width: 26px !important; flex-shrink: 0 !important;'),
    ]
        .filter(Boolean)
        .join('\n');
}
