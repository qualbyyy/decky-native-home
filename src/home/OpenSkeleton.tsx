import { FaCog, FaGamepad, FaPlay } from 'react-icons/fa';
import { LOG_PREFIX } from '../constants';
import { onOpenReady } from '../data/openIntent';
import { tr } from '../i18n/steamText';
import { PAGE_SCRIMS, STEAM_TOP_GRADIENT } from '../styles/themeCss';
import { BRIDGE_FADE_EASE } from './openBridge';
import { OPEN_TIMINGS } from './motion';
import { viewportSize } from './openHome';
import { PageLook, pageTargets } from './openTargets';
import type { OpenBridge } from './openTransition';

const GAMEPAD_PATH =
    'M6 8h12a4 4 0 0 1 3.9 4.88l-1.1 4.8A2.5 2.5 0 0 1 16.4 19a2.5 2.5 0 0 1-2-.95L13.2 16.5h-2.4l-1.2 1.55a2.5 2.5 0 0 1-2 .95 2.5 2.5 0 0 1-2.4-1.82l-1.1-4.8A4 4 0 0 1 6 8Zm2.25 3a.75.75 0 0 0-.75.75v1h-1a.75.75 0 0 0 0 1.5h1v1a.75.75 0 0 0 1.5 0v-1h1a.75.75 0 0 0 0-1.5h-1v-1a.75.75 0 0 0-.75-.75Zm8.25.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-2 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z';
const GEAR_PATH =
    'M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 14.4 2h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.61.22L3.16 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.61.22l2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54c.05.24.25.42.49.42h3.84c.24 0 .44-.18.49-.42l.36-2.54c.58-.23 1.13-.55 1.63-.94l2.39.96c.22.09.48 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z';
const PLAY_PATH = 'M8 5.14v13.72a.75.75 0 0 0 1.14.64l10.6-6.86a.75.75 0 0 0 0-1.28L9.14 4.5A.75.75 0 0 0 8 5.14Z';

/**
 * Companion square action-button skeletons (Controller + Settings) + optional dock skeleton
 * rendered during Home's morph transition into the Game Page.
 */
export function OpenMorphSkeleton({ minimalDetails }: { minimalDetails: boolean }) {
    return (
        <>
            {!minimalDetails && (
                <div className="gh-open-shell" data-i="0" aria-hidden="true">
                    <div className="gh-open-shell-col">
                        <span className="gh-open-line is-kicker" />
                        <span className="gh-open-line is-main" />
                        <span className="gh-open-line is-sub" />
                    </div>
                    <div className="gh-open-shell-col">
                        <span className="gh-open-line is-kicker" />
                        <span className="gh-open-line is-card" />
                    </div>
                </div>
            )}
            <div className="gh-open-circle gh-open-slot-0" aria-hidden="true">
                <FaGamepad />
            </div>
            <div className="gh-open-circle gh-open-slot-1" aria-hidden="true">
                <FaCog />
            </div>
        </>
    );
}

function createSkeletonLine(doc: Document, width: string, heightPx: number, bg: string): HTMLDivElement {
    const el = doc.createElement('div');
    Object.assign(el.style, {
        width,
        height: `${heightPx}px`,
        borderRadius: '0px',
        background: bg,
    });
    return el;
}

function createIconSvg(doc: Document, pathData: string, sizePx: number): SVGSVGElement {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', `${sizePx}`);
    svg.setAttribute('height', `${sizePx}`);
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);
    return svg;
}

/**
 * Standalone Game-Page transition skeleton overlay (Play pill + 2 square Controller & Settings icon buttons +
 * optional Full dock placeholder) used when opening from pure Minimalist Home or Custom Library.
 */
export function mountOpenSkeletonOverlay(
    root: HTMLElement,
    appId: number,
    look: PageLook,
    title: string,
    heroUrl: string | null,
    enterOffCss = '',
): { cleanup: () => void } {
    const doc = root.ownerDocument;
    const win = doc?.defaultView;
    const parent = doc?.body;
    if (!doc || !win || !parent) return { cleanup: () => undefined };

    const screen = viewportSize(win);
    if (screen.width <= 0 || screen.height <= 0) return { cleanup: () => undefined };
    const targets = pageTargets(look, screen, [], () => 0, { w: 0, h: 0 }, undefined, undefined, false);
    const d = targets.d ?? 1;
    const isMin = look === 'clean';

    const box = doc.createElement('div');
    Object.assign(box.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '99998',
        pointerEvents: 'none',
        overflow: 'hidden',
        background: 'var(--ctp-base, #0e141b)',
        opacity: '0',
        transition: 'opacity 140ms ease-out',
    });
    box.setAttribute('aria-hidden', 'true');

    if (enterOffCss) {
        const style = doc.createElement('style');
        style.textContent = enterOffCss;
        box.appendChild(style);
    }

    if (heroUrl) {
        const bg = doc.createElement('div');
        Object.assign(bg.style, {
            position: 'absolute',
            inset: '0',
            backgroundImage: `url("${heroUrl.replace(/"/g, '%22')}")`,
            backgroundSize: 'cover',
            backgroundPosition: '50% 30%',
            backgroundRepeat: 'no-repeat',
        });
        box.appendChild(bg);
    }

    const scrim = doc.createElement('div');
    Object.assign(scrim.style, {
        position: 'absolute',
        inset: '0',
        background: `${STEAM_TOP_GRADIENT}, ${PAGE_SCRIMS}`,
    });
    box.appendChild(scrim);

    if (title) {
        const heading = doc.createElement('div');
        heading.textContent = title;
        Object.assign(heading.style, {
            position: 'absolute',
            left: `${targets.titleBottomLeft.x}px`,
            top: `${targets.titleBottomLeft.y}px`,
            transform: 'translateY(-100%)',
            maxWidth: `${(isMin ? 780 : 660) * d}px`,
            fontSize: `${(isMin ? 44 : 56) * d}px`,
            fontWeight: '800',
            lineHeight: '1.05',
            color: 'var(--ctp-text, #ffffff)',
            textShadow: `0 ${2 * d}px ${18 * d}px rgba(0, 0, 0, 0.72)`,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
        });
        box.appendChild(heading);
    }

    // Play pill skeleton
    const playEl = doc.createElement('div');
    Object.assign(playEl.style, {
        position: 'absolute',
        left: `${targets.play.x}px`,
        top: `${targets.play.y}px`,
        width: `${targets.play.w}px`,
        height: `${targets.play.h}px`,
        display: 'flex',
        alignItems: 'center',
        gap: `${12 * d}px`,
        padding: `0 ${20 * d}px`,
        boxSizing: 'border-box',
        borderRadius: '0px',
        background: 'var(--ctp-accent-color, #1a9fff)',
        color: 'var(--ctp-crust, #0b0f14)',
        fontSize: `${(isMin ? 17 : 19) * d}px`,
        fontWeight: '700',
        boxShadow: `0 0 0 ${2 * d}px var(--ctp-accent-color, rgba(255, 255, 255, 0.9))`,
    });
    playEl.appendChild(createIconSvg(doc, PLAY_PATH, Math.round((isMin ? 17 : 18) * d)));
    const playLabel = doc.createElement('span');
    playLabel.textContent = tr('play');
    playEl.appendChild(playLabel);
    box.appendChild(playEl);

    // 2 square utility icon skeletons (Controller + Settings)
    const utilityBg = isMin ? 'rgba(var(--ctp-base-rgb, 14, 20, 27), 0.46)' : 'var(--ctp-surface0, rgba(20, 28, 38, 0.88))';
    const utilityBorder = isMin ? 'rgba(255, 255, 255, 0.16)' : 'var(--ctp-surface2, rgba(255, 255, 255, 0.16))';
    const iconPx = Math.round((isMin ? 20 : 22) * d);
    const icons = [GAMEPAD_PATH, GEAR_PATH];
    icons.forEach((pathData, idx) => {
        const slot = targets.circles[idx];
        if (!slot) return;
        const btn = doc.createElement('div');
        Object.assign(btn.style, {
            position: 'absolute',
            left: `${slot.x}px`,
            top: `${slot.y}px`,
            width: `${slot.w}px`,
            height: `${slot.h}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            borderRadius: '0px',
            background: utilityBg,
            border: `${Math.max(1, Math.round(d))}px solid ${utilityBorder}`,
            color: 'var(--ctp-text, #ffffff)',
        });
        btn.appendChild(createIconSvg(doc, pathData, iconPx));
        box.appendChild(btn);
    });

    // Full Game Page split-dock skeleton below Play row
    const dock = targets.shells[0];
    if (!isMin && dock) {
        const dockEl = doc.createElement('div');
        Object.assign(dockEl.style, {
            position: 'absolute',
            left: `${dock.x}px`,
            top: `${dock.y}px`,
            width: `${dock.w}px`,
            height: `${Math.min(dock.h, 196 * d)}px`,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.12fr) minmax(0, 0.88fr)',
            gap: `${18 * d}px`,
            alignContent: 'start',
            padding: `${14 * d}px ${18 * d}px`,
            boxSizing: 'border-box',
            borderRadius: '0px',
            background: 'var(--ctp-surface0, rgba(20, 28, 38, 0.88))',
            border: `${Math.max(1, Math.round(d))}px solid var(--ctp-surface2, rgba(255, 255, 255, 0.14))`,
            borderLeft: `${Math.max(2, Math.round(3 * d))}px solid var(--ctp-accent-color, #1a9fff)`,
        });
        const leftCol = doc.createElement('div');
        Object.assign(leftCol.style, { display: 'flex', flexDirection: 'column', gap: `${10 * d}px`, minWidth: '0' });
        leftCol.append(
            createSkeletonLine(doc, '32%', 10 * d, 'var(--ctp-surface2, rgba(255, 255, 255, 0.14))'),
            createSkeletonLine(doc, '86%', 14 * d, 'var(--ctp-surface1, rgba(255, 255, 255, 0.1))'),
            createSkeletonLine(doc, '64%', 12 * d, 'var(--ctp-surface1, rgba(255, 255, 255, 0.08))'),
        );
        const rightCol = doc.createElement('div');
        Object.assign(rightCol.style, { display: 'flex', flexDirection: 'column', gap: `${10 * d}px`, minWidth: '0' });
        rightCol.append(
            createSkeletonLine(doc, '40%', 10 * d, 'var(--ctp-surface2, rgba(255, 255, 255, 0.14))'),
            createSkeletonLine(doc, '100%', 58 * d, 'var(--ctp-surface1, rgba(255, 255, 255, 0.08))'),
        );
        dockEl.append(leftCol, rightCol);
        box.appendChild(dockEl);
    }

    parent.appendChild(box);
    win.requestAnimationFrame(() => {
        box.style.opacity = '1';
    });

    let done = false;
    let stopReady: (() => void) | null = null;
    let capTimer: ReturnType<typeof setTimeout> | null = null;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
        if (done) return;
        done = true;
        stopReady?.();
        stopReady = null;
        if (capTimer !== null) clearTimeout(capTimer);
        if (fadeTimer !== null) clearTimeout(fadeTimer);
        box.remove();
    };

    const dismiss = () => {
        if (done) return;
        stopReady?.();
        stopReady = null;
        if (capTimer !== null) {
            clearTimeout(capTimer);
            capTimer = null;
        }
        box.style.transition = `opacity ${OPEN_TIMINGS.bridgeFade}ms ${BRIDGE_FADE_EASE}`;
        box.style.opacity = '0';
        fadeTimer = setTimeout(cleanup, OPEN_TIMINGS.bridgeFade);
    };

    try {
        stopReady = onOpenReady((id) => {
            if (id === appId) dismiss();
        });
    } catch (error) {
        console.warn(`${LOG_PREFIX} OpenSkeleton: ready listener failed`, error);
    }
    capTimer = setTimeout(dismiss, OPEN_TIMINGS.readyCap);

    return { cleanup };
}

export function skeletonBridgeForTransition(
    root: HTMLElement,
    appId: number,
    look: PageLook,
    title: string,
    heroUrl: string | null,
    enterOffCss = '',
): OpenBridge {
    let overlay: { cleanup: () => void } | null = null;
    const ensure = () => {
        overlay ??= mountOpenSkeletonOverlay(root, appId, look, title, heroUrl, enterOffCss);
    };
    ensure();
    return {
        fadeIn: () => ensure(),
        fadeOut: () => undefined,
        remove: () => overlay?.cleanup(),
    };
}
