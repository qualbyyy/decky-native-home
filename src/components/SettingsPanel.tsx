import { toaster } from '@decky/api';
import { ButtonItem, DropdownItem, PanelSection, PanelSectionRow, ToggleField } from '@decky/ui';
import { useMemo } from 'react';
import { PLUGIN_NAME } from '../constants';
import { cache } from '../data/cache';
import { HomeLayout, MinimalSide, PluginLanguage, settings, useSettings } from '../data/settings';
import { RECENT_ROW, ROW_SORTS, RowSort, rowSortLabel, sortByLabel, steamHomeCollections } from '../home/collections';
import { RowStyle } from '../home/recentsLayout';

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
        gamePage: 'Game Page',
        enableGamePage: 'Built-in game page',
        compactPage: 'Compact page layout',
        hideCover: 'Hide cover on game page',
        elements: 'Elements',
        gameLogos: 'Game logos',
        playtimeChip: 'Playtime next to Play',
        hltbChip: 'HowLongToBeat next to Play',
        hideTopBg: 'Hide top bar background',
        hltb: 'HowLongToBeat',
        autoPreload: 'Auto-preload HLTB',
        clearCache: 'Clear HLTB cache',
        cacheCleared: 'HLTB cache cleared',
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
        gamePage: 'Страница игры',
        enableGamePage: 'Встроенная страница игры',
        compactPage: 'Компактный вид страницы',
        hideCover: 'Скрывать обложку на странице игры',
        elements: 'Элементы',
        gameLogos: 'Логотипы игр',
        playtimeChip: 'Время игры рядом с «Играть»',
        hltbChip: 'HowLongToBeat рядом с «Играть»',
        hideTopBg: 'Скрывать фон верхней панели',
        hltb: 'HowLongToBeat',
        autoPreload: 'Автозагрузка HLTB',
        clearCache: 'Очистить кэш HLTB',
        cacheCleared: 'Кэш HLTB очищен',
    },
} as const;

export function SettingsPanel() {
    const {
        language,
        enabled,
        cleanPage,
        spotlightHome,
        homeLayout,
        minimalSide,
        minimalShowDetails,
        homeRowStyle,
        homeRow,
        homeRowSort,
        gameLogo,
        showPlaytime,
        showHltb,
        hideStatusBarBackground,
        hideGameCover,
        autoPreload,
    } = useSettings();
    const t = LABELS[language];
    const collections = useMemo(steamHomeCollections, []);
    const rowChosen = collections.some((c) => c.id === homeRow) ? homeRow : RECENT_ROW;

    return (
        <>
            <PanelSection title={t.home}>
                <PanelSectionRow>
                    <DropdownItem
                        label={t.language}
                        menuLabel={t.language}
                        rgOptions={[
                            { data: 'en', label: 'English' },
                            { data: 'ru', label: 'Русский' },
                        ]}
                        selectedOption={language}
                        onChange={(option) => settings.setLanguage(option.data as PluginLanguage)}
                    />
                </PanelSectionRow>
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
                            <ToggleField
                                label={t.compactPage}
                                checked={cleanPage}
                                onChange={(value) => settings.setCleanPage(value)}
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
                    <ToggleField
                        label={t.gameLogos}
                        checked={gameLogo}
                        onChange={(value) => settings.setGameLogo(value)}
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
        </>
    );
}
