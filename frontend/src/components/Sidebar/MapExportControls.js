import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

const MapExportControls = ({
  mapName,
  setMapName,
  onUploadMap,
  isUploading,
  isMapStarted,
  onBackgroundImageUpload // <--- New prop passed from Sidebar
}) => {
  const { t } = useTranslation();
  
  // 1. Create a reference for the hidden file input
  const fileInputRef = useRef(null);

  // 2. Function to trigger the file browser when button is clicked
  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  // 3. Handle the actual file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onBackgroundImageUpload(file);
    }
    // Optional: Reset value so selecting the same file again triggers onChange
    e.target.value = null; 
  };

  return (
    <div>
      <h2>{t('sidebar.controls')}</h2>
      
      {/* --- Map Name Input --- */}
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

      {/* --- NEW: Background Image Button --- */}
      <div className="control-group">
        {/* Hidden Input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }} // Hide the ugly default input
          accept="image/*"
          onChange={handleFileChange}
        />
        
        {/* Visible Button */}
        <button 
          onClick={handleButtonClick}
          disabled={!isMapStarted}
          className="secondary" // Use your 'secondary' class for styling if you have one
          style={{ marginBottom: '10px', width: '100%' }}
        >
          🖼️ {t('sidebar.addBackgroundImage') || "Add Background Image"}
        </button>
      </div>

      {/* --- Upload to Cacti Button --- */}
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