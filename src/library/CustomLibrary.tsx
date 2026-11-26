import { Focusable, Navigation } from '@decky/ui';
import type { GamepadEvent } from '@decky/ui';
import { CSSProperties, memo, MouseEvent, RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FaFilter, FaSortAmountDown } from 'react-icons/fa';
import { LOG_PREFIX } from '../constants';
import { markOpen } from '../data/openIntent';
import { useSettings } from '../data/settings';
import { openGameActions } from '../home/ActionRow';
import { HeroBackground } from '../home/HeroBackground';
import { browserStores, capsuleUrls } from '../home/artwork';
import { focusElementSettled } from '../home/homeNav';
import { sideInset } from '../home/insets';
import { findLegendHeight, legendReserve } from '../home/legend';
import { RETURN_TIMINGS } from '../home/motion';
import { installMouseMode } from '../home/mouseMode';
import { homeMode } from '../home/mode';
import { gameStepSound, playNavSound } from '../home/navSound';
import { formatLastPlayed } from '../home/recents';
import { canvasStyle, homeCanvas } from '../home/scale';
import { useWheelStep } from '../home/useMouse';
import { useAsync } from '../hooks/useAsync';
import { useSettled } from '../hooks/useSettled';
import { isRussianSystem, tr } from '../i18n/steamText';
import { formatHours, minutesToHours, steamLanguageToLocale } from '../logic/format';
import { getSteamLanguage, peekSteamLanguage } from '../data/steam';
import { isTvScreen } from '../styles/screenScale';
import { steamEnterOffCss } from '../styles/theme';
import { libraryCss } from './libraryCss';
import {
    filterAndSortLibraryGames,
    LibraryGame,
    librarySortLabel,
    librarySortShortLabel,
    LibrarySort,
    LibraryTabId,
    nextLibrarySort,
    readLibrarySnapshot,
} from './libraryData';
import { markLibraryLeaving, noteLibraryMemory, readLibraryMemory, takeLibraryReturn } from './libraryMemory';
import { libraryButtonAction, visibleRowRange } from './libraryNav';

interface Size {
    width: number;
    height: number;
}

const MIN_ITEM_H = 42;
const MIN_ITEM_GAP = 4;
const MIN_PITCH = MIN_ITEM_H + MIN_ITEM_GAP;

function useBoxSize(ref: RefObject<HTMLDivElement | null>): Size | null {
    const [size, setSize] = useState<Size | null>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const view = (el.ownerDocument?.defaultView ?? null) as (Window & { ResizeObserver?: typeof ResizeObserver }) | null;
        const measure = () => {
            try {
                const w = el.offsetWidth;
                const h = el.offsetHeight;
                if (w > 200 && h > 200) {
                    setSize((old) => (old && old.width === w && old.height === h ? old : { width: w, height: h }));
                }
            } catch {
                // keep last measured size
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
                // ignore
            }
        };
    }, [ref]);
    return size;
}

function useViewportHeight(ref: RefObject<HTMLDivElement | null>, dep: unknown): number {
    const [height, setHeight] = useState(0);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const measure = () => {
            const h = el.clientHeight;
            if (h > 0) setHeight((old) => (old === h ? old : h));
        };
        measure();
        const view = el.ownerDocument?.defaultView;
        const RO = view?.ResizeObserver ?? (typeof ResizeObserver !== 'undefined' ? ResizeObserver : undefined);
        let observer: ResizeObserver | null = null;
        if (RO) {
            observer = new RO(measure);
            observer.observe(el);
        } else {
            view?.addEventListener('resize', measure);
        }
        const t = setTimeout(measure, 80);
        return () => {
            clearTimeout(t);
            try {
                if (observer) observer.disconnect();
                else view?.removeEventListener('resize', measure);
            } catch {
                // ignore
            }
        };
    }, [ref, dep]);
    return height;
}

const LibraryCoverCard = memo(function LibraryCoverCard({
    game,
    selected,
    onSelect,
}: {
    game: LibraryGame;
    selected: boolean;
    onSelect(game: LibraryGame, open: boolean, el: HTMLElement): void;
}) {
    const coverBg = useMemo(() => {
        try {
            const urls = capsuleUrls(game.appId, browserStores);
            if (urls.length === 0) return undefined;
            return { backgroundImage: urls.map((u) => `url("${u.replace(/"/g, '%22')}")`).join(', ') };
        } catch {
            return undefined;
        }
    }, [game.appId]);

    return (
        <div
            className={`nh-lib-card${selected ? ' nh-lib-card-sel' : ''}${!game.installed && !game.shortcut ? ' nh-lib-card-off' : ''}`}
            onClick={(e: MouseEvent<HTMLDivElement>) => onSelect(game, selected, e.currentTarget)}
        >
            <div className="nh-lib-card-fallback">{game.name}</div>
            {coverBg && <div className="nh-lib-card-art" style={coverBg} />}
            {game.demo && <span className="nh-lib-card-badge">{tr('demoMark')}</span>}
        </div>
    );
});

export function CustomLibrary() {
    const currentSettings = useSettings();
    const { minimalSide, hideStatusBarBackground, libraryGridColumns, libraryGridSize, heroPosition } = currentSettings;
    const knownLang = peekSteamLanguage();
    const loadedLang = useAsync(knownLang ? null : 'lang', getSteamLanguage);
    const systemLang = knownLang ?? loadedLang ?? 'english';
    const minimal = homeMode(currentSettings).minimalLibrary;
    const [memory] = useState(readLibraryMemory);
    const [tabId, setTabId] = useState<LibraryTabId>(memory.tabId);
    const [sort, setSort] = useState<LibrarySort>(memory.sort);
    const [installedOnly, setInstalledOnly] = useState<boolean>(memory.installedOnly);
    const [selectedAppId, setSelectedAppId] = useState<number>(memory.appId);
    const [scrollRowTop, setScrollRowTop] = useState(0);

    const snapshot = useMemo(() => readLibrarySnapshot(undefined), [systemLang]);
    const activeTab = useMemo(
        () => snapshot.tabs.find((t) => t.id === tabId) ?? snapshot.tabs[0],
        [snapshot.tabs, tabId],
    );
    const games = useMemo(
        () => filterAndSortLibraryGames(snapshot.games, activeTab, installedOnly, sort),
        [snapshot.games, activeTab, installedOnly, sort],
    );

    const selectedIndex = useMemo(() => {
        if (games.length === 0) return 0;
        const found = games.findIndex((g) => g.appId === selectedAppId);
        return found >= 0 ? found : 0;
    }, [games, selectedAppId]);

    const selectedGame = games[selectedIndex] ?? null;

    useEffect(() => {
        noteLibraryMemory({
            tabId: activeTab?.id ?? 'all',
            appId: selectedGame?.appId ?? 0,
            sort,
            installedOnly,
        });
    }, [activeTab?.id, selectedGame?.appId, sort, installedOnly]);

    const rootRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement | null>(null);
    const tabsRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const active = tabsRef.current?.querySelector('.nh-lib-tab-on, .nh-lib-min-tab-on');
        if (active instanceof HTMLElement) {
            active.scrollIntoView({ inline: 'nearest', block: 'nearest' });
        }
    }, [activeTab?.id, minimal]);
    const size = useBoxSize(rootRef);
    const canvas = homeCanvas(size?.width ?? 0, size?.height ?? 0);
    const logicalHeight = size ? size.height / canvas.scale : canvas.logicalHeight;
    const tv = size ? isTvScreen(size.width, size.height) : false;
    const side = sideInset(tv);
    const [legendH, setLegendH] = useState<number | null>(null);

    useLayoutEffect(() => {
        const el = rootRef.current;
        if (!el) return undefined;
        const measure = () => setLegendH((old) => {
            const next = findLegendHeight(el);
            return old === next ? old : next;
        });
        measure();
        const t = setTimeout(measure, 400);
        return () => clearTimeout(t);
    }, [size?.width, size?.height]);

    useEffect(() => {
        const doc = rootRef.current?.ownerDocument;
        return doc ? installMouseMode(doc) : undefined;
    }, []);

    const hasSize = size !== null;
    useEffect(() => {
        if (hasSize && listRef.current) focusElementSettled(listRef.current, 'the library list');
    }, [hasSize, minimal]);

    const cols = minimal ? 1 : Math.min(7, Math.max(4, libraryGridColumns));
    const gap = tv ? 16 : 12;
    const availW = Math.max(400, canvas.logicalWidth - 2 * side);
    const fitCardW = Math.floor((availW - gap * (cols - 1)) / cols);
    const maxCardW = libraryGridSize === 'compact' ? 160 : libraryGridSize === 'large' ? 240 : 190;
    const cardW = Math.max(1, Math.min(fitCardW, maxCardW));
    const cardH = Math.round(cardW * 1.4);
    const gridPitch = cardH + gap;
    const viewportH = useViewportHeight(listRef, `${size?.width}x${size?.height}:${minimal}`);

    const totalRows = minimal ? games.length : Math.ceil(games.length / cols);
    const rowPitch = minimal ? MIN_PITCH : gridPitch;
    const itemH = minimal ? MIN_ITEM_H : cardH;

    // Keep selected row visible in grid mode, or centered in minimalist mode
    useLayoutEffect(() => {
        if (viewportH <= 0 || totalRows === 0) {
            setScrollRowTop(0);
            return;
        }
        const totalContentH = Math.max(itemH, totalRows * rowPitch - (minimal ? MIN_ITEM_GAP : gap));
        const maxScroll = Math.max(0, totalContentH - viewportH);
        const selRow = minimal ? selectedIndex : Math.floor(selectedIndex / cols);
        if (minimal) {
            const desired = selRow * rowPitch - (viewportH - itemH) / 2;
            setScrollRowTop(Math.round(Math.min(maxScroll, Math.max(0, desired))));
            return;
        }
        const itemTop = selRow * rowPitch;
        const itemBottom = itemTop + itemH;
        setScrollRowTop((prev) => {
            let next = Math.min(maxScroll, Math.max(0, prev));
            if (itemTop - 4 < next) next = Math.max(0, itemTop - 4);
            else if (itemBottom + 8 > next + viewportH) next = Math.min(maxScroll, itemBottom + 8 - viewportH);
            return Math.round(next);
        });
    }, [selectedIndex, cols, rowPitch, itemH, viewportH, totalRows, minimal, gap]);

    const { startRow, endRow } = visibleRowRange(scrollRowTop, viewportH || 600, rowPitch, totalRows, 2);

    const settledHeroId = useSettled(selectedGame?.appId ?? 0, 120);
    const locale = steamLanguageToLocale(peekSteamLanguage() ?? 'english');
    const nowSec = Math.floor(Date.now() / 1000);
    const bottomReserve = legendReserve(legendH, canvas.scale);
    const css = useMemo(
        () => libraryCss({ hideStatusBarBackground, cols, cardW, cardH, gap, heroPosition }),
        [hideStatusBarBackground, cols, cardW, cardH, gap, heroPosition],
    );

    const [back, setBack] = useState(takeLibraryReturn);
    const [opening, setOpening] = useState(false);
    const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!back) return undefined;
        const timer = setTimeout(() => setBack(false), RETURN_TIMINGS.hold);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => () => {
        if (openTimerRef.current !== null) clearTimeout(openTimerRef.current);
    }, []);
    const enterOff = useMemo(() => (back ? steamEnterOffCss() : ''), [back]);

    const openGameFromLibrary = (appId: number) => {
        if (opening) return;
        playNavSound('IntoGameDetail');
        setOpening(true);
        markLibraryLeaving();
        const mode = homeMode(currentSettings);
        const look = mode.gamePage && mode.restyleDetails ? (mode.cleanDetails ? 'clean' : 'spotlight') : 'steam';
        markOpen(appId, { look, mode: 'all' });
        openTimerRef.current = setTimeout(() => {
            openTimerRef.current = null;
            try {
                Navigation.Navigate(`/library/app/${appId}`);
            } catch (error) {
                setOpening(false);
                console.warn(`${LOG_PREFIX} Library: could not open game page`, error);
            }
        }, 160);
    };

    const openSelected = () => {
        if (!selectedGame) return;
        openGameFromLibrary(selectedGame.appId);
    };

    const stepTab = (delta: -1 | 1) => {
        if (snapshot.tabs.length <= 1) return;
        const idx = snapshot.tabs.findIndex((t) => t.id === activeTab?.id);
        const nextIdx = (Math.max(0, idx) + delta + snapshot.tabs.length) % snapshot.tabs.length;
        setTabId(snapshot.tabs[nextIdx].id);
        playNavSound('ChangeTabs');
    };

    const selectedEl = () =>
        listRef.current?.querySelector<HTMLElement>(minimal ? '.nh-lib-min-item-sel' : '.nh-lib-card-sel') ?? listRef.current;

    const onButtonDown = (evt: GamepadEvent) => {
        if (opening) return;
        try {
            const button = Number(evt?.detail?.button);
            const isRepeat = Boolean(evt?.detail?.is_repeat);
            const action = libraryButtonAction(button, selectedIndex, games.length, cols, isRepeat);
            if (!action) return;
            evt.preventDefault?.();
            evt.stopPropagation?.();
            if (action.type === 'move') {
                const nextGame = games[action.index];
                if (nextGame && action.index !== selectedIndex) {
                    setSelectedAppId(nextGame.appId);
                    const sound = gameStepSound(selectedIndex, action.index, 'dpad');
                    if (sound) playNavSound(sound);
                }
                return;
            }
            if (action.type === 'tab') return stepTab(action.delta);
            if (action.type === 'sort') return setSort((s) => nextLibrarySort(s));
            if (action.type === 'filter') return setInstalledOnly((v) => !v);
            if (action.type === 'menu' && selectedGame) openGameActions(selectedGame.appId, selectedEl());
        } catch (error) {
            console.warn(`${LOG_PREFIX} Library navigation failed`, error);
        }
    };

    const onWheel = useWheelStep((steps) => {
        if (opening || games.length === 0) return;
        const step = minimal ? steps : steps * cols;
        const next = Math.min(games.length - 1, Math.max(0, selectedIndex + step));
        if (next !== selectedIndex) setSelectedAppId(games[next].appId);
    });

    const onCardOrItemSelect = (game: LibraryGame, alreadySelected: boolean) => {
        if (alreadySelected) {
            openGameFromLibrary(game.appId);
            return;
        }
        setSelectedAppId(game.appId);
        listRef.current?.focus({ preventScroll: true });
    };

    const installedLabel = tr('installed');
    const allLabel = tr('all');
    const emptyLabel = tr('noMatches');
    const sortText = librarySortLabel(sort);
    const ru = isRussianSystem();
    const footerFilterLabel = installedOnly ? allLabel : (ru ? 'Устан.' : 'Installed');
    const footerSortLabel = librarySortShortLabel(sort);
    const footerMenuLabel = ru ? 'Меню' : 'Menu';
    const footerOpenLabel = ru ? 'Открыть' : 'Open';
    const metaParts: string[] = [];
    if (selectedGame) {
        metaParts.push(`${tr('played')}: ${formatHours(minutesToHours(selectedGame.playedMinutes), locale)}`);
        if (selectedGame.lastPlayed > 0) metaParts.push(formatLastPlayed(selectedGame.lastPlayed, nowSec, locale));
        metaParts.push(selectedGame.installed ? tr('installedStatus') : tr('notInstalled'));
    }
    const stageKey = `${activeTab?.id ?? 'all'}:${installedOnly ? 1 : 0}:${sort}`;

    return (
        <div
            ref={rootRef}
            className={`nh-lib-root nh-lib-mode-${minimal ? 'minimal' : 'grid'} nh-side-${minimalSide}${back ? ' nh-lib-back' : ''}${opening ? ' nh-lib-opening' : ''}`}
            onWheel={onWheel}
            style={{
                '--nh-side': `${side}px`,
                '--nh-bottom': `${bottomReserve}px`,
            } as CSSProperties}
        >
            <style>{css}</style>
            {enterOff && <style>{enterOff}</style>}
            <HeroBackground appId={settledHeroId || null} detailsVersion={0} neighbours={[]} />
            <div className="nh-lib-scrim" />
            <div className="nh-lib-canvas" style={canvasStyle(canvas, logicalHeight, Boolean(size))}>
                <div className="nh-lib-safe">
                    {minimal ? (
                        <>
                            <div className="nh-lib-min-col">
                                <div ref={tabsRef} className="nh-lib-min-tabs">
                                    {snapshot.tabs.map((tab) => (
                                        <div
                                            key={tab.id}
                                            className={`nh-lib-min-tab${tab.id === activeTab?.id ? ' nh-lib-min-tab-on' : ''}`}
                                            onClick={() => setTabId(tab.id)}
                                        >
                                            {tab.label}
                                        </div>
                                    ))}
                                </div>
                                <div className="nh-lib-min-sub">
                                    <span
                                        className={`nh-lib-min-sub-btn${installedOnly ? ' nh-lib-min-sub-btn-on' : ''}`}
                                        onClick={() => setInstalledOnly((v) => !v)}
                                    >
                                        <FaFilter /> {installedOnly ? installedLabel : allLabel}
                                    </span>
                                    <span>·</span>
                                    <span className="nh-lib-min-sub-btn" onClick={() => setSort((s) => nextLibrarySort(s))}>
                                        <FaSortAmountDown /> {sortText}
                                    </span>
                                    <span>·</span>
                                    <span>{games.length}</span>
                                </div>
                                <Focusable
                                    ref={(el: HTMLDivElement | null) => { listRef.current = el; }}
                                    className="nh-lib-min-viewport"
                                    focusClassName="nh-lib-min-focus"
                                    noFocusRing
                                    preferredFocus
                                    onButtonDown={onButtonDown}
                                    onActivate={openSelected}
                                    onOKActionDescription={footerOpenLabel}
                                    onSecondaryActionDescription={footerFilterLabel}
                                    onOptionsActionDescription={footerSortLabel}
                                    onMenuActionDescription={footerMenuLabel}
                                >
                                    {games.length === 0 ? (
                                        <div className="nh-lib-empty">{emptyLabel}</div>
                                    ) : (
                                        <div key={stageKey} className="nh-lib-tab-stage">
                                            <div className="nh-lib-track" style={{ transform: `translateY(${-scrollRowTop}px)` }}>
                                                {Array.from({ length: Math.max(0, endRow - startRow) }, (_, k) => {
                                                    const idx = startRow + k;
                                                    const game = games[idx];
                                                    if (!game) return null;
                                                    const sel = idx === selectedIndex;
                                                    return (
                                                        <div
                                                            key={game.appId}
                                                            className={`nh-lib-min-item${sel ? ' nh-lib-min-item-sel' : ''}${!game.installed && !game.shortcut ? ' nh-lib-min-item-off' : ''}`}
                                                            style={{ top: `${idx * MIN_PITCH}px` }}
                                                            onClick={() => onCardOrItemSelect(game, sel)}
                                                        >
                                                            <span className="nh-lib-min-item-name">{game.name}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </Focusable>
                            </div>
                            {selectedGame && (
                                <div className="nh-lib-min-info">
                                    <div className="nh-lib-min-info-title">{selectedGame.name}</div>
                                    <div className="nh-lib-min-info-line">{metaParts.join(' · ')}</div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="nh-lib-grid-shell">
                            <div className="nh-lib-header">
                                <div ref={tabsRef} className="nh-lib-tabs">
                                    {snapshot.tabs.map((tab) => (
                                        <div
                                            key={tab.id}
                                            className={`nh-lib-tab${tab.id === activeTab?.id ? ' nh-lib-tab-on' : ''}`}
                                            onClick={() => setTabId(tab.id)}
                                        >
                                            <span>{tab.label}</span>
                                            <span className="nh-lib-tab-count">{tab.count}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="nh-lib-controls">
                                    <div
                                        className={`nh-lib-chip${installedOnly ? ' nh-lib-chip-on' : ''}`}
                                        onClick={() => setInstalledOnly((v) => !v)}
                                    >
                                        <FaFilter />
                                        <span>X · {installedOnly ? installedLabel : allLabel}</span>
                                    </div>
                                    <div className="nh-lib-chip" onClick={() => setSort((s) => nextLibrarySort(s))}>
                                        <FaSortAmountDown />
                                        <span>Y · {sortText}</span>
                                    </div>
                                </div>
                            </div>
                            <Focusable
                                ref={(el: HTMLDivElement | null) => { listRef.current = el; }}
                                className="nh-lib-viewport"
                                focusClassName="nh-lib-grid-focus"
                                noFocusRing
                                preferredFocus
                                onButtonDown={onButtonDown}
                                onActivate={openSelected}
                                onOKActionDescription={footerOpenLabel}
                                onSecondaryActionDescription={footerFilterLabel}
                                onOptionsActionDescription={footerSortLabel}
                                onMenuActionDescription={footerMenuLabel}
                            >
                                {games.length === 0 ? (
                                    <div className="nh-lib-empty">{emptyLabel}</div>
                                ) : (
                                    <div key={stageKey} className="nh-lib-tab-stage">
                                        <div className="nh-lib-track" style={{ transform: `translateY(${-scrollRowTop}px)` }}>
                                            {Array.from({ length: Math.max(0, endRow - startRow) }, (_, k) => {
                                                const rowIdx = startRow + k;
                                                const rowGames = games.slice(rowIdx * cols, (rowIdx + 1) * cols);
                                                return (
                                                    <div
                                                        key={rowIdx}
                                                        className="nh-lib-row"
                                                        style={{ top: `${rowIdx * gridPitch}px` }}
                                                    >
                                                        {rowGames.map((game, colIdx) => {
                                                            const globalIdx = rowIdx * cols + colIdx;
                                                            return (
                                                                <LibraryCoverCard
                                                                    key={game.appId}
                                                                    game={game}
                                                                    selected={globalIdx === selectedIndex}
                                                                    onSelect={(g, sel) => onCardOrItemSelect(g, sel)}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </Focusable>
                            {selectedGame && (
                                <div className="nh-lib-footer">
                                    <div className="nh-lib-footer-title">{selectedGame.name}</div>
                                    <div className="nh-lib-footer-meta">
                                        {metaParts.map((part, idx) => (
                                            <span key={idx}>{part}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
