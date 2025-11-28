// frontend/src/components/Sidebar/MultiSelectToolbar.js
import { useTranslation } from 'react-i18next';

// Simple SVG icons for toolbar buttons
const AlignLeftIcon = () => <svg viewBox="0 0 24 24"><path d="M15 21v-4h2v4h-2zm-4 0v-8h2v8h-2zm-4 0v-6h2v6H7zM3 3v16h2V3H3z"/></svg>;
const AlignHCenterIcon = () => <svg viewBox="0 0 24 24"><path d="M11 2v4h2V2h-2zm-4 6v10h2V8H7zm8 0v10h2V8h-2zM3 2v4h2V2H3zm16 0v4h2V2h-2z"/></svg>;
const AlignRightIcon = () => <svg viewBox="0 0 24 24"><path d="M7 21v-4h2v4H7zm4 0v-8h2v8h-2zm4 0v-6h2v6h-2zM19 3v16h2V3h-2z"/></svg>;
const AlignTopIcon = () => <svg viewBox="0 0 24 24" transform="rotate(90 12 12)"><path d="M15 21v-4h2v4h-2zm-4 0v-8h2v8h-2zm-4 0v-6h2v6H7zM3 3v16h2V3H3z"/></svg>;
const AlignVCenterIcon = () => <svg viewBox="0 0 24 24" transform="rotate(90 12 12)"><path d="M11 2v4h2V2h-2zm-4 6v10h2V8H7zm8 0v10h2V8h-2zM3 2v4h2V2H3zm16 0v4h2V2h-2z"/></svg>;
const AlignBottomIcon = () => <svg viewBox="0 0 24 24" transform="rotate(90 12 12)"><path d="M7 21v-4h2v4H7zm4 0v-8h2v8h-2zm4 0v-6h2v6h-2zM19 3v16h2V3h-2z"/></svg>;

const MultiSelectToolbar = ({
    selectedElements,
    alignElements,
    distributeElements,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    onDeleteElements
}) => {
    const { t } = useTranslation();

    return (
        <div className="multi-select-toolbar">
            <h3>{t('sidebar.multiSelectTitle')} ({selectedElements.length})</h3>
            
            <h4>{t('sidebar.align')}</h4>
            <div className="button-grid">
                <button onClick={() => alignElements('left')} title={t('sidebar.alignLeft')}><AlignLeftIcon /></button>
                <button onClick={() => alignElements('h-center')} title={t('sidebar.alignHCenter')}><AlignHCenterIcon /></button>
                <button onClick={() => alignElements('right')} title={t('sidebar.alignRight')}><AlignRightIcon /></button>
                <button onClick={() => alignElements('top')} title={t('sidebar.alignTop')}><AlignTopIcon /></button>
                <button onClick={() => alignElements('v-center')} title={t('sidebar.alignVCenter')}><AlignVCenterIcon /></button>
                <button onClick={() => alignElements('bottom')} title={t('sidebar.alignBottom')}><AlignBottomIcon /></button>
            </div>
            
            {selectedElements.length > 2 && (
                <>
                    <h4>{t('sidebar.distribute')}</h4>
                    <div className="button-grid distribute">
                        <button onClick={() => distributeElements('horizontal')}>{t('sidebar.distributeH')}</button>
                        <button onClick={() => distributeElements('vertical')}>{t('sidebar.distributeV')}</button>
                    </div>
                </>
            )}

            <h4>{t('sidebar.layer')}</h4>
            <div className="button-grid full-width-grid">
                <button onClick={bringForward}>{t('sidebar.bringForward')}</button>
                <button onClick={sendBackward}>{t('sidebar.sendBackward')}</button>
                <button onClick={bringToFront}>{t('sidebar.bringToFront')}</button>
                <button onClick={sendToBack}>{t('sidebar.sendToBack')}</button>
            </div>
            
            <hr/>
            
            <div className="control-group">
                <button onClick={onDeleteElements} className="danger">{t('sidebar.deleteSelected')}</button>
            </div>
        </div>
    );
};

export default MultiSelectToolbar;