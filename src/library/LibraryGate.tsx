import { Component, ReactElement, ReactNode } from 'react';
import { LOG_PREFIX } from '../constants';
import { useSettings } from '../data/settings';
import { homeMode } from '../home/mode';
import { CustomLibrary } from './CustomLibrary';

let logged = false;

class LibraryErrorBoundary extends Component<{ fallback: ReactElement; children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: unknown) {
        if (logged) return;
        logged = true;
        console.error(`${LOG_PREFIX} Custom Library render failed; showing Steam Library`, error);
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

export function LibraryGate({ children: fallback }: { children: ReactElement }) {
    const settings = useSettings();
    if (!homeMode(settings).library) return fallback;
    return (
        <LibraryErrorBoundary fallback={fallback}>
            <CustomLibrary />
        </LibraryErrorBoundary>
    );
}
