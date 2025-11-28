import React from 'react';
import { useTranslation } from 'react-i18next';

const MapExportControls = ({
  mapName,
  setMapName,
  onUploadMap,
  isUploading,
  isMapStarted,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <h2>{t('sidebar.controls')}</h2>
      
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