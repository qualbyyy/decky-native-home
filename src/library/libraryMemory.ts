import type { LibrarySort, LibraryTabId } from './libraryData';

export interface LibraryMemoryState {
    tabId: LibraryTabId;
    appId: number;
    sort: LibrarySort;
    installedOnly: boolean;
}

let state: LibraryMemoryState = {
    tabId: 'all',
    appId: 0,
    sort: 'name',
    installedOnly: false,
};

export function readLibraryMemory(): LibraryMemoryState {
    return { ...state };
}

export function noteLibraryMemory(patch: Partial<LibraryMemoryState>): void {
    state = { ...state, ...patch };
}

export function resetLibraryMemory(): void {
    state = { tabId: 'all', appId: 0, sort: 'name', installedOnly: false };
}
