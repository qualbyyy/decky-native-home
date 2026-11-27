import {
    achievementListClasses,
    appDetailsClasses,
    appDetailsHeaderClasses,
    basicAppDetailsSectionStylerClasses,
    findClassModule,
    gamepadDialogClasses,
    gamepadTabbedPageClasses,
    playSectionClasses,
} from '@decky/ui';
import { LOG_PREFIX } from '../constants';
import { arrivalSelectors, buildAccentCss, steamFooterSelector, buildArrivingCss, buildSteamEnterOffCss, buildCleanCss, buildDownloadCss, buildLaunchCss, buildRingCss, buildThemeCss, buildUnifideckCss, ClassMap, launchTargets, playRowSelector, ringBoost, ThemeClasses, ThemeOptions, twinTargets } from './themeCss';
import { viewportSize } from '../home/openHome';
import type { ReadySelectors } from './pageReady';

let classes: Partial<ThemeClasses> = {};

function safeFind(filter: (m: Record<string, string>) => boolean): ClassMap {
    try {
        return (findClassModule(filter) || undefined) as ClassMap;
    } catch (error) {
        console.warn(`${LOG_PREFIX} class module lookup failed`, error);
        return undefined;
    }
}

function validMap(mod: unknown, key: string): ClassMap {
    const map = mod as ClassMap | undefined;
    const val = map?.[key];
    return typeof val === 'string' && val.length > 0 ? map : undefined;
}

/** Steam's class maps, lazily resolved per field so early Home calls never freeze missing modules. */
function themeClasses(): ThemeClasses {
    classes.header ??= validMap(appDetailsHeaderClasses, 'TopCapsule') ?? safeFind((m) => Boolean(m.TopCapsule));
    classes.details ??=
        validMap(appDetailsClasses, 'InnerContainer') ??
        safeFind((m) => Boolean(m.HeaderLoaded && m.InnerContainer)) ??
        safeFind((m) => Boolean(m.InnerContainer && m.AppDetailsOverviewPanel));
    classes.play ??=
        validMap(playSectionClasses, 'MenuButton') ??
        safeFind((m) => Boolean(m.PlayBarDetailLabel)) ??
        safeFind((m) => Boolean(m.MenuButton && m.CloudStatusRow));
    classes.root ??=
        validMap(basicAppDetailsSectionStylerClasses, 'AppDetailsRoot') ??
        safeFind((m) => Boolean(m.AppDetailsRoot && m.PlaySection && m.AppDetailsContainer)) ??
        safeFind((m) => Boolean(m.PlaySection && m.ActionRow));
    classes.feedback ??=
        validMap(classes.root, 'DeckVerifiedFeedbackContainer') ??
        validMap(basicAppDetailsSectionStylerClasses, 'DeckVerifiedFeedbackContainer') ??
        safeFind((m) => Boolean(m.DeckVerifiedFeedbackContainer || m.DeckVerifiedFeedbackConfirmationContainer));
    classes.overview ??= safeFind((m) => Boolean(m.Backdrop && m.BackdropGlass));
    classes.launch ??= safeFind((m) => Boolean(m.Container && m.ConfigurationHeader && m.ControlOverviewContainer));
    classes.shared ??= safeFind((m) => Boolean(m.SharedLibrary && m.Row)) ?? safeFind((m) => Boolean(m.SharedLibrary)) ?? classes.play;
    classes.transition ??= safeFind((m) => Boolean(m.TopLevelTransition && m.Enter && m.EnterActive));
    classes.footer ??= safeFind((m) => Boolean(m.BasicFooter && m.FooterLegend));
    classes.tabbedPage ??=
        validMap(gamepadTabbedPageClasses, 'GamepadTabbedPage') ??
        safeFind((m) => Boolean(m.GamepadTabbedPage && m.TabRow));
    classes.section ??= safeFind((m) => Boolean(m.AppDetailsSection && m.AppDetailsSectionContainer));
    classes.activity ??= safeFind((m) => Boolean(m.ActivityFeedContainer && m.InnerContainer));
    classes.event ??= safeFind((m) => Boolean(m.Event && m.EventHeadline && m.EventBody));
    classes.deckVerified ??= safeFind((m) => Boolean(m.DeckVerifiedInfo && m.Details));
    classes.achievements ??=
        validMap(achievementListClasses, 'AchievementListItemBase') ??
        safeFind((m) => Boolean(m.AchievementListItemBase));
    classes.achProgress ??= safeFind((m) => Boolean(m.AchievementProgressContainer && m.AchievementProgress));
    classes.summaryCarousel ??= safeFind((m) => Boolean(m.SummaryCarouselContainer));
    classes.friendsSection ??= safeFind((m) => Boolean(m.FriendsSectionPlayingNow || m.PlayingNowBody));
    classes.community ??= safeFind((m) => Boolean(m.CommunityItem));
    classes.dialog ??=
        validMap(gamepadDialogClasses, 'DialogButton') ??
        safeFind((m) => Boolean(m.DialogButton && m.GamepadDialogContent));
    return classes as ThemeClasses;
}

export function innerContainerClass(): string | undefined {
    return themeClasses().details?.InnerContainer;
}

export function overviewPanelClass(): string | undefined {
    return themeClasses().details?.AppDetailsOverviewPanel;
}

export function themeCss(options?: ThemeOptions): string {
    return buildThemeCss(themeClasses(), options);
}

/** The page's glass rings as bright as Home's on this window's screen (themeCss.ringBoost). */
export function ringCss(win: Parameters<typeof viewportSize>[0]): string {
    const { width, height, dpr } = viewportSize(win);
    return buildRingCss(ringBoost(dpr ?? 0, width, height));
}

/** The game's accent for the restyled page (Spotlight Home on); '' if the colour or Steam's class is unusable. */
export function accentCss(color: string): string {
    return buildAccentCss(themeClasses(), color);
}

/** The restyled Play pill's download fill (and Steam's bar hidden); '' without a percent. */
export function downloadCss(percent: number | null): string {
    return buildDownloadCss(themeClasses(), percent);
}

/** The page's look while Steam's launch overlay is up (themeCss.buildLaunchCss); '' if the overlay's class is unknown. */
export function launchCss(): string {
    return buildLaunchCss(themeClasses());
}

/** The launch overlay's selector and what hides under it (themeCss.launchTargets). */
export function launchSelectors(): { overlay: string | null; hide: string[] } {
    return launchTargets(themeClasses());
}

/** The layout on a Unifideck game's page (themeCss.buildUnifideckCss); '' without the layout's classes. */
export function unifideckCss(options?: ThemeOptions): string {
    return buildUnifideckCss(themeClasses(), options);
}

/** The Native Home page's Clean look (themeCss.buildCleanCss); '' without the layout's classes. */
export function cleanCss(): string {
    return buildCleanCss(themeClasses());
}

/** The page arriving after Spotlight Home's open transition (themeCss.buildArrivingCss); '' without the layout's classes. */
export function arrivingCss(look: 'spotlight' | 'clean', mode: 'parts' | 'all', revealed = false, extra: Parameters<typeof buildArrivingCss>[4] = {}): string {
    return buildArrivingCss(themeClasses(), look, mode, revealed, extra);
}

/** What the page's ready check reads (themeCss.arrivalSelectors). */
export function pageArrivalSelectors(): ReadySelectors {
    return arrivalSelectors(themeClasses());
}

/** Steam's page-enter fade switched off (themeCss.buildSteamEnterOffCss), for the open transition's bridge. */
export function steamEnterOffCss(): string {
    return buildSteamEnterOffCss(themeClasses());
}

/** Steam's footer (themeCss.steamFooterSelector), which the open transition's bridge copies. */
export function steamFooter(): string | null {
    return steamFooterSelector(themeClasses());
}

/** Steam's Play row on the game page (themeCss.playRowSelector), for logic/cardNav; null without its classes. */
export function playRow(): string | null {
    return playRowSelector(themeClasses());
}

/** Each open-transition text twin's counterpart on the page (themeCss.twinTargets). */
export function pageTwinTargets(look: 'spotlight' | 'clean' | 'steam'): Record<string, string> {
    return twinTargets(themeClasses(), look);
}
