// frontend/src/components/Sidebar/Sidebar.js
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
  onUploadBackground, // NEW
  onAddGroup,
  onAddTextNode,
  onResetMap,
  onLogout,
  availableIcons,
  mapName,
  setMapName,
  isMapStarted,
  isUploading,
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
  currentUser,
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

  const isAdmin = currentUser && (currentUser.privilege === 'admin' || currentUser.role === 'admin');
  const isViewer = currentUser && (currentUser.privilege === 'viewer' || currentUser.role === 'viewer');

  const renderContextualContent = () => {
    if (selectedElements.length > 1) {
      return (
        <div className="animate-fade-in">
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
        </div>
      );
    }
    if (selectedElements.length === 1) {
      const selected = selectedElements[0];
      if (selected.type === 'custom')
        return <DeviceEditor selectedElement={selected} onDeleteElements={onDeleteElements} neighbors={neighbors} onAddNeighbor={onAddNeighbor} />;
      if (selected.type === 'group')
        return <GroupEditor selectedElement={selected} onUpdateNodeData={onUpdateNodeData} onDeleteElements={onDeleteElements} />;
      if (selected.type === 'text')
        return <TextEditor selectedElement={selected} onUpdateNodeData={onUpdateNodeData} onDeleteElements={onDeleteElements} />;
    }
    return <SidebarPlaceholder isMapStarted={isMapStarted} />;
  };

  const handleBackgroundUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      onUploadBackground(ev.target.result); // pass base64 to parent
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="sidebar">
      {showDownloadPopup && (
        <div className="download-popup-overlay">
          <div className="download-popup-content">
            <div className="popup-header">
              <h3 className="popup-title">{t('sidebar.selectDownloadFormat')}</h3>
              <p className="popup-description">Choose how you want to save your current map layout.</p>
            </div>

            <div className="popup-body">
              <div className="download-options-grid">
                <button
                  onClick={() => { onDownloadConfig(); setShowDownloadPopup(false); }}
                  className="download-option-btn"
                >
                  <span style={{ fontSize: '24px' }}>📄</span><span>{t('sidebar.downloadMap')} (.json)</span>
                </button>
                <button
                  onClick={() => { onDownloadPng(); setShowDownloadPopup(false); }}
                  className="download-option-btn"
                >
                  <span style={{ fontSize: '24px' }}>🖼️</span><span>{t('sidebar.downloadPng')} (.png)</span>
                </button>
              </div>
            </div>

            <div className="popup-footer">
              <button className="btn-cancel" onClick={() => setShowDownloadPopup(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 1. TOP SECTION: Map Controls (Upload/Name) */}
      {!isViewer && (
        <div className="action-buttons-green">
          <MapExportControls
            mapName={mapName}
            setMapName={setMapName}
            onUploadMap={onUploadMap}
            isUploading={isUploading}
            isMapStarted={isMapStarted}
          />

          {/* NEW: Upload Background */}
          <div style={{ marginTop: '10px' }}>
            <label className="secondary" style={{ cursor: 'pointer', display: 'block', textAlign: 'center' }}>
              {t('sidebar.uploadBackground') || "Upload Background Image"}
              <input type="file" accept="image/*" onChange={handleBackgroundUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      )}

      {isViewer && (
        <div style={{ paddingBottom: '20px', color: 'var(--text-secondary)', fontSize: '0.9em', textAlign: 'center' }}>
          <em>{t('sidebar.viewerMode') || "Viewer Mode: Upload disabled"}</em>
        </div>
      )}

      <hr />
      <div className="contextual-section">{renderContextualContent()}</div>
      <hr />

      {isMapStarted && (
        <div className="map-tools-section">
          <h3>{t('sidebar.mapTools')}</h3>
          <div className="control-group">
            <label>{t('sidebar.addElements')}</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={onAddGroup} className="secondary">{t('sidebar.addGroup')}</button>
              <button onClick={onAddTextNode} className="secondary">{t('sidebar.addText')}</button>
            </div>
          </div>
          <div className="control-group">
            <label>{t('sidebar.mapActions')}</label>
            <button
              onClick={() => setShowDownloadPopup(true)}
              disabled={!isMapStarted}
              style={{ marginBottom: '10px' }}
            >
              {t('sidebar.download')}
            </button>

            <button onClick={handleResetClick} className="danger" disabled={!isMapStarted}>
              {t('sidebar.clearMap')}
            </button>
          </div>
          <hr />
        </div>
      )}

      <div className="session-section">
        <h3>{t('sidebar.session')}</h3>
        <div className="control-group">
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
      </div>
    </div>
  );
};

export default Sidebar;
