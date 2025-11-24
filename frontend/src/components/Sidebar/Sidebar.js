import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NodeContext } from '../../App';
import MapExportControls from './MapExportControls';
import SidebarPlaceholder from './SidebarPlaceholder';
import MultiSelectToolbar from './MultiSelectToolbar';
import DeviceEditor from './DeviceEditor';
import GroupEditor from './GroupEditor';
import TextEditor from './TextEditor';

const Sidebar = ({
  selectedElements,
  onUploadMap,
  onAddGroup,
  onAddTextNode,
  onResetMap,
  onLogout,
  availableIcons,
  mapName,
  setMapName,
  isMapStarted,
  isUploading,
  cactiGroups,
  selectedCactiGroupId,
  setSelectedCactiGroupId,
  selectAllByType,
  onDeleteElements,
  alignElements,
  distributeElements,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
  neighbors,
  onAddNeighbor,
  onDownloadConfig,
  onDownloadPng,
  currentUser, // <--- New Prop
  onOpenAdmin, // <--- New Prop
}) => {
  const { t } = useTranslation();
  const { onUpdateNodeData } = useContext(NodeContext);

  // --- State for Download Popup ---
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);

  const handleResetClick = () => {
    if (window.confirm(t('sidebar.confirmReset'))) {
      onResetMap();
    }
  };

  const renderContextualContent = () => {
    const selectionCount = selectedElements.length;

    if (selectionCount > 1) {
      return (
        <MultiSelectToolbar
          selectedElements={selectedElements}
          alignElements={alignElements}
          distributeElements={distributeElements}
          bringForward={bringForward}
          sendBackward={sendBackward}
          bringToFront={bringToFront}
          sendToBack={sendToBack}
          onDeleteElements={onDeleteElements}
        />
      );
    }
    
    if (selectionCount === 1) {
      const selected = selectedElements[0];
      
      switch (selected.type) {
        case 'custom':
          return (
            <DeviceEditor
              selectedElement={selected}
              onDeleteElements={onDeleteElements}
              neighbors={neighbors}
              onAddNeighbor={onAddNeighbor}
            />
          );
        case 'group':
          return (
            <GroupEditor
              selectedElement={selected}
              onUpdateNodeData={onUpdateNodeData}
              onDeleteElements={onDeleteElements}
            />
          );
        case 'text':
          return (
            <TextEditor
              selectedElement={selected}
              onUpdateNodeData={onUpdateNodeData}
              onDeleteElements={onDeleteElements}
            />
          );
        default:
          return <SidebarPlaceholder isMapStarted={isMapStarted} />;
      }
    }

    return <SidebarPlaceholder isMapStarted={isMapStarted} />;
  };

  return (
    <div className="sidebar">
      {/* --- POPUP OVERLAY FOR DOWNLOAD --- */}
      {showDownloadPopup && (
        <div className="download-popup-overlay">
          <div className="download-popup">
            <h3>{t('sidebar.selectDownloadFormat') || "Select Format"}</h3>
            <p>{t('sidebar.selectDownloadDesc') || "Choose how you want to save your map:"}</p>
            
            <div className="download-options-grid">
              <button 
                onClick={() => { onDownloadConfig(); setShowDownloadPopup(false); }}
                className="download-option-btn"
              >
                <span style={{fontSize: '24px'}}>📄</span>
                <span>{t('sidebar.downloadMap') || "JSON Config"}</span>
              </button>
              
              <button 
                onClick={() => { onDownloadPng(); setShowDownloadPopup(false); }}
                className="download-option-btn"
              >
                <span style={{fontSize: '24px'}}>🖼️</span>
                <span>{t('sidebar.downloadPng') || "PNG Image"}</span>
              </button>
            </div>

            <button 
              className="secondary cancel-btn" 
              onClick={() => setShowDownloadPopup(false)}
            >
              {t('common.cancel') || "Cancel"}
            </button>
          </div>
        </div>
      )}

      <MapExportControls
        mapName={mapName}
        setMapName={setMapName}
        cactiGroups={cactiGroups}
        selectedCactiGroupId={selectedCactiGroupId}
        setSelectedCactiGroupId={setSelectedCactiGroupId}
        onUploadMap={onUploadMap}
        isUploading={isUploading}
        isMapStarted={isMapStarted}
      />

      <hr />

      {isMapStarted && (
        <div>
          <h3>{t('sidebar.mapTools')}</h3>
           <div className="control-group">
              <label>{t('sidebar.addElements')}</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={onAddGroup} className="secondary">{t('sidebar.addGroup')}</button>
                <button onClick={onAddTextNode} className="secondary">{t('sidebar.addText')}</button>
              </div>
          </div>
           <div className="control-group">
              <label htmlFor="type-selector-all">{t('sidebar.quickSelect')}</label>
              <select
                id="type-selector-all"
                className="icon-selector"
                onChange={(e) => selectAllByType(e.target.value)}
                value=""
              >
                <option value="" disabled>{t('sidebar.selectByType')}</option>
                {availableIcons.map((iconName) => (
                  <option key={iconName} value={iconName}>
                    {iconName}
                  </option>
                ))}
              </select>
           </div>
          
          <div className="control-group">
            <label>{t('sidebar.mapActions')}</label>
            
            {/* Download Button Trigger */}
            <button 
                onClick={() => setShowDownloadPopup(true)} 
                className="secondary" 
                disabled={!isMapStarted} 
                style={{marginBottom: '10px'}}
            >
                {t('sidebar.download') || "Download..."} 
            </button>

            <button onClick={handleResetClick} className="danger" disabled={!isMapStarted}>
              {t('sidebar.clearMap')}
            </button>
          </div>
        </div>
      )}
      
      <h3>{t('sidebar.session')}</h3>
      <div className="control-group">
        {/* Admin Button - Only visible if user has 'admin' privilege */}
        {currentUser && currentUser.privilege === 'admin' && (
          <button 
            onClick={onOpenAdmin} 
            className="secondary"
            style={{ marginBottom: '10px', border: '1px solid var(--accent-primary)' }}
          >
            🛡️ {t('sidebar.adminPanel') || "User Management"}
          </button>
        )}

        <button onClick={onLogout} className="secondary">{t('sidebar.logout')}</button>
      </div>

      <hr />

      <div className="contextual-section">
        {renderContextualContent()}
      </div>
    </div>
  );
};

export default Sidebar;