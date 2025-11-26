// frontend/src/components/TopToolbar/TopToolbar.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ThemeToggleButton from '../common/ThemeToggleButton';
import LanguageSwitcher from '../common/LanguageSwitcher';
import './TopToolbar.css'; // Ensure CSS is imported

// --- ICONS (FIXED) ---
// Note: We use <g transform="..."> to ensure rotation works in all browsers
const AlignLeftIcon = () => <svg viewBox="0 0 24 24"><path d="M15 21v-4h2v4h-2zm-4 0v-8h2v8h-2zm-4 0v-6h2v6H7zM3 3v16h2V3H3z"/></svg>;
const AlignHCenterIcon = () => <svg viewBox="0 0 24 24"><path d="M11 2v4h2V2h-2zm-4 6v10h2V8H7zm8 0v10h2V8h-2zM3 2v4h2V2H3zm16 0v4h2V2h-2z"/></svg>;
const AlignRightIcon = () => <svg viewBox="0 0 24 24"><path d="M7 21v-4h2v4H7zm4 0v-8h2v8h-2zm4 0v-6h2v6h-2zM19 3v16h2V3h-2z"/></svg>;

const AlignTopIcon = () => (
    <svg viewBox="0 0 24 24">
        <g transform="rotate(90 12 12)">
            <path d="M15 21v-4h2v4h-2zm-4 0v-8h2v8h-2zm-4 0v-6h2v6H7zM3 3v16h2V3H3z"/>
        </g>
    </svg>
);

const AlignVCenterIcon = () => (
    <svg viewBox="0 0 24 24">
        <g transform="rotate(90 12 12)">
            <path d="M11 2v4h2V2h-2zm-4 6v10h2V8H7zm8 0v10h2V8h-2zM3 2v4h2V2H3zm16 0v4h2V2h-2z"/>
        </g>
    </svg>
);

const AlignBottomIcon = () => (
    <svg viewBox="0 0 24 24">
        <g transform="rotate(90 12 12)">
            <path d="M7 21v-4h2v4H7zm4 0v-8h2v8h-2zm4 0v-6h2v6h-2zM19 3v16h2V3h-2z"/>
        </g>
    </svg>
);

const DistributeHIcon = () => <svg viewBox="0 0 24 24"><path d="M3 17v2h18v-2H3zm3.5-7L3 6.5l3.5-3.5v2.5h11V3L21 6.5 17.5 10v-2.5H6.5V10z"/></svg>;
const DistributeVIcon = () => <svg viewBox="0 0 24 24"><path d="M17 3v18h2V3h-2zM3 3v2h10V3H3zm3.5 10.5L3 17l3.5 3.5v-2.5h5V21l3.5-3.5-3.5-3.5v2.5h-5V13.5z"/></svg>;


// --- SUB-COMPONENTS ---
const useDebouncedUpdater = (selectedElement, onUpdateNodeData) => {
    const [localData, setLocalData] = useState(selectedElement.data);
    
    useEffect(() => {
      setLocalData(selectedElement.data);
    }, [selectedElement]);
  
    useEffect(() => {
      if (JSON.stringify(localData) === JSON.stringify(selectedElement.data)) return;
      const handler = setTimeout(() => {
          onUpdateNodeData(selectedElement.id, localData);
      }, 500);
      return () => clearTimeout(handler);
    }, [localData, selectedElement, onUpdateNodeData]);

    const handleChange = (e) => {
      const { id, value, type } = e.target;
      const parsedValue = type === 'number' || type === 'range' ? parseFloat(value) : value;
      setLocalData(prev => ({ ...prev, [id]: parsedValue }));
    };

    return [localData, handleChange];
};

const ToolbarPlaceholder = () => {
    const { t } = useTranslation();
    return <div className='toolbar-placeholder toolbar-info-text'>{t('sidebar.placeholderClickNode')}</div>;
}

const DeviceProperties = ({ node, onUpdateNodeData, availableIcons }) => {
    const { t } = useTranslation();
    const [localData, handleChange] = useDebouncedUpdater(node, onUpdateNodeData);

    return (
        <>
            <div className="toolbar-group">
                <label htmlFor="hostname">{t('sidebar.hostname')}</label>
                <input id="hostname" type="text" value={localData.hostname || ''} onChange={handleChange} style={{width: '160px'}}/>
            </div>
            <div className="toolbar-group">
                <label>{t('sidebar.ipAddress')}</label>
                <input type="text" value={node.data.ip} disabled={true} style={{width: '120px'}}/>
            </div>
            <div className="toolbar-group">
                <label htmlFor="iconType">{t('sidebar.deviceType')}</label>
                <select id="iconType" value={localData.iconType} onChange={handleChange}>
                    {availableIcons.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
            </div>
        </>
    );
};

const GROUP_SHAPES = [
    { name: 'sidebar.shapeRoundedRectangle', value: 'rounded-rectangle' },
    { name: 'sidebar.shapeCircle', value: 'circle' },
    { name: 'sidebar.shapeTriangle', value: 'triangle' }
];

const GroupProperties = ({ node, onUpdateNodeData }) => {
    const { t } = useTranslation();
    const [localData, handleChange] = useDebouncedUpdater(node, onUpdateNodeData);

    return (
        <>
            <div className="toolbar-group">
                <label htmlFor="label">{t('sidebar.groupLabel')}</label>
                <input id="label" type="text" value={localData.label || ''} onChange={handleChange} style={{width: '150px'}} />
            </div>
            <div className="toolbar-separator" />
             <div className="toolbar-group">
                <label htmlFor="shape">{t('sidebar.groupShape')}</label>
                <select id="shape" value={localData.shape || GROUP_SHAPES[0].value} onChange={handleChange}>
                    {GROUP_SHAPES.map(s => <option key={s.value} value={s.value}>{t(s.name)}</option>)}
                </select>
            </div>
            <div className="toolbar-group">
                <label htmlFor="color">{t('sidebar.groupColor')}</label>
                <input id="color" type="color" value={localData.color} onChange={handleChange} />
            </div>
            <div className="toolbar-group">
                <label htmlFor="opacity">{t('sidebar.opacity')}</label>
                <input id="opacity" type="range" min="0.1" max="1" step="0.05" value={localData.opacity} onChange={handleChange} />
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
                <label htmlFor="width">{t('sidebar.width')}</label>
                <input id="width" type="number" value={localData.width} onChange={handleChange} />
            </div>
             <div className="toolbar-group">
                <label htmlFor="height">{t('sidebar.height')}</label>
                <input id="height" type="number" value={localData.height} onChange={handleChange} />
            </div>
        </>
    );
};

const TextProperties = ({ node, onUpdateNodeData }) => {
    const { t } = useTranslation();
    const [localData, handleChange] = useDebouncedUpdater(node, onUpdateNodeData);
    
    return (
         <>
            <div className="toolbar-group">
                <label htmlFor="text">{t('sidebar.textContent')}</label>
                <input id="text" type="text" value={localData.text || ''} onChange={handleChange} style={{width: '200px'}} />
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
                <label htmlFor="fontSize">{t('sidebar.fontSize')}</label>
                <input id="fontSize" type="number" min="8" max="128" value={localData.fontSize} onChange={handleChange} />
            </div>
            <div className="toolbar-group">
                <label htmlFor="color">{t('sidebar.textColor')}</label>
                <input id="color" type="color" value={localData.color} onChange={handleChange} />
            </div>
        </>
    );
};

const MultiSelectTools = ({ count, alignElements, distributeElements }) => {
    const { t } = useTranslation();
    return (
        <>
            <div className="toolbar-group">
                <span className='toolbar-info-text'>{t('sidebar.multiSelectTitle')} ({count})</span>
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
                <label>{t('sidebar.align')}</label>
                <div className="toolbar-button-group">
                    <button onClick={() => alignElements('left')} title={t('sidebar.alignLeft')}><AlignLeftIcon /></button>
                    <button onClick={() => alignElements('h-center')} title={t('sidebar.alignHCenter')}><AlignHCenterIcon /></button>
                    <button onClick={() => alignElements('right')} title={t('sidebar.alignRight')}><AlignRightIcon /></button>
                    <button onClick={() => alignElements('top')} title={t('sidebar.alignTop')}><AlignTopIcon /></button>
                    <button onClick={() => alignElements('v-center')} title={t('sidebar.alignVCenter')}><AlignVCenterIcon /></button>
                    <button onClick={() => alignElements('bottom')} title={t('sidebar.alignBottom')}><AlignBottomIcon /></button>
                </div>
            </div>
            {count > 2 && (
                <>
                    <div className="toolbar-separator" />
                    <div className="toolbar-group">
                        <label>{t('sidebar.distribute')}</label>
                        <div className="toolbar-button-group">
                            <button onClick={() => distributeElements('horizontal')} title={t('sidebar.distributeH')}><DistributeHIcon/></button>
                            <button onClick={() => distributeElements('vertical')} title={t('sidebar.distributeV')}><DistributeVIcon/></button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

// --- MAIN COMPONENT ---
const TopToolbar = ({ selectedElements, onUpdateNodeData, alignElements, distributeElements, availableIcons, theme, toggleTheme }) => {
    const renderContent = () => {
        if (!selectedElements || selectedElements.length === 0) {
            return <ToolbarPlaceholder />;
        }
        
        if (selectedElements.length > 1) {
            return (
                <MultiSelectTools
                    count={selectedElements.length}
                    alignElements={alignElements}
                    distributeElements={distributeElements}
                />
            );
        }

        const selected = selectedElements[0];
        // Safely check type
        const type = selected.type || 'unknown';

        switch (type) {
            case 'custom':
            case 'device': // Added 'device' in case your data uses that key
                return <DeviceProperties node={selected} onUpdateNodeData={onUpdateNodeData} availableIcons={availableIcons} />;
            case 'group':
                return <GroupProperties node={selected} onUpdateNodeData={onUpdateNodeData} />;
            case 'text':
                return <TextProperties node={selected} onUpdateNodeData={onUpdateNodeData} />;
            default:
                // Fallback for custom nodes that share device properties
                if(selected.data && selected.data.ip) {
                    return <DeviceProperties node={selected} onUpdateNodeData={onUpdateNodeData} availableIcons={availableIcons} />;
                }
                return <ToolbarPlaceholder />;
        }
    };

    return (
        <div className="top-toolbar">
            {renderContent()}
            <div className="toolbar-spacer" />
            <div className="toolbar-group">
                <LanguageSwitcher />
                <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
            </div>
        </div>
    );
};

export default TopToolbar;