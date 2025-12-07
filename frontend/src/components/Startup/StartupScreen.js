import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INITIAL_ICON_NAME } from '../../config/constants';
import ImageCropperModal from '../common/ImageCropperModal'; // Import the new modal
import '../common/ImageCropperModal.css'; // Import its CSS

const StartupScreen = ({ onStart, isLoading, availableIcons, onImportConfig }) => {
    const initialIpRef = useRef(null);
    const importInputRef = useRef(null);
    const backgroundImageInputRef = useRef(null);
    const [initialIconName, setInitialIconName] = useState(INITIAL_ICON_NAME);
    
    // This state now holds the FINAL, cropped image URL
    const [finalBackgroundImageUrl, setFinalBackgroundImageUrl] = useState(null);
    const [originalFile, setOriginalFile] = useState(null); // To display the original filename

    // State for the cropper modal
    const [cropperOpen, setCropperOpen] = useState(false);
    const [sourceImage, setSourceImage] = useState(null);

    const { t } = useTranslation();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (initialIpRef.current) {
            // Pass the FINAL cropped image URL to the onStart handler
            onStart(initialIpRef.current.value, initialIconName, finalBackgroundImageUrl);
        }
    };

    const handleImportClick = () => {
        importInputRef.current.click();
    };

    const handleFileImport = (event) => {
        const file = event.target.files[0];
        if (file) {
            onImportConfig(file);
        }
        event.target.value = null;
    };

    const handleBackgroundImageClick = () => {
        backgroundImageInputRef.current.click();
    };

    // This now OPENS THE CROPPER instead of setting the final image
    const handleBackgroundImageImport = (event) => {
        const file = event.target.files[0];
        if (file) {
            setOriginalFile(file); // Store the original file to show its name
            const imageUrl = URL.createObjectURL(file);
            setSourceImage(imageUrl); // Set the source for the cropper
            setCropperOpen(true); // Open the modal
        }
        event.target.value = null;
    };
    
    // Called when the user confirms the crop from the modal
    const handleCropAccept = (croppedImageUrl) => {
        // Revoke the old URL if it exists to prevent memory leaks
        if (finalBackgroundImageUrl) {
            URL.revokeObjectURL(finalBackgroundImageUrl);
        }
        setFinalBackgroundImageUrl(croppedImageUrl); // Set the new, final URL
        setCropperOpen(false); // Close the modal
    };
    
    const handleCropClose = () => {
        // If the user cancels, clean up the source image URL
        if (sourceImage) {
            URL.revokeObjectURL(sourceImage);
        }
        setCropperOpen(false);
    };

    const clearBackgroundImage = () => {
        if (finalBackgroundImageUrl) {
            URL.revokeObjectURL(finalBackgroundImageUrl);
        }
        setFinalBackgroundImageUrl(null);
        setOriginalFile(null);
    };

    return (
        <>
            <ImageCropperModal
                isOpen={cropperOpen}
                onClose={handleCropClose}
                imageSrc={sourceImage}
                onCropComplete={handleCropAccept}
            />
            <div className="start-container">
                <h1>{t('startup.title')}</h1>
                <div className="start-form">
                    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                        <input
                            type="text"
                            ref={initialIpRef}
                            placeholder={t('startup.placeholderIp')}
                            defaultValue="10.10.1.3"
                        />
                        <select 
                            className="icon-selector"
                            value={initialIconName} 
                            onChange={(e) => setInitialIconName(e.target.value)}
                            style={{width: '100%', marginBottom: '20px', textAlign: 'center'}}
                        >
                            {availableIcons.map(iconName => (
                                <option key={iconName} value={iconName}>
                                    {t('startup.iconSelector', { iconName })}
                                </option>
                            ))}
                        </select>

                        <button type="submit" disabled={isLoading}>
                            {isLoading ? t('startup.loading') : t('startup.startMapping')}
                        </button>
                    </form>

                    <div className="startup-separator">{t('startup.or')}</div>
                    
                    <input
                        type="file"
                        ref={backgroundImageInputRef}
                        onChange={handleBackgroundImageImport}
                        style={{ display: 'none' }}
                        accept="image/png, image/jpeg"
                    />
                    <button type="button" onClick={handleBackgroundImageClick} className="secondary" disabled={isLoading}>
                        {t('startup.chooseBackgroundImage', 'Choose Background Image')}
                    </button>
                    
                    {originalFile && (
                        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.9em' }}>
                            <span>{originalFile.name} (Cropped)</span>
                            <button onClick={clearBackgroundImage} style={{ marginLeft: '10px', cursor: 'pointer', background: 'transparent', border: 'none', color: 'red', fontWeight: 'bold' }}>X</button>
                        </div>
                    )}
                    
                    <div className="startup-separator"></div>

                    <input
                        type="file"
                        ref={importInputRef}
                        onChange={handleFileImport}
                        style={{ display: 'none' }}
                        accept=".json"
                    />
                    <button type="button" onClick={handleImportClick} className="secondary" disabled={isLoading}>
                        {t('startup.importAction')}
                    </button>
                </div>
            </div>
        </>
    );
};

export default StartupScreen;