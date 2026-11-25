/**
 * Pure gamepad navigation & virtualization math for CustomLibrary.
 * Button numbers match @decky/ui GamepadButton enum:
 * SECONDARY=3 (X), OPTIONS=4 (Y), BUMPER_LEFT=5, BUMPER_RIGHT=6,
 * TRIGGER_LEFT=7, TRIGGER_RIGHT=8, DIR_UP=9, DIR_DOWN=10,
 * DIR_LEFT=11, DIR_RIGHT=12, SELECT=13, START=14.
 */

const BTN_SECONDARY = 3;
const BTN_OPTIONS = 4;
const BTN_L1 = 5;
const BTN_R1 = 6;
const BTN_L2 = 7;
const BTN_R2 = 8;
const BTN_UP = 9;
const BTN_DOWN = 10;
const BTN_LEFT = 11;
const BTN_RIGHT = 12;
const BTN_SELECT = 13;
const BTN_START = 14;

export type LibraryButtonAction =
    | { type: 'move'; index: number }
    | { type: 'tab'; delta: -1 | 1 }
    | { type: 'sort' }
    | { type: 'filter' }
    | { type: 'menu' }
    | null;

export function libraryButtonAction(
    button: number,
    index: number,
    count: number,
    cols: number,
    isRepeat = false,
): LibraryButtonAction {
    if (button === BTN_L1) return { type: 'tab', delta: -1 };
    if (button === BTN_R1) return { type: 'tab', delta: 1 };
    if (button === BTN_SECONDARY) return isRepeat ? null : { type: 'filter' };
    if (button === BTN_OPTIONS) return isRepeat ? null : { type: 'sort' };
    if (button === BTN_SELECT || button === BTN_START) return isRepeat ? null : { type: 'menu' };

    if (!Number.isFinite(count) || count <= 0) return null;
    const safeCols = Math.max(1, Math.floor(cols));
    const at = Math.min(count - 1, Math.max(0, Math.floor(index)));

    if (button === BTN_UP) {
        if (at < safeCols) return isRepeat ? { type: 'move', index: at } : null;
        return { type: 'move', index: at - safeCols };
    }
    if (button === BTN_DOWN) {
        const next = at + safeCols;
        if (next < count) return { type: 'move', index: next };
        const lastRowStart = Math.floor((count - 1) / safeCols) * safeCols;
        return at < lastRowStart ? { type: 'move', index: count - 1 } : { type: 'move', index: at };
    }
    if (button === BTN_LEFT) {
        if (safeCols === 1) return null;
        return { type: 'move', index: Math.max(0, at - 1) };
    }
    if (button === BTN_RIGHT) {
        if (safeCols === 1) return null;
        return { type: 'move', index: Math.min(count - 1, at + 1) };
    }
    if (button === BTN_L2 || button === BTN_R2) {
        const jump = safeCols === 1 ? 8 : safeCols * 3;
        const delta = button === BTN_L2 ? -jump : jump;
        return { type: 'move', index: Math.min(count - 1, Math.max(0, at + delta)) };
    }
    return null;
}

export function visibleRowRange(
    scrollTop: number,
    viewportHeight: number,
    rowPitch: number,
    totalRows: number,
    overscan = 2,
): { startRow: number; endRow: number } {
    if (totalRows <= 0 || rowPitch <= 0 || viewportHeight <= 0) return { startRow: 0, endRow: 0 };
    const top = Math.max(0, scrollTop);
    const first = Math.floor(top / rowPitch);
    const last = Math.ceil((top + viewportHeight) / rowPitch);
    return {
        startRow: Math.max(0, first - overscan),
        endRow: Math.min(totalRows, last + overscan),
    };
}
