import type { GamepadEvent } from '@decky/ui';
import { CSSProperties, RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActionRow, LibraryActionRow, openGameActions } from './ActionRow';
import { pillInset, rowInset, sideInset } from './insets';
import { isTvScreen } from '../styles/screenScale';
import { focusElement, focusElementSettled, openGame, openLibrary } from './homeNav';
import { LOG_PREFIX } from '../constants';
import { useSettings } from '../data/settings';
import { minimalListButton, recentsButton, selectionForButton, type Zone } from './focusZones';
import { rowWheelTarget } from './mouse';
import { useWheelStep } from './useMouse';
import { installMouseMode } from './mouseMode';
import { HeroBackground } from './HeroBackground';
import { neighbourIds } from './heroLayers';
import { HERO_PRELOAD_DELAY_MS, HERO_PRELOAD_RADIUS, RETURN_TIMINGS } from './motion';
import { steamEnterOffCss } from '../styles/theme';
import { legibleAccent } from './accent';
import { findLegendHeight, legendReserve } from './legend';
import { homeCss, stackShift } from './homeCss';
import { noteHome, recentIndexFor, recentRefFor, takeRestore } from './homeMemory';
import { eyebrowText, showEmptyMessage, usableSize } from './homeView';
import { MinimalList } from './MinimalList';
import { RecentsRow } from './RecentsRow';
import { CARD_SCALE_HANDHELD, cardScaleFor, clampFocus, heroIndex, isLibraryFocus, recentsGeometry } from './recentsLayout';
import { useFastCycle } from './fastCycle';
import { noteDisplay } from './artShrink';
import { canvasStyle, homeCanvas } from './scale';
import { OpenExtras } from './OpenExtras';
import { InlineChips, TitleBlock } from './TitleBlock';
import { useBumperSelect, useDirectionSelect, useVerticalDirectionSelect } from './useBumperSelect';
import { useHomeData } from './useHomeData';
import { collectionEyebrow } from './collections';
import { preloadLogos } from './logoArt';
import { tr } from '../i18n/steamText';

interface Size {
    width: number;
    height: number;
}

function useLegendHeight(ref: RefObject<HTMLDivElement | null>, size: Size | null): number | null {
    const [height, setHeight] = useState<number | null>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const measure = () => setHeight((old) => {
            const next = findLegendHeight(el);
            return old === next ? old : next;
        });
        measure();
        const later = [setTimeout(measure, 500), setTimeout(measure, 2000)];
        return () => later.forEach(clearTimeout);
    }, [ref, size?.width, size?.height]);
    return height;
}

function useBoxSize(ref: RefObject<HTMLDivElement | null>): Size | null {
    const [size, setSize] = useState<Size | null>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const view = (el.ownerDocument?.defaultView ?? null) as (Window & { ResizeObserver?: typeof ResizeObserver }) | null;
        const measure = () => {
            try {
                const rect = { width: el.offsetWidth, height: el.offsetHeight };
                if (!usableSize(rect.width, rect.height)) return;
                setSize((old) => (old && old.width === rect.width && old.height === rect.height ? old : { width: rect.width, height: rect.height }));
            } catch {
                // keep the last size
            }
        };
        measure();
        let observer: ResizeObserver | null = null;
        try {
            const Observer = view?.ResizeObserver ?? (typeof ResizeObserver === 'function' ? ResizeObserver : undefined);
            if (Observer) {
                observer = new Observer(() => measure());
                observer.observe(el);
            }
        } catch {
            observer = null;
        }
        if (!observer) {
            try {
                view?.addEventListener('resize', measure);
            } catch {
                // ignore
            }
        }
        return () => {
            try {
                if (observer) observer.disconnect();
                else view?.removeEventListener('resize', measure);
            } catch {
                // window already gone
            }
        };
    }, [ref]);
    return size;
}

export function SpotlightHome() {
    const [recentIndex, setRecentIndex] = useState(0);
    const [restore] = useState(takeRestore);
    const { gameLogo, homeRowStyle, homeLayout, minimalSide, minimalShowDetails, showPlaytime, showHltb, hideStatusBarBackground } = useSettings();
    const showHeroPanel = homeLayout !== 'minimal' || minimalShowDetails;
    const [resolved, setResolved] = useState(restore === null);
    const [restoring, setRestoring] = useState(restore !== null);
    const [back, setBack] = useState(restore !== null);
    useEffect(() => {
        if (!back) return undefined;
        const timer = setTimeout(() => setBack(false), RETURN_TIMINGS.hold);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const enterOff = useMemo(() => (back ? steamEnterOffCss() : ''), [back]);
    const data = useHomeData(recentIndex);
    const focusIndex = clampFocus(data.games.length, recentIndex);
    const onLibrary = isLibraryFocus(data.games.length, focusIndex);

    const [bumperRepeating, setBumperRepeating] = useState(false);
    const [directionRepeating, setDirectionRepeating] = useState(false);
    const [dragRunning, setDragRunning] = useState(false);
    const cycle = useFastCycle(focusIndex, bumperRepeating || directionRepeating || dragRunning);
    const shownAt = heroIndex(data.games.length, cycle.shown);
    const shownGame = shownAt === null ? null : data.games[shownAt] ?? null;
    const heldAccent = useRef(data.accent);
    if (!cycle.holding) heldAccent.current = data.accent;
    const accent = heldAccent.current;

    const [zone, setZone] = useState<Zone>('recents');
    const [focusedOnce, setFocusedOnce] = useState(false);
    const gameIds = useMemo(() => data.games.map((g) => g.appId), [data.games]);

    const heroNeighbours = useMemo(() => (cycle.holding ? [] : neighbourIds(gameIds, focusIndex, HERO_PRELOAD_RADIUS)), [gameIds, focusIndex, cycle.holding]);
    const neighbourKey = heroNeighbours.join(',');
    useEffect(() => {
        if (!gameLogo || heroNeighbours.length === 0) return undefined;
        const timer = setTimeout(() => preloadLogos(heroNeighbours), HERO_PRELOAD_DELAY_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameLogo, neighbourKey]);

    useLayoutEffect(() => {
        if (resolved || !restore || (gameIds.length === 0 && !data.recentsSettled)) return;
        if (gameIds.length > 0) {
            setRecentIndex(recentIndexFor(restore.recent, gameIds));
            setZone(restore.zone === 'actions' ? 'actions' : 'recents');
        } else {
            setRestoring(false);
        }
        setResolved(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolved, gameIds, data.recentsSettled]);

    const rootRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const doc = rootRef.current?.ownerDocument;
        return doc ? installMouseMode(doc) : undefined;
    }, []);

    const lastAction = useRef<HTMLElement | null>(null);
    useLayoutEffect(() => {
        const was = lastAction.current;
        if (!was || was.isConnected || zone !== 'actions') return;
        const buttons = actionButtons();
        lastAction.current = buttons[buttons.length - 1] ?? null;
        focusElement(lastAction.current, 'the last action');
    });

    const actionsRef = useRef<HTMLElement>(null);
    const actionButtons = () => [...(rootRef.current?.querySelectorAll<HTMLElement>('.gh-actions .gh-btn') ?? [])];
    const recentsRef = useRef<HTMLDivElement | null>(null);
    const focusGames = () => focusElement(recentsRef.current, 'the game list');

    const select = (next: number) => {
        if (isLibraryFocus(data.games.length, next)) {
            const [pill] = actionButtons();
            if (pill && !pill.contains(pill.ownerDocument.activeElement)) focusElement(pill, 'the Play pill');
        }
        setRecentIndex(next);
    };

    const bumpers = useBumperSelect(actionsRef, focusIndex, data.games.length, select, setBumperRepeating);
    const directions = useDirectionSelect(recentsRef, focusIndex, data.games.length, setRecentIndex, setDirectionRepeating);
    const verticalDirections = useVerticalDirectionSelect(recentsRef, focusIndex, data.games.length, minimalSide, setRecentIndex, setDirectionRepeating);

    const selectedCard = () =>
        recentsRef.current?.querySelector<HTMLElement>('.gh-cap-sel') ??
        recentsRef.current?.querySelector<HTMLElement>('.nh-min-item-sel') ??
        recentsRef.current?.querySelector<HTMLElement>('.gh-cap-wide') ??
        recentsRef.current;

    const onRecentsButtonDown = (evt: GamepadEvent) => {
        try {
            const isRepeat = Boolean(evt?.detail?.is_repeat);
            const what = recentsButton(Number(evt?.detail?.button), focusIndex, data.games.length, isRepeat);
            if (what === null) return;
            if (what === 'bumper') {
                directions.stop();
                focusElement(actionButtons()[0], 'the Play pill');
                bumpers.onButtonDown(evt);
                return;
            }
            if (what === 'menu') {
                evt.preventDefault?.();
                evt.stopPropagation?.();
                if (!isRepeat && !onLibrary && data.focused) openGameActions(data.focused.appId, selectedCard());
                return;
            }
            directions.onButtonDown(evt);
        } catch (error) {
            console.warn(`${LOG_PREFIX} Home: game card navigation failed`, error);
        }
    };

    const onMinimalButtonDown = (evt: GamepadEvent) => {
        try {
            const isRepeat = Boolean(evt?.detail?.is_repeat);
            const what = minimalListButton(Number(evt?.detail?.button), focusIndex, data.games.length, minimalSide, isRepeat);
            if (what === null) return;
            if (what === 'play') {
                if (!showHeroPanel) return;
                evt.preventDefault?.();
                evt.stopPropagation?.();
                verticalDirections.stop();
                focusElement(actionButtons()[0], 'the Play pill');
                return;
            }
            if (what === 'bumper') {
                if (showHeroPanel) {
                    verticalDirections.stop();
                    focusElement(actionButtons()[0], 'the Play pill');
                    bumpers.onButtonDown(evt);
                    return;
                }
                const nextIdx = selectionForButton(focusIndex, Number(evt?.detail?.button), data.games.length, isRepeat);
                if (nextIdx !== null) {
                    evt.preventDefault?.();
                    evt.stopPropagation?.();
                    setRecentIndex(nextIdx);
                }
                return;
            }
            if (what === 'menu') {
                evt.preventDefault?.();
                evt.stopPropagation?.();
                if (!isRepeat && !onLibrary && data.focused) openGameActions(data.focused.appId, selectedCard());
                return;
            }
            verticalDirections.onButtonDown(evt);
        } catch (error) {
            console.warn(`${LOG_PREFIX} Home: vertical list navigation failed`, error);
        }
    };

    const afterFrames = (run: () => void) => {
        const view = rootRef.current?.ownerDocument?.defaultView;
        if (view?.requestAnimationFrame) view.requestAnimationFrame(() => view.requestAnimationFrame(run));
        else setTimeout(run, 50);
    };

    const lastOpen = useRef(0);
    const onRecentsActivate = () => {
        const now = Date.now();
        if (now - lastOpen.current < 1000) return;
        lastOpen.current = now;
        try {
            if (onLibrary || !data.focused) return openLibrary();
            const appId = data.focused.appId;
            if (cycle.holding) {
                cycle.settle();
                afterFrames(() => openGame(appId, selectedCard()));
                return;
            }
            openGame(appId, selectedCard());
        } catch (error) {
            console.warn(`${LOG_PREFIX} Home: opening the selected game failed`, error);
        }
    };

    const actionRowButtons = {
        onButtonDown: (evt: GamepadEvent) => {
            try {
                if (selectionForButton(focusIndex, Number(evt?.detail?.button), data.games.length) !== null) focusElement(actionButtons()[0], 'the Play pill');
            } catch (error) {
                console.warn(`${LOG_PREFIX} Home: focusing Play for L1/R1 failed`, error);
            }
            bumpers.onButtonDown(evt);
        },
        onButtonUp: bumpers.onButtonUp,
    };

    const recentsNav = {
        preferred: !restoring && !focusedOnce,
        setRef: (el: HTMLDivElement | null) => {
            recentsRef.current = el;
        },
        onFocus: () => {
            setZone('recents');
            setFocusedOnce(true);
        },
        onButtonDown: onRecentsButtonDown,
        onButtonUp: directions.onButtonUp,
        onActivate: onRecentsActivate,
        onSelect: (index: number) => {
            focusGames();
            setRecentIndex(index);
        },
        canStep: () => !rootRef.current?.hasAttribute('data-gh-opening'),
        scale: () => canvasScale(),
        onRun: setDragRunning,
    };

    const minimalNav = {
        preferred: !restoring && !focusedOnce,
        setRef: (el: HTMLDivElement | null) => {
            recentsRef.current = el;
        },
        onFocus: () => {
            setZone('recents');
            setFocusedOnce(true);
        },
        onButtonDown: onMinimalButtonDown,
        onButtonUp: verticalDirections.onButtonUp,
        onActivate: onRecentsActivate,
        onSelect: (index: number) => {
            focusGames();
            setRecentIndex(index);
        },
    };

    const canvasScale = () => {
        const drawn = rootRef.current?.querySelector('.gh-canvas')?.getBoundingClientRect().width ?? 0;
        return drawn > 0 && canvas.logicalWidth > 0 ? drawn / canvas.logicalWidth : canvas.scale;
    };

    const wheelAt = useRef(focusIndex);
    wheelAt.current = focusIndex;
    const onRootWheel = useWheelStep((steps) => {
        if (rootRef.current?.hasAttribute('data-gh-opening')) return;
        const next = rowWheelTarget(wheelAt.current, steps, data.games.length);
        if (next === wheelAt.current) return;
        wheelAt.current = next;
        focusGames();
        setRecentIndex(next);
    });

    const onActionsFocus = (event: { target: EventTarget }) => {
        setZone('actions');
        setFocusedOnce(true);
        try {
            const buttons = actionButtons();
            const at = buttons.findIndex((b) => b.contains(event.target as Node));
            if (at >= 0) {
                lastAction.current = buttons[at];
                noteHome({ action: at });
            }
        } catch {
            // keep the last one
        }
    };

    const onActionsBlur = (event: { relatedTarget: EventTarget | null }) => {
        try {
            if (!actionsRef.current?.contains(event.relatedTarget as Node | null)) bumpers.stop();
        } catch {
            bumpers.stop();
        }
    };

    useEffect(() => {
        if (!resolved) return;
        const recent = recentRefFor(focusIndex, gameIds);
        noteHome(recent ? { zone, recent } : { zone });
    }, [resolved, zone, focusIndex, gameIds]);

    const size = useBoxSize(rootRef);
    const canvas = homeCanvas(size?.width ?? 0, size?.height ?? 0);
    useLayoutEffect(() => {
        if (size) noteDisplay(size.width, size.height, rootRef.current?.ownerDocument?.defaultView?.devicePixelRatio ?? 1, canvas.scale);
    }, [size, canvas.scale]);

    const logicalHeight = size ? size.height / canvas.scale : canvas.logicalHeight;
    const measuredScale = cardScaleFor(size);
    const tv = size ? isTvScreen(size.width, size.height) : false;
    const side = sideInset(tv);
    const scale = measuredScale ?? CARD_SCALE_HANDHELD;
    const legend = legendReserve(useLegendHeight(rootRef, size), canvas.scale);
    const geometry = useMemo(() => recentsGeometry(scale), [scale]);
    const rowViewport = canvas.logicalWidth - 2 * rowInset(side, tv);
    const css = useMemo(() => homeCss(scale, { hideStatusBarBackground }), [scale, hideStatusBarBackground]);
    const game = data.focused;
    const contentUp = measuredScale !== null && resolved;

    const inlineChips = onLibrary
        ? data.libraryChips.filter((c) => c.key === 'games' || c.key === 'installed')
        : data.chips.filter((c) => (showPlaytime && (c.key === 'played' || c.key === 'added')) || (showHltb && c.key === 'hltb'));

    const restoreZone: Zone = restore?.zone === 'actions' ? 'actions' : 'recents';
    useEffect(() => {
        if (contentUp && !restore) focusElementSettled(recentsRef.current, 'the game list');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contentUp]);
    useEffect(() => {
        if (!contentUp || !restoring) return;
        if (restoreZone === 'recents' || !showHeroPanel) {
            focusElementSettled(recentsRef.current, 'the game list');
        } else if (restoreZone === 'actions') {
            const buttons = actionButtons();
            focusElementSettled(buttons[Math.min(Math.max(0, restore?.action ?? 0), Math.max(0, buttons.length - 1))], 'the action');
        }
        setRestoring(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contentUp, restoring]);

    const shiftPx = homeLayout === 'minimal' ? 0 : stackShift(logicalHeight, legend, true);
    const minimalViewportH = Math.max(240, logicalHeight - 52 - legend - 56);

    return (
        <div
            ref={rootRef}
            className={`gh-root nh-layout-${homeLayout}${homeLayout === 'minimal' ? ` nh-side-${minimalSide}` : ''}${back ? ' gh-back' : ''}`}
            onWheel={onRootWheel}
            style={{
                '--glance-accent': accent,
                '--glance-accent-text': legibleAccent(accent),
                '--gh-dim': 0,
                '--gh-side': `${side}px`,
                '--gh-row': `${rowInset(side, tv)}px`,
                '--gh-pill': `${pillInset(tv)}px`,
                '--gh-bottom': `${legend}px`,
                '--gh-shift': `${shiftPx}px`,
            } as CSSProperties}
        >
            <style>{css}</style>
            {enterOff && <style>{enterOff}</style>}
            <HeroBackground appId={resolved ? shownGame?.appId ?? null : null} detailsVersion={data.detailsVersion} neighbours={heroNeighbours} />
            <div className="gh-hero-open" />
            <div className="gh-scrim gh-scrim-dim" />
            <div className="gh-scrim gh-scrim-page" />
            <div className="gh-canvas" style={canvasStyle(canvas, logicalHeight, Boolean(size))}>
                {showHeroPanel && (
                    <>
                        <div className="gh-open-shell" data-i="0" />
                        <div className="gh-open-shell" data-i="1" />
                    </>
                )}
                <div className="gh-safe">
                    <div className="gh-page">
                        {!contentUp ? null : game ? (
                            <>
                                {showHeroPanel && (
                                    <section className="gh-title-block" ref={actionsRef} onFocus={onActionsFocus} onBlur={onActionsBlur}>
                                        {onLibrary ? (
                                            <TitleBlock eyebrow={eyebrowText(null, true)} title={tr('viewLibrary')} />
                                        ) : (
                                            <TitleBlock
                                                eyebrow={collectionEyebrow(data.rowCollection, eyebrowText(data.lastPlayedLabel, false, data.focusedIsNew, data.rowCollection !== null))}
                                                title={game.name}
                                                appId={game.appId}
                                                logo={gameLogo}
                                                version={data.detailsVersion}
                                                resolve={!cycle.holding}
                                            />
                                        )}
                                        <div className="gh-action-bar">
                                            <ActionRow
                                                game={onLibrary ? null : game}
                                                running={data.focusedRunning}
                                                download={data.download}
                                                status={data.pillStatus}
                                                preferred={!restoring && focusedOnce}
                                                buttons={actionRowButtons}
                                                onBack={focusGames}
                                                sideBackButton={homeLayout === 'minimal' ? (minimalSide === 'left' ? 11 : 12) : undefined}
                                                onSideBack={focusGames}
                                            />
                                            <InlineChips chips={inlineChips} />
                                        </div>
                                    </section>
                                )}
                                {homeLayout === 'minimal' ? (
                                    <MinimalList
                                        games={data.games}
                                        selected={focusIndex}
                                        side={minimalSide}
                                        viewportHeight={minimalViewportH}
                                        nav={minimalNav}
                                    />
                                ) : (
                                    <RecentsRow
                                        games={data.games}
                                        selected={focusIndex}
                                        geometry={geometry}
                                        nav={recentsNav}
                                        rowStyle={homeRowStyle}
                                        viewport={rowViewport}
                                        expand={!cycle.narrow}
                                        snap={cycle.holding}
                                    />
                                )}
                            </>
                        ) : showEmptyMessage(data.games.length, data.recentsSettled) ? (
                            <div className="gh-empty">
                                <LibraryActionRow preferred />
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
            {showHeroPanel && game && !cycle.holding && (
                <OpenExtras
                    description={data.description}
                    hltb={data.hltb}
                    playedMinutes={data.playedMinutes}
                    locale={data.locale}
                    playedMissing={data.focusedIsNew && inlineChips.some((c) => c.key === 'added')}
                />
            )}
        </div>
    );
}
