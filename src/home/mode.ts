import { Settings } from '../data/settings';

export interface HomeMode {
    gamePage: boolean;
    home: boolean;
    library: boolean;
    restyleDetails: boolean;
    /** Native Home GameView minimalist mode (no cards/synopsis deck, compact bottom row + flat inline metadata). */
    minimalDetails: boolean;
    /** Alias kept for openIntent / openHome compatibility. */
    cleanDetails: boolean;
    /** Custom Library tab minimalist mode (vertical borderless list + full hero art). */
    minimalLibrary: boolean;
}

export function homeMode(s: Settings): HomeMode {
    const minimalDetails = s.enabled && (s.gamePageLayout === 'minimal' || (s.gamePageLayout === 'auto' && (s.homeLayout === 'minimal' || s.cleanPage)));
    const minimalLibrary = s.libraryLayout === 'minimal' || (s.libraryLayout === 'auto' && s.homeLayout === 'minimal');
    return {
        gamePage: s.enabled,
        home: s.spotlightHome,
        library: s.customLibrary,
        restyleDetails: s.enabled,
        minimalDetails,
        cleanDetails: minimalDetails,
        minimalLibrary,
    };
}
