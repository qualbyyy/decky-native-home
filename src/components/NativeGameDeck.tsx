import { Focusable } from '@decky/ui';
import { FaChevronRight } from 'react-icons/fa';
import type { HltbResult } from '../data/hltb';
import type { GameInfo } from '../data/steam';
import { tr } from '../i18n/steamText';
import { cleanStats } from '../logic/cleanInfo';
import { formatAchievements, formatHours, minutesToHours } from '../logic/format';
import { HLTB_COLUMNS, HLTB_TITLE, hltbFoundView, hltbNotFoundView } from '../logic/hltbCardView';
import { descriptionState } from '../logic/infoCard';
import type { SizeStat } from '../logic/sizeStat';
import { CardShell } from './CardShell';
import { hltbUrl, openGameInfoTab, openHltbPage } from './cardActions';

interface NativeMinimalMetaProps {
    game: GameInfo;
    hltb: HltbResult | undefined;
    locale: string;
    size?: SizeStat | null;
    eyebrow?: string | null;
}

/**
 * Unboxed flat typographic metadata strip rendered directly under the title/logo in Minimalist GameView.
 * Zero cards, pills, or borders so the game artwork dominates the screen.
 */
export function NativeMinimalMeta({ game, hltb, locale, size = null, eyebrow = null }: NativeMinimalMetaProps) {
    const stats = cleanStats(game, hltb, locale, size);
    const items: Array<{ key: string; label?: string; value: string; accent?: boolean }> = [];
    if (eyebrow) items.push({ key: 'eyebrow', value: eyebrow, accent: true });
    for (const s of stats) {
        items.push({ key: s.key, label: s.label, value: s.value, accent: s.key === 'hltb' && /\d/.test(s.value) });
    }
    if (items.length === 0) return null;
    return (
        <div className="nh-gv-min-meta">
            {items.map((item, idx) => (
                <span key={item.key} className={`nh-gv-min-item${item.accent ? ' nh-gv-min-accent' : ''}`}>
                    {idx > 0 && <span className="nh-gv-min-sep" aria-hidden="true">·</span>}
                    {item.label && <span className="nh-gv-min-label">{item.label} </span>}
                    <span className="nh-gv-min-val">{item.value}</span>
                </span>
            ))}
        </div>
    );
}

interface NativeGameDeckProps {
    game: GameInfo;
    hltb: HltbResult | undefined;
    description: string | null | undefined;
    locale: string;
    size?: SizeStat | null;
    restyle: boolean;
}

/**
 * Unified architectural telemetry + synopsis bar for Full Native Home GameView.
 * Replaces Game Glance's two separate floating cards with one cohesive split dock.
 */
export function NativeGameDeck({ game, hltb, description, locale, size = null, restyle }: NativeGameDeckProps) {
    const desc = descriptionState(description);
    const ach = game.achievements;
    const achProgress = ach && ach.total > 0 ? Math.min(100, Math.round((ach.achieved / ach.total) * 100)) : null;
    const canOpenHltb = restyle && Boolean(hltbUrl(hltb));
    const hltbBody = (() => {
        if (hltb === undefined) {
            return (
                <div className="nh-gv-hltb-cols">
                    {HLTB_COLUMNS.map((c) => (
                        <div key={c.tier} className="nh-gv-stat" data-stat={c.key}>
                            <span className="nh-gv-stat-label">{c.label}</span>
                            <span className="nh-gv-stat-value"><span className="gg-skeleton" /></span>
                        </div>
                    ))}
                </div>
            );
        }
        if (hltb.status === 'notFound') {
            const none = hltbNotFoundView(hltb.overrideId);
            return (
                <div className="nh-gv-hltb-empty">
                    <span className="nh-gv-muted">{none.muted}</span>
                    <span className="nh-gv-caption">{none.caption}</span>
                </div>
            );
        }
        if (hltb.status === 'unavailable') {
            return <div className="nh-gv-muted">{tr('unavailable')}</div>;
        }
        const view = hltbFoundView(hltb.times, game.playedMinutes, locale, restyle);
        return (
            <>
                <div className="nh-gv-hltb-cols">
                    {view.columns.map((c, idx) => (
                        <div key={c.tier} className={`nh-gv-stat${idx === 0 || c.goal ? ' nh-gv-stat-accent' : ''}`} data-stat={c.key}>
                            <span className="nh-gv-stat-label">{c.label}</span>
                            <span className="nh-gv-stat-value">{c.value}</span>
                        </div>
                    ))}
                </div>
                {view.bar !== null && (
                    <div className="nh-gv-progress">
                        <div className="nh-gv-progress-fill" style={{ width: `${view.bar}%` }} />
                    </div>
                )}
                {view.caption && <div className="nh-gv-caption">{view.caption}</div>}
            </>
        );
    })();

    const DeckContainer = restyle ? Focusable : 'div';
    const deckProps = restyle ? { className: 'nh-gv-deck', 'flow-children': 'row' as const } : { className: 'nh-gv-deck' };

    return (
        <DeckContainer {...deckProps}>
            <CardShell
                className="nh-gv-pane nh-gv-telemetry"
                onPress={canOpenHltb ? () => openHltbPage(hltb) : undefined}
            >
                <div className="nh-gv-metrics">
                    <div className="nh-gv-stat" data-stat="played">
                        <span className="nh-gv-stat-label">{tr('played')}</span>
                        <span className="nh-gv-stat-value">{formatHours(minutesToHours(game.playedMinutes), locale)}</span>
                    </div>
                    {size && (
                        <div className="nh-gv-stat" data-stat="size">
                            <span className="nh-gv-stat-label">{size.label}</span>
                            <span className="nh-gv-stat-value">{size.value}</span>
                        </div>
                    )}
                    {ach && (
                        <div className="nh-gv-stat" data-stat="achievements">
                            <span className="nh-gv-stat-label">{tr('achievements')}</span>
                            <span className="nh-gv-stat-value">{formatAchievements(ach)}</span>
                            {achProgress !== null && (
                                <div className="nh-gv-mini-bar">
                                    <div className="nh-gv-mini-fill" style={{ width: `${achProgress}%` }} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="nh-gv-hltb-block">
                    <div className="nh-gv-section-head">
                        <span>{HLTB_TITLE}</span>
                    </div>
                    {hltbBody}
                </div>
            </CardShell>
            <CardShell
                className="nh-gv-pane nh-gv-synopsis"
                onPress={restyle ? (card) => openGameInfoTab(card.ownerDocument) : undefined}
            >
                <div className="nh-gv-section-head">
                    <span>{tr('gameDetails')}</span>
                    <FaChevronRight className="nh-gv-head-arrow" aria-hidden="true" />
                </div>
                {desc.kind === 'loading' && (
                    <p className="nh-gv-desc">
                        <span className="gg-skeleton" />
                    </p>
                )}
                {desc.kind === 'text' && <p className="nh-gv-desc">{desc.text}</p>}
                {desc.kind === 'none' && <p className="nh-gv-desc nh-gv-desc-empty">{tr('unavailable')}</p>}
            </CardShell>
        </DeckContainer>
    );
}
