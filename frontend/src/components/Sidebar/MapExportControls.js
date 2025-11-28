import React from 'react';
import { useTranslation } from 'react-i18next';

const MapExportControls = ({
  mapName,
  setMapName,
  onUploadMap, // <--- KEEPING THIS NAME IS CRITICAL
  isUploading,
  isMapStarted,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <h2>{t('sidebar.controls')}</h2>
      
      {/* Map Name Input */}
      <div className="control-group">
        <label htmlFor="map-name-input">{t('sidebar.mapName')}</label>
        <input
          id="map-name-input"
          type="text"
          value={mapName}
          onChange={(e) => setMapName(e.target.value)}
          disabled={!isMapStarted}
          placeholder={t('sidebar.mapNamePlaceholder')}
        />
      </div>

      {/* Upload Button */}
      {/* Note: Dropdown is removed. It's now in the Popup in App.js */}
      <div className="control-group">
        <button 
            onClick={onUploadMap} 
            disabled={!isMapStarted || isUploading}
        >
          {isUploading ? t('sidebar.uploading') : t('sidebar.uploadToCacti')}
        </button>
      </div>
    </div>
  );
};

export default MapExportControls;