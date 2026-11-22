import { callable, fetchNoCors } from '@decky/api';
import { LOG_PREFIX } from '../constants';

export const REPOSITORY_URL = 'https://github.com/qualbyyy/decky-native-home';
export const REMOTE_PACKAGE_URL = 'https://raw.githubusercontent.com/qualbyyy/decky-native-home/main/package.json';

type RepositoryManifest = { version?: unknown };

export type RepositoryUpdateState =
    | { status: 'upToDate'; current: string; latest: string }
    | { status: 'available'; current: string; latest: string }
    | { status: 'error'; current: string | null };

const getVersion = callable<[], string | null>('get_version');

function parseVersion(text: unknown): number[] | null {
    if (typeof text !== 'string') return null;
    const core = text.trim().replace(/^v/i, '').split(/[-+]/)[0];
    if (!/^\d+(\.\d+){0,3}$/.test(core)) return null;
    return core.split('.').map(Number);
}

function isNewer(latest: string, current: string): boolean {
    const a = parseVersion(latest);
    const b = parseVersion(current);
    if (!a || !b) return false;
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
        const difference = (a[i] ?? 0) - (b[i] ?? 0);
        if (difference !== 0) return difference > 0;
    }
    return false;
}

export async function checkRepositoryUpdate(): Promise<RepositoryUpdateState> {
    let current: string | null = null;
    try {
        const installed = await getVersion();
        current = typeof installed === 'string' && parseVersion(installed) ? installed.trim().replace(/^v/i, '') : null;
        if (!current) return { status: 'error', current: null };
        const response = await fetchNoCors(REMOTE_PACKAGE_URL, { method: 'GET', headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
        const manifest = await response.json() as RepositoryManifest;
        const latest = typeof manifest.version === 'string' && parseVersion(manifest.version) ? manifest.version.trim().replace(/^v/i, '') : null;
        if (!latest) return { status: 'error', current };
        return isNewer(latest, current) ? { status: 'available', current, latest } : { status: 'upToDate', current, latest };
    } catch (error) {
        console.warn(`${LOG_PREFIX} repository update check failed`, error);
        return { status: 'error', current };
    }
}
