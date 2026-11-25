import { SIDE_INSET } from '../home/insets';
import { HERO_FADE_MS } from '../home/motion';

const ANIMATED = /^(transform|opacity)\s*:/;

function rule(selector: string, body: string): string {
    const decls = body
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => (d.startsWith('--') || ANIMATED.test(d) ? d : `${d} !important`));
    return `${selector} { ${decls.join('; ')}; }`;
}

export interface LibraryCssOptions {
    hideStatusBarBackground: boolean;
    cols: number;
    cardW: number;
    cardH: number;
    gap: number;
}

export function libraryCss(options: LibraryCssOptions): string {
    const { hideStatusBarBackground, cols, cardW, cardH, gap } = options;
    return [
        `@keyframes nh-lib-fade { from { opacity: 0; } to { opacity: 1; } }`,
        rule('.nh-lib-root', `--nh-side: ${SIDE_INSET.handheld}px; --nh-top: 52px; --nh-bottom: 46px;
            position: absolute; inset: 0; width: 100%; height: 100%; min-height: 100vh; overflow: hidden; overflow: clip; z-index: 0;
            background: var(--ctp-base, #0e141b); color: var(--ctp-text, #dcdedf); font-family: inherit; text-align: left`),
        rule('.nh-lib-root *', 'box-sizing: border-box'),

        // Reused HeroBackground layers inside CustomLibrary
        rule('.nh-lib-root .gh-hero', 'position: absolute; inset: 0; overflow: hidden; pointer-events: none'),
        rule('.nh-lib-root .gh-hero-layer', `position: absolute; inset: 0; will-change: opacity; animation: nh-lib-fade ${HERO_FADE_MS}ms ease both`),
        rule('.nh-lib-root .gh-hero-layer.gh-hero-settled', 'animation: none; opacity: 1'),
        rule('.nh-lib-root .gh-hero-none', 'background: var(--ctp-base, #0e141b)'),
        rule('.nh-lib-root .gh-hero-full', 'position: absolute; inset: 0; background-size: cover; background-position: center 30%; background-repeat: no-repeat'),
        rule('.nh-lib-root .gh-hero-blur', 'position: absolute; inset: -60px; background-size: cover; background-position: center; filter: blur(42px) saturate(1.2) brightness(.75)'),
        rule('.nh-lib-root .gh-hero-sharp', `position: absolute; right: 0; top: 0; height: 100%; width: 62%; background-size: cover; background-position: center 30%; background-repeat: no-repeat; opacity: .88;
            -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 45%); mask-image: linear-gradient(90deg, transparent 0%, #000 45%)`),

        // Scrims per Library mode
        rule('.nh-lib-scrim', 'position: absolute; inset: 0; pointer-events: none'),
        rule('.nh-lib-mode-grid .nh-lib-scrim', `background: radial-gradient(circle at 65% 25%, rgba(var(--ctp-base-rgb, 14, 20, 27), 0.58) 0%, rgba(var(--ctp-base-rgb, 14, 20, 27), 0.92) 72%),
            linear-gradient(180deg, rgba(var(--ctp-base-rgb, 14, 20, 27), 0.85) 0%, rgba(var(--ctp-base-rgb, 14, 20, 27), 0.72) 55%, rgba(var(--ctp-base-rgb, 14, 20, 27), 0.96) 100%)`),
        rule('.nh-lib-mode-minimal.nh-side-left .nh-lib-scrim', `background: linear-gradient(180deg, rgba(var(--ctp-base-rgb, 8, 11, 15), 0.44) 0px, transparent 80px),
            linear-gradient(90deg, rgba(var(--ctp-base-rgb, 5, 7, 10), 0.88) 0%, rgba(var(--ctp-base-rgb, 5, 7, 10), 0.52) 34%, transparent 62%),
            linear-gradient(0deg, rgba(var(--ctp-base-rgb, 8, 11, 15), 0.75) 0%, transparent 26%)`),
        rule('.nh-lib-mode-minimal.nh-side-right .nh-lib-scrim', `background: linear-gradient(180deg, rgba(var(--ctp-base-rgb, 8, 11, 15), 0.44) 0px, transparent 80px),
            linear-gradient(270deg, rgba(var(--ctp-base-rgb, 5, 7, 10), 0.88) 0%, rgba(var(--ctp-base-rgb, 5, 7, 10), 0.52) 34%, transparent 62%),
            linear-gradient(0deg, rgba(var(--ctp-base-rgb, 8, 11, 15), 0.75) 0%, transparent 26%)`),

        // Top header transparency (strictly #header and #header::before only)
        hideStatusBarBackground ? rule('#header', 'background: transparent; background-image: none') : '',
        hideStatusBarBackground ? rule('#header::before', 'content: none; display: none; background: transparent; background-image: none; opacity: 0') : '',

        // Canvas & safe area
        rule('.nh-lib-canvas', 'position: absolute; left: 0; top: 0; transform-origin: 0 0'),
        rule('.nh-lib-safe', 'position: absolute; left: 0; right: 0; top: var(--nh-top); bottom: var(--nh-bottom)'),

        // ---------------- GRID MODE ----------------
        rule('.nh-lib-grid-shell', `position: absolute; inset: 0; display: flex; flex-direction: column; padding: 8px var(--nh-side) 10px; gap: 12px`),
        rule('.nh-lib-header', 'display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 40px; flex: 0 0 auto'),
        rule('.nh-lib-tabs', 'display: flex; align-items: center; gap: 8px; overflow: hidden; flex: 1 1 auto; min-width: 0'),
        rule('.nh-lib-tab', `display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 0px;
            font-size: 13px; font-weight: 600; white-space: nowrap; color: var(--ctp-subtext0, #8b929a); background: transparent;
            border: 2px solid transparent; outline: none; cursor: pointer; transition: color 140ms, background 140ms, border-color 140ms`),
        rule('.nh-lib-tab-on', `color: var(--ctp-crust, #0b0f14); background: var(--ctp-accent-color, #1a9fff); border-color: var(--ctp-accent-color, #1a9fff); font-weight: 700`),
        rule('.nh-lib-tab-count', 'font-size: 11px; opacity: 0.78'),
        rule('.nh-lib-controls', 'display: flex; align-items: center; gap: 8px; flex: 0 0 auto'),
        rule('.nh-lib-chip', `display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 0px;
            font-size: 12px; font-weight: 600; color: var(--ctp-text, #dcdedf); background: var(--ctp-surface0, rgba(20, 28, 38, 0.88));
            border: 2px solid var(--ctp-surface2, rgba(255, 255, 255, 0.14)); outline: none; cursor: pointer; white-space: nowrap`),
        rule('.nh-lib-chip-on', `border-color: var(--ctp-accent-color, #1a9fff); color: var(--ctp-accent-color, #1a9fff)`),
        rule('.nh-lib-chip svg', 'width: 13px; height: 13px; flex: 0 0 auto'),

        // Virtualized cover grid viewport
        rule('.nh-lib-viewport', 'position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; outline: none; border: none; box-shadow: none'),
        rule('.nh-lib-viewport:focus, .nh-lib-viewport.gpfocus', 'outline: none; border: none; box-shadow: none'),
        rule('.nh-lib-track', `position: absolute; left: 0; right: 0; top: 0; will-change: transform; transition: transform 170ms cubic-bezier(.22, 1, .36, 1)`),
        rule('.nh-lib-row', `position: absolute; left: 0; right: 0; display: grid; justify-content: center; grid-template-columns: repeat(${cols}, ${cardW}px); gap: ${gap}px; height: ${cardH}px`),
        rule('.nh-lib-card', `position: relative; width: ${cardW}px; height: ${cardH}px; border-radius: 0px; overflow: hidden; outline: none;
            background: var(--ctp-surface0, #161e29); border: 2px solid var(--ctp-surface2, rgba(255, 255, 255, 0.12)); cursor: pointer;
            transition: transform 130ms ease, box-shadow 130ms ease, filter 150ms ease, border-color 130ms ease`),
        rule('.nh-lib-root img, .nh-lib-card::after, .nh-lib-tab::after, .nh-lib-chip::after, .nh-lib-min-item::after', 'border-radius: 0px; outline: none'),
        rule('.nh-lib-card-off:not(.nh-lib-card-sel)', 'filter: grayscale(0.85) brightness(0.66)'),
        rule('.nh-lib-card-sel', `border-color: var(--ctp-accent-color, #1a9fff); box-shadow: inset 0 0 0 3px var(--ctp-accent-color, #1a9fff)`),
        rule('.nh-lib-card-art', 'position: absolute; inset: 0; background-size: cover; background-position: center; background-repeat: no-repeat'),
        rule('.nh-lib-card-fallback', `position: absolute; inset: 0; display: flex; align-items: flex-end; padding: 12px;
            background: linear-gradient(160deg, var(--ctp-surface1, #243040) 0%, var(--ctp-mantle, #0e141b) 100%);
            font-size: 13px; font-weight: 700; line-height: 1.25; color: var(--ctp-text, #dcdedf); overflow-wrap: anywhere`),
        rule('.nh-lib-card-badge', `position: absolute; left: 8px; top: 8px; padding: 2px 6px; border-radius: 0px;
            font-size: 9px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
            background: var(--ctp-surface0, rgba(14, 20, 27, 0.88)); color: var(--ctp-text, #dcdedf)`),

        // Bottom info strip in grid mode
        rule('.nh-lib-footer', `display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 28px; flex: 0 0 auto;
            padding-top: 6px; border-top: 1px solid var(--ctp-surface2, rgba(255, 255, 255, 0.1))`),
        rule('.nh-lib-footer-title', 'font-size: 15px; font-weight: 700; color: var(--ctp-text, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis'),
        rule('.nh-lib-footer-meta', 'display: flex; align-items: center; gap: 14px; font-size: 12px; font-weight: 600; color: var(--ctp-subtext0, #8b929a); white-space: nowrap; flex: 0 0 auto'),

        // ---------------- MINIMALIST MODE ----------------
        rule('.nh-lib-min-col', `position: absolute; top: 18px; bottom: 18px; width: 390px; display: flex; flex-direction: column; gap: 10px`),
        rule('.nh-side-left .nh-lib-min-col', 'left: var(--nh-side)'),
        rule('.nh-side-right .nh-lib-min-col', 'right: var(--nh-side)'),
        rule('.nh-lib-min-tabs', 'display: flex; align-items: center; gap: 12px; overflow: hidden; flex: 0 0 auto; padding: 0 6px'),
        rule('.nh-side-right .nh-lib-min-tabs', 'justify-content: flex-end'),
        rule('.nh-lib-min-tab', `font-size: 13px; font-weight: 600; color: var(--ctp-subtext0, rgba(255, 255, 255, 0.55));
            white-space: nowrap; cursor: pointer; padding: 4px 0; border-bottom: 3px solid transparent; transition: color 140ms, border-color 140ms`),
        rule('.nh-lib-min-tab-on', `color: var(--ctp-text, #ffffff); border-bottom-color: var(--ctp-accent-color, #1a9fff); font-weight: 700`),
        rule('.nh-lib-min-sub', `display: flex; align-items: center; gap: 10px; padding: 0 6px; font-size: 11px; font-weight: 600;
            letter-spacing: 0.06em; text-transform: uppercase; color: var(--ctp-subtext0, rgba(255, 255, 255, 0.6)); flex: 0 0 auto`),
        rule('.nh-lib-min-sub-btn', 'cursor: pointer; display: inline-flex; align-items: center; gap: 4px'),
        rule('.nh-lib-min-sub-btn-on', 'color: var(--ctp-accent-color, #1a9fff)'),
        rule('.nh-lib-min-viewport', `position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; outline: none; border: none; box-shadow: none;
            -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 5%, #000 95%, transparent 100%);
            mask-image: linear-gradient(180deg, transparent 0%, #000 5%, #000 95%, transparent 100%)`),
        rule('.nh-lib-min-viewport:focus, .nh-lib-min-viewport.gpfocus', 'outline: none; border: none; box-shadow: none'),
        rule('.nh-lib-min-item', `position: absolute; left: 0; right: 0; height: 42px; padding: 0 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
            border-radius: 0px; outline: none; font-size: 16px; font-weight: 500; color: var(--ctp-subtext0, rgba(255, 255, 255, 0.62));
            background: transparent; cursor: pointer; transition: color 140ms, background 140ms`),
        rule('.nh-side-right .nh-lib-min-item', 'flex-direction: row-reverse; text-align: right'),
        rule('.nh-lib-min-item-name', 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0'),
        rule('.nh-lib-min-item-off:not(.nh-lib-min-item-sel)', 'opacity: 0.5'),
        rule('.nh-lib-min-item-sel', `font-size: 18px; font-weight: 700; color: var(--ctp-text, #ffffff); background: var(--ctp-surface0, rgba(30, 42, 56, 0.8))`),
        rule('.nh-lib-min-focus .nh-lib-min-item-sel', `background: var(--ctp-surface1, rgba(42, 56, 74, 0.92))`),

        // Whisper-quiet metadata in opposite corner (Minimalist mode)
        rule('.nh-lib-min-info', `position: absolute; bottom: 26px; display: flex; flex-direction: column; gap: 4px; pointer-events: none;
            text-shadow: 0 2px 12px rgba(var(--ctp-base-rgb, 0, 0, 0), 0.9)`),
        rule('.nh-side-left .nh-lib-min-info', 'right: var(--nh-side); left: 468px; align-items: flex-end; text-align: right'),
        rule('.nh-side-right .nh-lib-min-info', 'left: var(--nh-side); right: 468px; align-items: flex-start; text-align: left'),
        rule('.nh-lib-min-info-title', 'font-size: 28px; font-weight: 800; line-height: 1.1; color: var(--ctp-text, #ffffff); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap'),
        rule('.nh-lib-min-info-line', 'font-size: 13px; font-weight: 600; color: var(--ctp-subtext0, rgba(255, 255, 255, 0.72))'),

        // Empty state
        rule('.nh-lib-empty', `position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600; color: var(--ctp-subtext0, #8b929a)`),
    ]
        .filter((s) => s.length > 0)
        .join('\n');
}
