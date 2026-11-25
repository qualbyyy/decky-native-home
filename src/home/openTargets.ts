import { PAGE_LAYOUT, pageDUnit, STEAM_LEGEND_PX } from '../styles/themeCss';

/**
 * Where the Native Home page (restyled, Spotlight or Clean look) puts the things Spotlight Home morphs into during the
 * open transition, for a Big Picture window of a given size. Built from the same constants as the page's theme
 * (themeCss.PAGE_LAYOUT), so the two cannot drift apart; checked against layouts measured on the device
 * (tests/home/fixtures/openLayout). CSS px of the Big Picture window. Pure.
 */

export type PageLook = 'spotlight' | 'clean';
export interface Box { x: number; y: number; w: number; h: number }
export type StatKey = 'size' | 'played' | 'achievements' | 'hltb';
/** One of the page's stat columns, in page order; `bar`: the column has a progress bar under its value (Clean). */
export interface PageStat { key: StatKey; label: string; value: string; bar?: boolean }
export interface PageTargets {
    /** The title's bottom-left corner (it grows upward), and the eyebrow's under it. */
    titleBottomLeft: { x: number; y: number };
    eyebrowBottomLeft: { x: number; y: number };
    play: Box;
    /** Circle slots 0..3 after the Play pill. */
    circles: Box[];
    /** The store pill, right-aligned (its size is the given one). */
    store: Box;
    /** Spotlight: [info card, HowLongToBeat card]; Clean: [panel]. On whole device px, as Chromium draws a card's edges. */
    shells: Box[];
    /**
     * The same cards where the page lays them out, unsnapped: each is a compositing layer on the page, and text inside one
     * is snapped from its origin, so the open's layers for card text sit here (openTwins.TwinSpec.card). Absent: shells.
     */
    cards?: Box[];
    /** The page's d unit (CSS px per handoff px), exactly as its --gg-d. Absent: Home's canvas scale. */
    d?: number;
    /** Each stat's label and value; on Clean, the progress bar under a stat that has one. */
    stats: Partial<Record<StatKey, { label: Box; value: Box; bar?: Box }>>;
    /** Spotlight look, when asked for: the description and the rest of the HowLongToBeat card. */
    extras?: PageExtras;
}
/** One of the HowLongToBeat card's columns after Main (Spotlight look), with the texts it shows. */
export interface ExtraColumn { key: 'mainExtras' | 'completionist'; label: string; value: string }
/** What Spotlight Home draws as it turns into the page's Spotlight look, besides the stats: the cards' other parts. */
export interface ExtrasAsked {
    /** The HowLongToBeat card's columns after Main, in order. */
    columns: ExtraColumn[];
    /** Whether the card has a progress bar (not when the game was never played); its caption follows it. */
    bar: boolean;
}
export interface PageExtras {
    /** The info card's description: three lines (it is clamped to them). */
    desc: Box;
    /** The HowLongToBeat card's title label. */
    hltbTitle: Box;
    columns: Partial<Record<ExtraColumn['key'], { label: Box; value: Box }>>;
    bar?: Box;
    caption: Box;
}
/** A text's width in CSS px as the page draws it: a stat label (uppercase, its letter spacing), a card value or a Clean value. */
export type Measure = (text: string, role: 'label' | 'value' | 'cleanValue', fontPx: number) => number;

/**
 * The cards' and the Clean panel's ring (1 d unit, as Home's: themeCss) as Chromium draws it at `dpr` device px per CSS
 * px: a whole number of device px, at least one (1 at the Ally's 2.32 and d 0.575, so 0.431 CSS px). CSS px; the d unit
 * itself when the ratio is not known.
 */
export function cardBorder(dpr: number | undefined, d: number): number {
    return dpr && dpr > 0 ? Math.max(1, Math.floor(d * dpr)) / dpr : d;
}
/**
 * The page's line heights, as Home's open transition draws the same texts: values are set to 1.2 (themeCss); labels and
 * the HowLongToBeat caption keep Steam's 'normal', the font's own line, rounded to whole device px. That came to 1.5 for
 * the labels at 16:9 docked, but about 1.43 at 21:9, where a 1.5 stood each label row 0.6 px taller than the page's and
 * the text under it landed lower (Ally, emulated 1500x644).
 */
export const PAGE_LINES = { label: 'normal', value: 1.2, caption: 'normal' } as const;
/** A 'normal' line's height in CSS px for a role's font size, measured in Home's document (openHome.lineMeasure); 0: unknown. */
export type LineMeasure = (role: 'label' | 'caption', fontPx: number) => number;
/** Without a measure: the lines as measured at 16:9 docked. */
const VALUE_LINE = PAGE_LINES.value;

export function pageTargets(
    look: PageLook, screen: { width: number; height: number; dpr?: number }, _stats: PageStat[], _measure: Measure, storeSize: { w: number; h: number }, _asked?: ExtrasAsked,
    _lines?: LineMeasure,
): PageTargets {
    const L = PAGE_LAYOUT;
    const W = screen.width;
    const H = screen.height;
    const d = pageDUnit(W, H);
    const isMin = look === 'clean';
    const playW = isMin ? 216 : 264;
    const icon = isMin ? 46 : 52;
    const gap = isMin ? 10 : 12;
    const titleGap = isMin ? 20 : 24;
    const tv = W >= L.tvQuery.minWidth && H >= L.tvQuery.minHeight;
    const side = (tv ? L.side.tv : L.side.base) * d;
    const playTop = H - STEAM_LEGEND_PX - (isMin ? 76 : 266) * d;

    const play: Box = { x: side, y: playTop, w: playW * d, h: icon * d };
    const circles = [0, 1, 2, 3].map((i) => ({ x: side + (playW + gap + i * (icon + gap)) * d, y: playTop, w: icon * d, h: icon * d }));

    const blockBottom = playTop - titleGap * d;
    const metaH = (isMin ? 18 : L.titleBlock.eyebrow * VALUE_LINE) * d;
    const titleInnerGap = (isMin ? 10 : 12) * d;
    const eyebrowBottomLeft = { x: side, y: blockBottom };
    const titleBottomLeft = { x: side, y: blockBottom - metaH - titleInnerGap };

    const store: Box = { x: W - side - storeSize.w, y: playTop - storeSize.h, w: storeSize.w, h: storeSize.h };
    return { titleBottomLeft, eyebrowBottomLeft, play, circles, store, shells: [], cards: [], d, stats: {} };
}

/** The page card (`cards`: PageTargets.shells) that point `p` is in, edges included, or null. Pure. */
export function cardAround(cards: Box[], p: { x: number; y: number }): Box | null {
    return cards.find((c) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) ?? null;
}
