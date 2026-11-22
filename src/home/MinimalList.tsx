import { Focusable } from '@decky/ui';
import type { GamepadEvent } from '@decky/ui';
import type { MinimalSide } from '../data/settings';
import { tr } from '../i18n/steamText';
import type { HomeGame } from './useHomeData';

const ITEM_H = 44;
const ITEM_GAP = 4;
const ITEM_PITCH = ITEM_H + ITEM_GAP;

export interface MinimalListProps {
    games: HomeGame[];
    selected: number;
    side: MinimalSide;
    viewportHeight: number;
    nav: {
        preferred: boolean;
        setRef(el: HTMLDivElement | null): void;
        onFocus(): void;
        onButtonDown(evt: GamepadEvent): void;
        onButtonUp(evt: GamepadEvent): void;
        onActivate(): void;
        onSelect(index: number): void;
    };
}

export function MinimalList({ games, selected, side, viewportHeight, nav }: MinimalListProps) {
    const totalItems = games.length + 1;
    const totalH = Math.max(ITEM_H, totalItems * ITEM_PITCH - ITEM_GAP);
    const maxScroll = Math.max(0, totalH - viewportHeight);
    const desired = selected * ITEM_PITCH - (viewportHeight - ITEM_H) / 2;
    const offset = Math.round(Math.min(maxScroll, Math.max(0, desired)));

    const handleClick = (index: number) => {
        if (index === selected) nav.onActivate();
        else nav.onSelect(index);
    };

    return (
        <Focusable
            ref={nav.setRef}
            className={`nh-min-list nh-min-${side}`}
            focusClassName="nh-min-focus"
            noFocusRing
            preferredFocus={nav.preferred}
            onFocus={nav.onFocus}
            onActivate={nav.onActivate}
            onButtonDown={nav.onButtonDown}
            onButtonUp={nav.onButtonUp}
        >
            <div className="nh-min-track" style={{ transform: `translateY(${-offset}px)` }}>
                {games.map((game, i) => {
                    const isSelected = i === selected;
                    const off = !game.installed && game.shortcut !== true;
                    return (
                        <div
                            key={game.appId}
                            className={`nh-min-item${isSelected ? ' nh-min-item-sel' : ''}${off ? ' nh-min-item-off' : ''}`}
                            onClick={() => handleClick(i)}
                        >
                            <span>{game.name}</span>
                        </div>
                    );
                })}
                <div
                    key="library"
                    className={`nh-min-item nh-min-item-lib${selected === games.length ? ' nh-min-item-sel' : ''}`}
                    onClick={() => handleClick(games.length)}
                >
                    <span>{tr('viewLibrary')}</span>
                </div>
            </div>
        </Focusable>
    );
}
