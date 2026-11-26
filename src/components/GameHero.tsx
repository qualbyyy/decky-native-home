import { useEffect, useRef, useState } from 'react';
import { LOG_PREFIX } from '../constants';
import { withKnownAchievements } from '../home/detailsMemo';
import { cache } from '../data/cache';
import { setCurrentGame } from '../data/currentGame';
import { lookupHltb } from '../data/hltb';
import { useSettings } from '../data/settings';
import { getShortcutDescription } from '../data/shortcutDescription';
import { mergePlaytime } from '../data/unifideckPlaytime';
import { getDescription, getSteamLanguage, peekSteamLanguage, readGameInfo } from '../data/steam';
import { accentFor } from '../home/accent';
import { accentVersion, sampleAccent } from '../home/accentSample';
import { homeMode } from '../home/mode';
import { formatLastPlayed } from '../home/recents';
import { useAsync } from '../hooks/useAsync';
import { useUnifideckPlaytime } from '../hooks/useUnifideckPlaytime';
import { useUnifideckGamepadFocus } from '../hooks/useUnifideckGamepadFocus';
import { useUnifideckInstalled } from '../hooks/useUnifideckInstalled';
import { useUnifideckSizeLabel } from '../hooks/useUnifideckSizeLabel';
import { useUnifideckSize } from '../hooks/useUnifideckSize';
import { useOverrideVersion } from '../hooks/useOverrideVersion';
import { steamLanguageToLocale } from '../logic/format';
import { rememberSizeLabel, sizeStat, steamSpaceStat } from '../logic/sizeStat';
import { memoSpaceRequired } from '../home/detailsMemo';
import { useDownload } from '../home/useDownload';
import { useLaunchOverlay } from '../styles/launchOverlay';
import { useOpenArrival } from '../hooks/useOpenArrival';
import { openPending } from '../data/openIntent';
import { knownDescription, peekHltb, rememberDescription, rememberHltb } from '../home/warmup';
import { accentMemo, knownAccent } from '../home/accentMemo';
import { accentCss, arrivingCss, downloadCss, launchCss, launchSelectors, ringCss, themeCss, unifideckCss } from '../styles/theme';
import { installMouseMode } from '../home/mouseMode';
import { useCardNav } from '../hooks/useCardNav';
import { ErrorBoundary } from './ErrorBoundary';
import { GameStatusBar } from './GameStatusBar';
import { UnifideckRowNav } from './UnifideckRowNav';
import { UnifideckCloud } from './UnifideckCloud';
import { GameTitle } from './GameTitle';
import { NativeGameDeck, NativeMinimalMeta } from './NativeGameDeck';

/** A canvas length in the restyled page's scale unit (themeCss: --gg-d). */
const pageUnit = (n: number) => `calc(${n} * var(--gg-d))`;
import { tr } from '../i18n/steamText';

interface Props {
    overview: unknown;
    details: unknown;
}


/** The game's accent (same source and cache as Spotlight Home), only while restyled; undefined until known. */
function useGameAccent(appId: number, active: boolean): string | undefined {
    const loaded = useAsync(active && appId !== 0 ? `accent:${appId}` : null, async () => {
        const color = await accentFor(appId, { cache, sample: sampleAccent, version: accentVersion });
        accentMemo.set(appId, color);
        return color;
    });
    // Until it answers, the colour already known this session (Home's too: home/accentMemo), so the first frame has it.
    return active ? knownAccent(loaded, appId) : undefined;
}

/** "Last played · Today" from Steam's overview (Unix seconds); null if never played or unreadable. */
function lastPlayedEyebrow(overview: unknown, locale: string, unifideckLastPlayed: number | null = null): string | null {
    try {
        const steamSeconds = Number((overview as { rt_last_time_played?: unknown } | null)?.rt_last_time_played ?? 0);
        const seconds = mergePlaytime({ minutes: 0, lastPlayed: Number.isFinite(steamSeconds) ? steamSeconds : 0 }, { playedSeconds: null, lastPlayed: unifideckLastPlayed }).lastPlayed;
        if (!Number.isFinite(seconds) || seconds <= 0) return null;
        return `${tr('lastPlayed')} · ${formatLastPlayed(seconds, Math.floor(Date.now() / 1000), locale)}`;
    } catch (error) {
        console.warn(`${LOG_PREFIX} could not read last played`, error);
        return null;
    }
}

function Hero({ overview, details, restyle, minimal }: Props & { restyle: boolean; minimal: boolean }) {
    // Until Steam has loaded the game's details, the achievement counts Spotlight Home already knows (home/detailsMemo).
    const steamGame = withKnownAchievements(readGameInfo(overview, details));
    const unifideck = useUnifideckPlaytime(steamGame.appId, steamGame.isShortcut);
    const game = unifideck ? { ...steamGame, playedMinutes: mergePlaytime({ minutes: steamGame.playedMinutes, lastPlayed: 0 }, unifideck).minutes } : steamGame;
    const overrideVersion = useOverrideVersion();
    const knownLang = peekSteamLanguage();
    const loadedLang = useAsync(knownLang ? null : 'lang', getSteamLanguage);
    const lang = knownLang ?? loadedLang;
    const locale = steamLanguageToLocale(lang ?? 'english');
    const fetchedDescription = useAsync(!minimal && lang !== undefined ? `desc:${game.appId}:${lang}` : null, () =>
        game.isShortcut ? getShortcutDescription(game, lang ?? 'english') : getDescription(game.appId, lang ?? 'english'),
    );
    const description = minimal ? null : knownDescription(fetchedDescription, game.appId, lang);
    useEffect(() => {
        if (!minimal && lang !== undefined && fetchedDescription) rememberDescription(game.appId, lang, fetchedDescription);
    }, [minimal, game.appId, lang, fetchedDescription]);
    const looked = useAsync(`hltb:${game.appId}:${overrideVersion}`, () =>
        lookupHltb({ appId: game.appId, name: game.name, isShortcut: game.isShortcut }),
    );
    const hltb = looked ?? peekHltb(game.appId);
    useEffect(() => {
        if (looked) rememberHltb(game.appId, looked);
    }, [game.appId, looked]);
    const [openedFrom] = useState(() => openPending(game.appId));

    const { homeStatusBar: statusBar, gameLogo, showNewLabel, showLastPlayedLabel, hideGameCover, hideStatusBarBackground, heroPosition } = useSettings();
    const accent = useGameAccent(game.appId, restyle);
    const { download } = useDownload(restyle && game.appId !== 0 ? game.appId : null);
    const uniInstalled = useUnifideckInstalled(game.appId, restyle && game.isShortcut);
    const unifideckSize = useUnifideckSize(game.appId, game.isShortcut && typeof uniInstalled === 'boolean', uniInstalled === true, restyle);
    const heroRef = useRef<HTMLDivElement>(null);
    const [pageDoc, setPageDoc] = useState<Document | null>(null);
    useEffect(() => setPageDoc(heroRef.current?.ownerDocument ?? null), [game.appId]);
    useEffect(() => (pageDoc ? installMouseMode(pageDoc) : undefined), [pageDoc]);
    useCardNav(pageDoc, restyle && !minimal);
    useUnifideckGamepadFocus(pageDoc, game.isShortcut);
    const nativeSizeLabel = useUnifideckSizeLabel(pageDoc, game.appId, uniInstalled, restyle && game.isShortcut);
    const spaceNeeded = (details as { lDiskSpaceRequiredBytes?: unknown } | null | undefined)?.lDiskSpaceRequiredBytes;
    const steamSize = restyle && !game.isShortcut ? steamSpaceStat(overview, typeof spaceNeeded === 'number' ? spaceNeeded : memoSpaceRequired(game.appId), locale, tr('spaceRequired')) : null;
    const size = (restyle && typeof uniInstalled === 'boolean' ? sizeStat(unifideckSize, uniInstalled, locale, nativeSizeLabel) : null) ?? steamSize;
    useEffect(() => {
        if (typeof uniInstalled === 'boolean') rememberSizeLabel(uniInstalled, nativeSizeLabel);
    }, [uniInstalled, nativeSizeLabel]);
    const fillCss = restyle ? downloadCss(download?.percent ?? null) : '';
    const { overlay, hide } = launchSelectors();
    const launching = useLaunchOverlay(heroRef, overlay, hide, game.appId);
    const arrival = useOpenArrival(heroRef, game.appId, hideGameCover);

    useEffect(() => {
        setCurrentGame(game, hltb);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game.appId, hltb]);

    if (game.appId === 0) return null;
    let ringStyle = '';
    try {
        ringStyle = pageDoc?.defaultView ? ringCss(pageDoc.defaultView) : '';
    } catch {
        ringStyle = '';
    }
    const steamLastPlayed = Number((overview as { rt_last_time_played?: unknown } | null)?.rt_last_time_played ?? 0);
    const neverPlayedSteam = !game.isShortcut && game.playedMinutes === 0 && (!Number.isFinite(steamLastPlayed) || steamLastPlayed <= 0);
    const newGame = openedFrom?.newGame === true || neverPlayedSteam;
    const openedNewEyebrow = openedFrom?.eyebrow === tr('newToLibrary') || openedFrom?.eyebrow?.startsWith(`${tr('newToLibrary')} ·`);
    const newEyebrow = newGame || openedNewEyebrow;
    const openedEyebrow = openedNewEyebrow ? (showNewLabel ? openedFrom?.eyebrow : undefined) : (showLastPlayedLabel ? openedFrom?.eyebrow : undefined);
    const fallbackEyebrow = showLastPlayedLabel ? lastPlayedEyebrow(overview, locale, unifideck?.lastPlayed ?? null) : null;
    const eyebrow = restyle && (showNewLabel || !newEyebrow) ? openedEyebrow ?? fallbackEyebrow : null;
    return (
        <>
            {restyle && statusBar && !launching && <GameStatusBar />}
            {game.isShortcut && (
                <ErrorBoundary>
                    <UnifideckRowNav />
                    {restyle && <UnifideckCloud appId={game.appId} installed={uniInstalled} />}
                </ErrorBoundary>
            )}
            {restyle && game.name !== '' && (
                <div className={`gg-titleblock nh-gv-header${minimal ? ' nh-gv-header-min' : ''}`} data-gg-new={newGame ? '' : undefined}>
                    <GameTitle appId={game.appId} name={game.name} logo={gameLogo} className="gg-title" logoClassName="gg-logo" unit={pageUnit} />
                    {minimal ? (
                        <NativeMinimalMeta game={game} hltb={hltb} locale={locale} size={size} eyebrow={eyebrow} />
                    ) : (
                        eyebrow && (
                            <div className="gg-eyebrow nh-gv-eyebrow-row">
                                <span className="nh-gv-accent-tick" aria-hidden="true" />
                                <span>{eyebrow}</span>
                            </div>
                        )
                    )}
                </div>
            )}
            <div className={`gg-hero nh-gv-hero${minimal ? ' nh-gv-min' : ' nh-gv-full'}`} ref={heroRef}>
                <style>{themeCss({ restyle, minimal, hideCover: hideGameCover, hideStatusBarBackground, heroPosition })}</style>
                <style>{unifideckCss({ restyle, minimal })}</style>
                {ringStyle && <style>{ringStyle}</style>}
                {launching && <style>{launchCss()}</style>}
                {accent && <style>{accentCss(accent)}</style>}
                {fillCss && <style>{fillCss}</style>}
                {arrival && restyle && <style>{arrivingCss(minimal ? 'clean' : 'spotlight', arrival.intent.mode, arrival.revealed, {})}</style>}
                {!minimal && (
                    <ErrorBoundary>
                        <NativeGameDeck game={game} hltb={hltb} description={description} locale={locale} size={size} restyle={restyle} />
                    </ErrorBoundary>
                )}
            </div>
        </>
    );
}

export function GameHero(props: Props) {
    const settings = useSettings();
    if (!settings.enabled) return null;
    const { restyleDetails, minimalDetails } = homeMode(settings);
    return (
        <ErrorBoundary>
            <Hero {...props} restyle={restyleDetails} minimal={minimalDetails} />
        </ErrorBoundary>
    );
}
