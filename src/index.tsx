import { stopDownloads } from './home/downloadStore';
import { definePlugin } from '@decky/api';
import { staticClasses } from '@decky/ui';
import { SettingsPanel } from './components/SettingsPanel';
import { LOG_PREFIX, PLUGIN_NAME } from './constants';
import { startAutoPreload } from './data/autoPreload';
import { settings } from './data/settings';
import { getSteamLanguage } from './data/steam';
import { patchGamePage } from './patches/gamePage';
import { patchHomePage } from './patches/homePage';
import { patchLibraryPage } from './patches/libraryPage';
import { noteLoad, remountHomeAfterReload } from './home/reloadRemount';
import { installMenuChrome } from './styles/menuChromeHost';

function NativeHomeIcon() {
    return (
        <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
            <path d="M12 3.2 3.5 10.4a1 1 0 0 0-.35.76V19.5A1.5 1.5 0 0 0 4.65 21h4.1a.75.75 0 0 0 .75-.75v-4.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v4.5a.75.75 0 0 0 .75.75h4.1a1.5 1.5 0 0 0 1.5-1.5v-8.34a1 1 0 0 0-.35-.76L12 3.2Z" />
            <rect x="6.5" y="18.2" width="11" height="1.6" rx="0.8" opacity="0.45" />
        </svg>
    );
}

export default definePlugin(() => {
    settings.load().catch((error) => console.error(`${LOG_PREFIX} failed to load settings`, error));
    void getSteamLanguage();
    const unpatchGamePage = patchGamePage();
    const unpatchHome = patchHomePage();
    const unpatchLibrary = patchLibraryPage();
    const uninstallMenuChrome = installMenuChrome();
    const cancelRemount = remountHomeAfterReload(noteLoad());
    const stopAutoPreload = startAutoPreload();
    console.log(`${LOG_PREFIX} loaded`);
    return {
        name: PLUGIN_NAME,
        titleView: <div className={staticClasses.Title}>{PLUGIN_NAME}</div>,
        content: <SettingsPanel />,
        icon: <NativeHomeIcon />,
        onDismount() {
            const steps: [string, () => void][] = [
                ['game page unpatch', unpatchGamePage],
                ['Home unpatch', unpatchHome],
                ['Library unpatch', unpatchLibrary],
                ['menu chrome cleanup', uninstallMenuChrome],
                ['Home reopen cancel', cancelRemount],
                ['auto preload stop', stopAutoPreload],
                ['downloads stop', stopDownloads],
            ];
            for (const [what, step] of steps) {
                try {
                    step();
                } catch (error) {
                    console.error(`${LOG_PREFIX} ${what} failed`, error);
                }
            }
            console.log(`${LOG_PREFIX} unloaded`);
        },
    };
});
