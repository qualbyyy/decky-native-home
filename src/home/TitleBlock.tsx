import { GameTitle } from '../components/GameTitle';
import type { Chip } from './chips';

function ChipView({ chip }: { chip: Chip }) {
    const progress = chip.progress;
    return (
        <div className="gh-chip" data-chip={chip.key}>
            <div className="gh-chip-label">{chip.label}</div>
            <div className="gh-chip-value" data-text={chip.value}>{chip.value}</div>
            {progress !== undefined && Number.isFinite(progress) && (
                <div className="gh-chip-bar">
                    <div className="gh-chip-fill" style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
                </div>
            )}
        </div>
    );
}

export function InlineChips({ chips }: { chips: Chip[] }) {
    if (chips.length === 0) return null;
    return (
        <div className="gh-chips">
            {chips.map((chip) => (
                <ChipView key={chip.key} chip={chip} />
            ))}
        </div>
    );
}

const px = (n: number) => `${n}px`;

export function TitleBlock({ eyebrow, title, appId = 0, logo = false, version = 0, resolve = true }: { eyebrow: string; title: string; appId?: number; logo?: boolean; version?: number; resolve?: boolean }) {
    return (
        <>
            <div className="gh-title-slot">
                <GameTitle appId={appId} name={title} logo={logo} className="gh-title" logoClassName="gh-logo" unit={px} version={version} resolve={resolve} />
            </div>
            <div className="gh-eyebrow">{eyebrow}</div>
        </>
    );
}
