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
  currentUser, // Required for permission logic
  onOpenAdmin, 
}) => {
  const { t } = useTranslation();
  const { onUpdateNodeData } = useContext(NodeContext);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);

  const handleResetClick = () => {
    if (window.confirm(t('sidebar.confirmReset'))) {
      onResetMap();
    }
  };

  // Permission Checks
  const isAdmin = currentUser && (currentUser.privilege === 'admin' || currentUser.role === 'admin');
  const isViewer = currentUser && (currentUser.privilege === 'viewer' || currentUser.role === 'viewer');

  const renderContextualContent = () => {
     // ... (Keep existing logic for renderContextualContent)
     // For brevity, I am not repeating the whole switch/case block here, 
     // just copy it from your previous Sidebar.js
     if (selectedElements.length > 1) return <MultiSelectToolbar selectedElements={selectedElements} alignElements={alignElements} distributeElements={distributeElements} bringForward={bringForward} sendBackward={sendBackward} bringToFront={bringToFront} sendToBack={sendToBack} onDeleteElements={onDeleteElements} />;
     if (selectedElements.length === 1) {
        const selected = selectedElements[0];
        if(selected.type === 'custom') return <DeviceEditor selectedElement={selected} onDeleteElements={onDeleteElements} neighbors={neighbors} onAddNeighbor={onAddNeighbor} />;
        if(selected.type === 'group') return <GroupEditor selectedElement={selected} onUpdateNodeData={onUpdateNodeData} onDeleteElements={onDeleteElements} />;
        if(selected.type === 'text') return <TextEditor selectedElement={selected} onUpdateNodeData={onUpdateNodeData} onDeleteElements={onDeleteElements} />;
     }
     return <SidebarPlaceholder isMapStarted={isMapStarted} />;
  };

  return (
    <div className="sidebar">
      {/* Download Popup Overlay */}
      {showDownloadPopup && (
        <div className="download-popup-overlay">
          <div className="download-popup">
            <h3>{t('sidebar.selectDownloadFormat')}</h3>
            <div className="download-options-grid">
              <button onClick={() => { onDownloadConfig(); setShowDownloadPopup(false); }} className="download-option-btn">
                <span style={{fontSize: '24px'}}>📄</span><span>{t('sidebar.downloadMap')}</span>
              </button>
              <button onClick={() => { onDownloadPng(); setShowDownloadPopup(false); }} className="download-option-btn">
                <span style={{fontSize: '24px'}}>🖼️</span><span>{t('sidebar.downloadPng')}</span>
              </button>
            </div>
            <button className="secondary cancel-btn" onClick={() => setShowDownloadPopup(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {/* 
         LOGIC: 
         - If Viewer: Hide Upload Controls completely.
         - If Admin/User: Show Controls.
      */}
      {!isViewer && (
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
      )}
      
      {isViewer && (
         <div style={{paddingBottom: '20px', color: 'var(--text-secondary)', fontSize: '0.9em', textAlign: 'center'}}>
            <em>{t('sidebar.viewerMode') || "Viewer Mode: Upload disabled"}</em>
         </div>
      )}

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
           {/* Quick Select & Map Actions ... */}
           <div className="control-group">
              <label>{t('sidebar.mapActions')}</label>
              <button onClick={() => setShowDownloadPopup(true)} className="secondary" disabled={!isMapStarted} style={{marginBottom: '10px'}}>
                  {t('sidebar.download')} 
              </button>
              <button onClick={handleResetClick} className="danger" disabled={!isMapStarted}>
                {t('sidebar.clearMap')}
              </button>
           </div>
        </div>
      )}
      
      <h3>{t('sidebar.session')}</h3>
      <div className="control-group">
        
        {/* LOGIC: Only show Admin Panel button if isAdmin is true */}
        {isAdmin && (
          <button 
            onClick={onOpenAdmin} 
            className="secondary"
            style={{ marginBottom: '10px', border: '1px solid var(--accent-primary)' }}
          >
             {t('sidebar.adminPanel')}
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