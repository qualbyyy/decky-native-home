/**
 * The Screensaver settings (Quick Access → Native Home → Screensaver). With `enabled`, Native Home draws Steam's Game
 * Slideshow itself: the games of Home's Games row, with Home's art (custom art first) filling the screen. Each overlay is
 * its own switch, all on by default; with all three off only the art is left. Pure.
 */
export interface ScreensaverOptions {
    /** Native Home's slideshow in place of Steam's. Off: Steam's own screensaver, untouched. */
    enabled: boolean;
    /** The game's logo (or its name) at the bottom left, as on Home. */
    logo: boolean;
    /** Native Home's status bar at the top right. */
    statusBar: boolean;
    /** A small card at the bottom right: play time, the HowLongToBeat time you are working toward, and your achievements. */
    stats: boolean;
}

export const SCREENSAVER_DEFAULTS: ScreensaverOptions = { enabled: true, logo: true, statusBar: true, stats: true };

const KEYS = Object.keys(SCREENSAVER_DEFAULTS) as Array<keyof ScreensaverOptions>;

/** Stored options, each a boolean or its default. */
export function readScreensaverOptions(raw: unknown): ScreensaverOptions {
    const stored = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const out = { ...SCREENSAVER_DEFAULTS };
    for (const key of KEYS) if (typeof stored[key] === 'boolean') out[key] = stored[key] as boolean;
    return out;
}
