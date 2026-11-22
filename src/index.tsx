import { stopDownloads } from './home/downloadStore';
import { definePlugin } from '@decky/api';
import { staticClasses } from '@decky/ui';
import { FaGamepad } from 'react-icons/fa';
import { SettingsPanel } from './components/SettingsPanel';
import { LOG_PREFIX, PLUGIN_NAME } from './constants';
import { startAutoPreload } from './data/autoPreload';
import { settings } from './data/settings';
import { getSteamLanguage } from './data/steam';
import { patchGamePage } from './patches/gamePage';
import { patchHomePage } from './patches/homePage';
import { noteLoad, remountHomeAfterReload } from './home/reloadRemount';

export default definePlugin(() => {
    settings.load().catch((error) => console.error(`${LOG_PREFIX} failed to load settings`, error));
    void getSteamLanguage();
    const unpatchGamePage = patchGamePage();
    const unpatchHome = patchHomePage();
    const cancelRemount = remountHomeAfterReload(noteLoad());
    const stopAutoPreload = startAutoPreload();
    console.log(`${LOG_PREFIX} loaded`);
    return {
        name: PLUGIN_NAME,
        titleView: <div className={staticClasses.Title}>{PLUGIN_NAME}</div>,
        content: <SettingsPanel />,
        icon: <FaGamepad />,
        onDismount() {
            const steps: [string, () => void][] = [
                ['game page unpatch', unpatchGamePage],
                ['Home unpatch', unpatchHome],
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
