import { toaster } from '@decky/api';
import { ButtonItem, DropdownItem, PanelSection, PanelSectionRow, showModal, ToggleField } from '@decky/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PLUGIN_NAME } from '../constants';
import { CustomTabsModal } from './CustomTabsModal';
import { cache } from '../data/cache';
import { checkRepositoryUpdate, RepositoryUpdateState } from '../data/repositoryUpdate';
import { GamePageLayout, HeroPosition, HomeLayout, LibraryGridSize, LibraryLayout, MinimalSide, settings, useSettings } from '../data/settings';
import { getSteamLanguage, peekSteamLanguage } from '../data/steam';
import { RECENT_ROW, ROW_SORTS, RowSort, rowSortLabel, sortByLabel, steamHomeCollections } from '../home/collections';
import { RowStyle } from '../home/recentsLayout';
import { useAsync } from '../hooks/useAsync';
import { isRussianSystem } from '../i18n/steamText';
import { registerMenuChromeDocument } from '../styles/menuChromeHost';

const LABELS = {
    en: {
        home: 'Home',
        language: 'Language',
        enableHome: 'Enable Native Home',
        homeMode: 'Home layout',
        carousel: 'Cover carousel',
        minimal: 'Minimalist list',
        listSide: 'List side',
        left: 'Left',
        right: 'Right',
        minimalDetails: 'Game panel (logo, Play, last played)',
        carouselStyle: 'Carousel style',
        gamesList: 'Games list',
        recentGames: 'Recent games',
        library: 'Library',
        enableLibrary: 'Custom Library tab',
        libraryMode: 'Library layout',
        gridColumns: 'Covers per row',
        gridSize: 'Cover size',
        small: 'Small',
        medium: 'Medium',
        large: 'Large',
        followHome: 'Follow Home',
        coverGrid: 'Cover grid',
        tabMasterIntegration: 'TabMaster tabs integration',
        showHiddenTab: 'Show Hidden Games tab',
        manageCustomTabs: 'Manage custom tabs',
        gamePage: 'Game Page',
        enableGamePage: 'Built-in game page',
        gamePageMode: 'Game page style',
        fullView: 'Full',
        minimalView: 'Minimalist',
        hideCover: 'Hide cover on game page',
        heroPosition: 'Cover alignment',
        posCenter: 'Center',
        posLeft: 'Left',
        posRight: 'Right',
        posTop: 'Top',
        posBottom: 'Bottom',
        elements: 'Elements',
        gameLogos: 'Game logos',
        newLabel: 'Show “New” marker',
        lastPlayedLabel: 'Show “Last played” text',
        playtimeChip: 'Playtime next to Play',
        hltbChip: 'HowLongToBeat next to Play',
        hideTopBg: 'Hide top bar background',
        customMenus: 'Custom context windows',
        hltb: 'HowLongToBeat',
        autoPreload: 'Auto-preload HLTB',
        clearCache: 'Clear HLTB cache',
        cacheCleared: 'HLTB cache cleared',
        updates: 'Updates',
        checkUpdates: 'Check for updates',
        checkingUpdates: 'Checking for updates…',
        upToDate: (version: string) => `You have the latest version (${version})`,
        updateAvailable: (version: string) => `Available version ${version}`,
        updateError: 'Could not check the GitHub repository',
    },
    ru: {
        home: 'Главная',
        language: 'Язык',
        enableHome: 'Включить Native Home',
        homeMode: 'Режим главной',
        carousel: 'Карусель обложек',
        minimal: 'Минималистичный список',
        listSide: 'Сторона списка',
        left: 'Слева',
        right: 'Справа',
        minimalDetails: 'Панель игры (лого, «Играть», запуск)',
        carouselStyle: 'Стиль карусели',
        gamesList: 'Список игр',
        recentGames: 'Недавние игры',
        library: 'Библиотека',
        enableLibrary: 'Кастомная вкладка библиотеки',
        libraryMode: 'Вид библиотеки',
        gridColumns: 'Обложек в строке',
        gridSize: 'Размер обложек',
        small: 'Маленькие',
        medium: 'Средние',
        large: 'Большие',
        followHome: 'Как на главной',
        coverGrid: 'Сетка обложек',
        tabMasterIntegration: 'Интеграция вкладок TabMaster',
        showHiddenTab: 'Показывать вкладку «Скрытые»',
        manageCustomTabs: 'Настроить свои вкладки',
        gamePage: 'Страница игры',
        enableGamePage: 'Встроенная страница игры',
        gamePageMode: 'Стиль страницы игры',
        fullView: 'Полный',
        minimalView: 'Минималистичный',
        hideCover: 'Скрывать обложку на странице игры',
        heroPosition: 'Центрирование обложки',
        posCenter: 'По центру',
        posLeft: 'Слева',
        posRight: 'Справа',
        posTop: 'Сверху',
        posBottom: 'Снизу',
        elements: 'Элементы',
        gameLogos: 'Логотипы игр',
        newLabel: 'Показывать метку «Новое»',
        lastPlayedLabel: 'Показывать текст «Последний запуск»',
        playtimeChip: 'Время игры рядом с «Играть»',
        hltbChip: 'HowLongToBeat рядом с «Играть»',
        hideTopBg: 'Скрывать фон верхней панели',
        customMenus: 'Кастомные контекстные окна',
        hltb: 'HowLongToBeat',
        autoPreload: 'Автозагрузка HLTB',
        clearCache: 'Очистить кэш HLTB',
        cacheCleared: 'Кэш HLTB очищен',
        updates: 'Обновления',
        checkUpdates: 'Проверить обновления',
        checkingUpdates: 'Проверка обновлений…',
        upToDate: (version: string) => `Установлена последняя версия (${version})`,
        updateAvailable: (version: string) => `Доступна версия ${version}`,
        updateError: 'Не удалось проверить репозиторий GitHub',
    },
} as const;

export function SettingsPanel() {
    const {
        enabled,
        gamePageLayout,
        customLibrary,
        libraryLayout,
        libraryGridColumns,
        libraryGridSize,
        libraryTabMaster,
        libraryShowHiddenTab,
        customLibraryTabs,
        spotlightHome,
        homeLayout,
        minimalSide,
        minimalShowDetails,
        homeRowStyle,
        homeRow,
        homeRowSort,
        gameLogo,
        showNewLabel,
        showLastPlayedLabel,
        showPlaytime,
        showHltb,
        hideStatusBarBackground,
        customMenus,
        hideGameCover,
        heroPosition,
        autoPreload,
    } = useSettings();
    const knownLang = peekSteamLanguage();
    const loadedLang = useAsync(knownLang ? null : 'lang', getSteamLanguage);
    const isRu = (knownLang ?? loadedLang ?? '').toLowerCase().startsWith('ru') || isRussianSystem();
    const t = LABELS[isRu ? 'ru' : 'en'];
    const qamMarkerRef = useRef<HTMLSpanElement | null>(null);
    const mountedRef = useRef(true);
    useEffect(() => () => { mountedRef.current = false; }, []);
    useEffect(() => {
        if (customMenus && qamMarkerRef.current?.ownerDocument) {
            registerMenuChromeDocument(qamMarkerRef.current.ownerDocument, 'quickaccess');
        }
    }, [customMenus]);
    const [updateState, setUpdateState] = useState<RepositoryUpdateState | { status: 'idle' | 'checking'; current: string | null }>({ status: 'idle', current: null });
    const collections = useMemo(steamHomeCollections, []);
    const checkUpdates = async () => {
        if (updateState.status === 'checking') return;
        setUpdateState({ status: 'checking', current: updateState.current });
        const next = await checkRepositoryUpdate();
        if (!mountedRef.current) return;
        setUpdateState(next);
        const body = next.status === 'upToDate'
            ? t.upToDate(next.latest)
            : next.status === 'available'
                ? t.updateAvailable(next.latest)
                : t.updateError;
        toaster.toast({ title: PLUGIN_NAME, body });
    };
    const rowChosen = collections.some((c) => c.id === homeRow) ? homeRow : RECENT_ROW;

    return (
        <>
            <span
                ref={(el) => {
                    qamMarkerRef.current = el;
                    if (customMenus && el?.ownerDocument) registerMenuChromeDocument(el.ownerDocument, 'quickaccess');
                }}
                style={{ display: 'none' }}
                aria-hidden="true"
            />
            <PanelSection title={t.home}>
                <PanelSectionRow>
                    <ToggleField
                        label={t.enableHome}
                        checked={spotlightHome}
                        onChange={(value) => settings.setSpotlightHome(value)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <DropdownItem
                        label={t.homeMode}
                        menuLabel={t.homeMode}
                        rgOptions={[
                            { data: 'carousel', label: t.carousel },
                            { data: 'minimal', label: t.minimal },
                        ]}
                        selectedOption={homeLayout}
                        onChange={(option) => settings.setHomeLayout(option.data as HomeLayout)}
                    />
                </PanelSectionRow>
                {homeLayout === 'minimal' ? (
                    <>
                        <PanelSectionRow>
                            <DropdownItem
                                label={t.listSide}
                                menuLabel={t.listSide}
                                rgOptions={[
                                    { data: 'left', label: t.left },
                                    { data: 'right', label: t.right },
                                ]}
                                selectedOption={minimalSide}
                                onChange={(option) => settings.setMinimalSide(option.data as MinimalSide)}
                            />
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ToggleField
                                label={t.minimalDetails}
                                checked={minimalShowDetails}
                                onChange={(value) => settings.setMinimalShowDetails(value)}
                            />
                        </PanelSectionRow>
                    </>
                ) : (
                    <PanelSectionRow>
                        <DropdownItem
                            label={t.carouselStyle}
                            menuLabel={t.carouselStyle}
                            rgOptions={[
                                { data: 'steam', label: 'Steam' },
                                { data: 'spotlight', label: 'Spotlight' },
                            ]}
                            selectedOption={homeRowStyle}
                            onChange={(option) => settings.setHomeRowStyle(option.data as RowStyle)}
                        />
                    </PanelSectionRow>
                )}
                <PanelSectionRow>
                    <DropdownItem
                        label={t.gamesList}
                        menuLabel={t.gamesList}
                        rgOptions={[
                            { data: RECENT_ROW, label: t.recentGames },
                            ...collections.map((c) => ({ data: c.id, label: `${c.name} (${c.count})` })),
                        ]}
                        selectedOption={rowChosen}
                        onChange={(option) => settings.setHomeRow(String(option.data))}
                    />
                </PanelSectionRow>
                {rowChosen !== RECENT_ROW && (
                    <PanelSectionRow>
                        <DropdownItem
                            label={sortByLabel()}
                            menuLabel={sortByLabel()}
                            rgOptions={ROW_SORTS.map((s) => ({ data: s, label: rowSortLabel(s) }))}
                            selectedOption={homeRowSort}
                            onChange={(option) => settings.setHomeRowSort(option.data as RowSort)}
                        />
                    </PanelSectionRow>
                )}
            </PanelSection>

            <PanelSection title={t.library}>
                <PanelSectionRow>
                    <ToggleField
                        label={t.enableLibrary}
                        checked={customLibrary}
                        onChange={(value) => settings.setCustomLibrary(value)}
                    />
                </PanelSectionRow>
                {customLibrary && (
                    <>
                        <PanelSectionRow>
                            <DropdownItem
                                label={t.libraryMode}
                                menuLabel={t.libraryMode}
                                rgOptions={[
                                    { data: 'auto', label: t.followHome },
                                    { data: 'grid', label: t.coverGrid },
                                    { data: 'minimal', label: t.minimal },
                                ]}
                                selectedOption={libraryLayout}
                                onChange={(option) => settings.setLibraryLayout(option.data as LibraryLayout)}
                            />
                        </PanelSectionRow>
                        {(libraryLayout === 'grid' || (libraryLayout === 'auto' && homeLayout === 'carousel')) && (
                            <>
                                <PanelSectionRow>
                                    <DropdownItem
                                        label={t.gridColumns}
                                        menuLabel={t.gridColumns}
                                        rgOptions={[4, 5, 6, 7].map((value) => ({ data: value, label: String(value) }))}
                                        selectedOption={libraryGridColumns}
                                        onChange={(option) => settings.setLibraryGridColumns(Number(option.data))}
                                    />
                                </PanelSectionRow>
                                <PanelSectionRow>
                                    <DropdownItem
                                        label={t.gridSize}
                                        menuLabel={t.gridSize}
                                        rgOptions={[
                                            { data: 'compact', label: t.small },
                                            { data: 'standard', label: t.medium },
                                            { data: 'large', label: t.large },
                                        ]}
                                        selectedOption={libraryGridSize}
                                        onChange={(option) => settings.setLibraryGridSize(option.data as LibraryGridSize)}
                                    />
                                </PanelSectionRow>
                            </>
                        )}
                        <PanelSectionRow>
                            <ToggleField
                                label={t.tabMasterIntegration}
                                checked={libraryTabMaster}
                                onChange={(value) => settings.setLibraryTabMaster(value)}
                            />
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ToggleField
                                label={t.showHiddenTab}
                                checked={libraryShowHiddenTab}
                                onChange={(value) => settings.setLibraryShowHiddenTab(value)}
                            />
                        </PanelSectionRow>
                        {customLibraryTabs.map((tab) => (
                            <PanelSectionRow key={tab.id}>
                                <ToggleField
                                    label={tab.title}
                                    checked={tab.enabled}
                                    onChange={(value) =>
                                        settings.setCustomLibraryTabs(
                                            customLibraryTabs.map((item) => (item.id === tab.id ? { ...item, enabled: value } : item)),
                                        )
                                    }
                                />
                            </PanelSectionRow>
                        ))}
                        <PanelSectionRow>
                            <ButtonItem
                                layout="below"
                                onClick={() => showModal(<CustomTabsModal ru={isRu} />)}
                            >
                                {t.manageCustomTabs}
                            </ButtonItem>
                        </PanelSectionRow>
                    </>
                )}
            </PanelSection>

            <PanelSection title={t.gamePage}>
                <PanelSectionRow>
                    <ToggleField
                        label={t.enableGamePage}
                        checked={enabled}
                        onChange={(value) => settings.setEnabled(value)}
                    />
                </PanelSectionRow>
                {enabled && (
                    <>
                        <PanelSectionRow>
                            <DropdownItem
                                label={t.gamePageMode}
                                menuLabel={t.gamePageMode}
                                rgOptions={[
                                    { data: 'auto', label: t.followHome },
                                    { data: 'full', label: t.fullView },
                                    { data: 'minimal', label: t.minimalView },
                                ]}
                                selectedOption={gamePageLayout}
                                onChange={(option) => settings.setGamePageLayout(option.data as GamePageLayout)}
                            />
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ToggleField
                                label={t.hideCover}
                                checked={hideGameCover}
                                onChange={(value) => settings.setHideGameCover(value)}
                            />
                        </PanelSectionRow>
                    </>
                )}
            </PanelSection>

            <PanelSection title={t.elements}>
                <PanelSectionRow>
                    <DropdownItem
                        label={t.heroPosition}
                        menuLabel={t.heroPosition}
                        rgOptions={[
                            { data: 'center', label: t.posCenter },
                            { data: 'left', label: t.posLeft },
                            { data: 'right', label: t.posRight },
                            { data: 'top', label: t.posTop },
                            { data: 'bottom', label: t.posBottom },
                        ]}
                        selectedOption={heroPosition}
                        onChange={(option) => settings.setHeroPosition(option.data as HeroPosition)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label={t.gameLogos}
                        checked={gameLogo}
                        onChange={(value) => settings.setGameLogo(value)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label={t.newLabel}
                        checked={showNewLabel}
                        onChange={(value) => settings.setShowNewLabel(value)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label={t.lastPlayedLabel}
                        checked={showLastPlayedLabel}
                        onChange={(value) => settings.setShowLastPlayedLabel(value)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label={t.playtimeChip}
                        checked={showPlaytime}
                        onChange={(value) => settings.setShowPlaytime(value)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label={t.hltbChip}
                        checked={showHltb}
                        onChange={(value) => settings.setShowHltb(value)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label={t.hideTopBg}
                        checked={hideStatusBarBackground}
                        onChange={(value) => settings.setHideStatusBarBackground(value)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label={t.customMenus}
                        checked={customMenus}
                        onChange={(value) => settings.setCustomMenus(value)}
                    />
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title={t.hltb}>
                <PanelSectionRow>
                    <ToggleField
                        label={t.autoPreload}
                        checked={autoPreload}
                        onChange={(value) => settings.setAutoPreload(value)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={async () => {
                            await cache.clear();
                            toaster.toast({ title: PLUGIN_NAME, body: t.cacheCleared });
                        }}
                    >
                        {t.clearCache}
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title={t.updates}>
                <PanelSectionRow>
                    <ButtonItem layout="below" disabled={updateState.status === 'checking'} onClick={checkUpdates}>
                        {updateState.status === 'checking' ? t.checkingUpdates : t.checkUpdates}
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>
        </>
    );
}
