import {
    DialogButton,
    DropdownItem,
    Focusable,
    ModalRoot,
    PanelSection,
    PanelSectionRow,
    TextField,
    ToggleField,
} from '@decky/ui';
import { useMemo, useState } from 'react';
import { FaArrowDown, FaArrowUp, FaEdit, FaPlus, FaTrash } from 'react-icons/fa';
import { CustomLibraryTab, settings, useSettings } from '../data/settings';
import { steamHomeCollections } from '../home/collections';

interface CustomTabsModalProps {
    ru: boolean;
    closeModal?: () => void;
}

const COPY = {
    en: {
        title: 'Custom Library Tabs',
        add: 'New custom tab',
        empty: 'No custom tabs yet. Create one to filter your library by collections, Deck compatibility, platform, or hidden games.',
        tabName: 'Tab name',
        defaultName: 'Custom Tab',
        matchMode: 'Match rules',
        matchAll: 'All rules (AND)',
        matchAny: 'Any rule (OR)',
        installed: 'Install status',
        any: 'Any',
        onlyInstalled: 'Installed only',
        onlyUninstalled: 'Not installed',
        platform: 'Platform',
        steamOnly: 'Steam',
        nonSteamOnly: 'Non-Steam',
        deckCompat: 'Steam Deck',
        verified: 'Verified',
        playable: 'Verified & Playable',
        unplayed: 'Unplayed only',
        collection: 'Collection',
        noCollection: 'None (All apps)',
        hiddenGames: 'Hidden games',
        hiddenExclude: 'Exclude hidden',
        hiddenInclude: 'Include hidden',
        hiddenOnly: 'Hidden games only',
        save: 'Save',
        cancel: 'Cancel',
        close: 'Done',
    },
    ru: {
        title: 'Свои вкладки библиотеки',
        add: 'Новая вкладка',
        empty: 'Пока нет своих вкладок. Создайте вкладку по коллекции, совместимости со Steam Deck, платформе или скрытым играм.',
        tabName: 'Название вкладки',
        defaultName: 'Моя вкладка',
        matchMode: 'Совпадение правил',
        matchAll: 'Все правила (И)',
        matchAny: 'Любое правило (ИЛИ)',
        installed: 'Установка',
        any: 'Любые',
        onlyInstalled: 'Только установленные',
        onlyUninstalled: 'Не установленные',
        platform: 'Платформа',
        steamOnly: 'Steam',
        nonSteamOnly: 'Сторонние',
        deckCompat: 'Steam Deck',
        verified: 'Полностью совместимые',
        playable: 'Совместимые и играбельные',
        unplayed: 'Только не запущенные',
        collection: 'Коллекция',
        noCollection: 'Любая (вся библиотека)',
        hiddenGames: 'Скрытые игры',
        hiddenExclude: 'Скрывать',
        hiddenInclude: 'Включать скрытые',
        hiddenOnly: 'Только скрытые',
        save: 'Сохранить',
        cancel: 'Отмена',
        close: 'Готово',
    },
} as const;

function blankTab(title: string): CustomLibraryTab {
    return {
        id: `tab-${Date.now().toString(36)}`,
        title,
        enabled: true,
        mode: 'all',
        installed: 'any',
        platform: 'any',
        deckCompat: 'any',
        unplayedOnly: false,
        collectionId: undefined,
        hiddenMode: 'exclude',
    };
}

export function CustomTabsModal({ ru, closeModal }: CustomTabsModalProps) {
    const t = COPY[ru ? 'ru' : 'en'];
    const { customLibraryTabs } = useSettings();
    const collections = useMemo(steamHomeCollections, []);
    const [editing, setEditing] = useState<CustomLibraryTab | null>(null);

    const saveTabs = (next: CustomLibraryTab[]) => {
        void settings.setCustomLibraryTabs(next);
    };

    const moveTab = (idx: number, delta: -1 | 1) => {
        const target = idx + delta;
        if (target < 0 || target >= customLibraryTabs.length) return;
        const next = [...customLibraryTabs];
        const [item] = next.splice(idx, 1);
        next.splice(target, 0, item);
        saveTabs(next);
    };

    const deleteTab = (id: string) => {
        saveTabs(customLibraryTabs.filter((tab) => tab.id !== id));
    };

    const toggleTab = (id: string, enabled: boolean) => {
        saveTabs(customLibraryTabs.map((tab) => (tab.id === id ? { ...tab, enabled } : tab)));
    };

    const saveEditing = () => {
        if (!editing) return;
        const clean: CustomLibraryTab = {
            ...editing,
            title: editing.title.trim() || t.defaultName,
        };
        const exists = customLibraryTabs.some((tab) => tab.id === clean.id);
        const next = exists
            ? customLibraryTabs.map((tab) => (tab.id === clean.id ? clean : tab))
            : [...customLibraryTabs, clean];
        saveTabs(next);
        setEditing(null);
    };

    if (editing) {
        return (
            <ModalRoot onCancel={() => setEditing(null)}>
                <PanelSection title={editing.title || t.add}>
                    <PanelSectionRow>
                        <TextField
                            label={t.tabName}
                            value={editing.title}
                            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                        />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <DropdownItem
                            label={t.matchMode}
                            selectedOption={editing.mode}
                            rgOptions={[
                                { data: 'all', label: t.matchAll },
                                { data: 'any', label: t.matchAny },
                            ]}
                            onChange={(opt) => setEditing({ ...editing, mode: opt.data as 'all' | 'any' })}
                        />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <DropdownItem
                            label={t.installed}
                            selectedOption={editing.installed ?? 'any'}
                            rgOptions={[
                                { data: 'any', label: t.any },
                                { data: 'installed', label: t.onlyInstalled },
                                { data: 'uninstalled', label: t.onlyUninstalled },
                            ]}
                            onChange={(opt) => setEditing({ ...editing, installed: opt.data as CustomLibraryTab['installed'] })}
                        />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <DropdownItem
                            label={t.platform}
                            selectedOption={editing.platform ?? 'any'}
                            rgOptions={[
                                { data: 'any', label: t.any },
                                { data: 'steam', label: t.steamOnly },
                                { data: 'nonsteam', label: t.nonSteamOnly },
                            ]}
                            onChange={(opt) => setEditing({ ...editing, platform: opt.data as CustomLibraryTab['platform'] })}
                        />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <DropdownItem
                            label={t.deckCompat}
                            selectedOption={editing.deckCompat ?? 'any'}
                            rgOptions={[
                                { data: 'any', label: t.any },
                                { data: 'verified', label: t.verified },
                                { data: 'playable', label: t.playable },
                            ]}
                            onChange={(opt) => setEditing({ ...editing, deckCompat: opt.data as CustomLibraryTab['deckCompat'] })}
                        />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <DropdownItem
                            label={t.collection}
                            selectedOption={editing.collectionId ?? ''}
                            rgOptions={[
                                { data: '', label: t.noCollection },
                                ...collections.map((c) => ({ data: c.id, label: `${c.name} (${c.count})` })),
                            ]}
                            onChange={(opt) => setEditing({ ...editing, collectionId: opt.data ? String(opt.data) : undefined })}
                        />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <DropdownItem
                            label={t.hiddenGames}
                            selectedOption={editing.hiddenMode ?? 'exclude'}
                            rgOptions={[
                                { data: 'exclude', label: t.hiddenExclude },
                                { data: 'include', label: t.hiddenInclude },
                                { data: 'only', label: t.hiddenOnly },
                            ]}
                            onChange={(opt) => setEditing({ ...editing, hiddenMode: opt.data as CustomLibraryTab['hiddenMode'] })}
                        />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <ToggleField
                            label={t.unplayed}
                            checked={editing.unplayedOnly === true}
                            onChange={(value) => setEditing({ ...editing, unplayedOnly: value })}
                        />
                    </PanelSectionRow>
                    <PanelSectionRow>
                        <Focusable flow-children="row" style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <DialogButton onClick={saveEditing}>{t.save}</DialogButton>
                            <DialogButton onClick={() => setEditing(null)}>{t.cancel}</DialogButton>
                        </Focusable>
                    </PanelSectionRow>
                </PanelSection>
            </ModalRoot>
        );
    }

    return (
        <ModalRoot onCancel={closeModal} closeModal={closeModal}>
            <PanelSection title={t.title}>
                {customLibraryTabs.length === 0 && (
                    <PanelSectionRow>
                        <div style={{ fontSize: '13px', opacity: 0.78, padding: '6px 0' }}>{t.empty}</div>
                    </PanelSectionRow>
                )}
                {customLibraryTabs.map((tab, idx) => (
                    <PanelSectionRow key={tab.id}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                            <ToggleField
                                label={tab.title}
                                checked={tab.enabled}
                                onChange={(val) => toggleTab(tab.id, val)}
                            />
                            <Focusable flow-children="row" style={{ display: 'flex', gap: '6px' }}>
                                <DialogButton onClick={() => setEditing({ ...tab })} style={{ minWidth: '40px', padding: '6px 10px' }}>
                                    <FaEdit />
                                </DialogButton>
                                <DialogButton
                                    disabled={idx === 0}
                                    onClick={() => moveTab(idx, -1)}
                                    style={{ minWidth: '40px', padding: '6px 10px' }}
                                >
                                    <FaArrowUp />
                                </DialogButton>
                                <DialogButton
                                    disabled={idx === customLibraryTabs.length - 1}
                                    onClick={() => moveTab(idx, 1)}
                                    style={{ minWidth: '40px', padding: '6px 10px' }}
                                >
                                    <FaArrowDown />
                                </DialogButton>
                                <DialogButton
                                    onClick={() => deleteTab(tab.id)}
                                    style={{ minWidth: '40px', padding: '6px 10px' }}
                                >
                                    <FaTrash />
                                </DialogButton>
                            </Focusable>
                        </div>
                    </PanelSectionRow>
                ))}
                <PanelSectionRow>
                    <Focusable flow-children="row" style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <DialogButton onClick={() => setEditing(blankTab(t.defaultName))}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <FaPlus /> {t.add}
                            </span>
                        </DialogButton>
                        <DialogButton onClick={closeModal}>{t.close}</DialogButton>
                    </Focusable>
                </PanelSectionRow>
            </PanelSection>
        </ModalRoot>
    );
}
