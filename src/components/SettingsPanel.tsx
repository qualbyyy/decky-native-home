import { toaster } from '@decky/api';
import { ButtonItem, DropdownItem, PanelSection, PanelSectionRow, ToggleField } from '@decky/ui';
import { useMemo } from 'react';
import { PLUGIN_NAME } from '../constants';
import { cache } from '../data/cache';
import { HomeLayout, MinimalSide, settings, useSettings } from '../data/settings';
import { RECENT_ROW, ROW_SORTS, RowSort, rowSortLabel, sortByLabel, steamHomeCollections } from '../home/collections';
import { RowStyle } from '../home/recentsLayout';

export function SettingsPanel() {
    const {
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
    const collections = useMemo(steamHomeCollections, []);
    const rowChosen = collections.some((c) => c.id === homeRow) ? homeRow : RECENT_ROW;

    return (
        <>
            <PanelSection title="Главная">
                <PanelSectionRow>
                    <ToggleField
                        label="Включить Native Home"
                        checked={spotlightHome}
                        onChange={(value) => settings.setSpotlightHome(value)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <DropdownItem
                        label="Режим главной"
                        menuLabel="Режим главной"
                        rgOptions={[
                            { data: 'carousel', label: 'Карусель обложек' },
                            { data: 'minimal', label: 'Минималистичный список' },
                        ]}
                        selectedOption={homeLayout}
                        onChange={(option) => settings.setHomeLayout(option.data as HomeLayout)}
                    />
                </PanelSectionRow>
                {homeLayout === 'minimal' ? (
                    <>
                        <PanelSectionRow>
                            <DropdownItem
                                label="Сторона списка"
                                menuLabel="Сторона списка"
                                rgOptions={[
                                    { data: 'left', label: 'Слева' },
                                    { data: 'right', label: 'Справа' },
                                ]}
                                selectedOption={minimalSide}
                                onChange={(option) => settings.setMinimalSide(option.data as MinimalSide)}
                            />
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ToggleField
                                label="Панель игры (лого, «Играть», запуск)"
                                checked={minimalShowDetails}
                                onChange={(value) => settings.setMinimalShowDetails(value)}
                            />
                        </PanelSectionRow>
                    </>
                ) : (
                    <PanelSectionRow>
                        <DropdownItem
                            label="Стиль карусели"
                            menuLabel="Стиль карусели"
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
                        label="Список игр"
                        menuLabel="Список игр"
                        rgOptions={[
                            { data: RECENT_ROW, label: 'Недавние игры' },
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

            <PanelSection title="Страница игры">
                <PanelSectionRow>
                    <ToggleField
                        label="Встроенная страница игры"
                        checked={enabled}
                        onChange={(value) => settings.setEnabled(value)}
                    />
                </PanelSectionRow>
                {enabled && (
                    <>
                        <PanelSectionRow>
                            <ToggleField
                                label="Компактный вид страницы"
                                checked={cleanPage}
                                onChange={(value) => settings.setCleanPage(value)}
                            />
                        </PanelSectionRow>
                        <PanelSectionRow>
                            <ToggleField
                                label="Скрывать обложку на странице игры"
                                checked={hideGameCover}
                                onChange={(value) => settings.setHideGameCover(value)}
                            />
                        </PanelSectionRow>
                    </>
                )}
            </PanelSection>

            <PanelSection title="Элементы">
                <PanelSectionRow>
                    <ToggleField
                        label="Логотипы игр"
                        checked={gameLogo}
                        onChange={(value) => settings.setGameLogo(value)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label="Время игры рядом с «Играть»"
                        checked={showPlaytime}
                        onChange={(value) => settings.setShowPlaytime(value)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label="HowLongToBeat рядом с «Играть»"
                        checked={showHltb}
                        onChange={(value) => settings.setShowHltb(value)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ToggleField
                        label="Скрывать фон верхней панели"
                        checked={hideStatusBarBackground}
                        onChange={(value) => settings.setHideStatusBarBackground(value)}
                    />
                </PanelSectionRow>
            </PanelSection>

            <PanelSection title="HowLongToBeat">
                <PanelSectionRow>
                    <ToggleField
                        label="Автозагрузка HLTB"
                        checked={autoPreload}
                        onChange={(value) => settings.setAutoPreload(value)}
                    />
                </PanelSectionRow>
                <PanelSectionRow>
                    <ButtonItem
                        layout="below"
                        onClick={async () => {
                            await cache.clear();
                            toaster.toast({ title: PLUGIN_NAME, body: 'Кэш HLTB очищен' });
                        }}
                    >
                        Очистить кэш HLTB
                    </ButtonItem>
                </PanelSectionRow>
            </PanelSection>
        </>
    );
}
