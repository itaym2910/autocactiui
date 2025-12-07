import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INITIAL_ICON_NAME } from '../../config/constants';

const StartupScreen = ({ onStart, isLoading, availableIcons, onImportConfig }) => {
    const initialIpRef = useRef(null);
    const importInputRef = useRef(null);
    const backgroundImageInputRef = useRef(null);
    const [initialIconName, setInitialIconName] = useState(INITIAL_ICON_NAME);
    const [backgroundImage, setBackgroundImage] = useState(null);
    const { t } = useTranslation();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (initialIpRef.current) {
            // Pass the background image URL (if it exists) as the third argument
            onStart(initialIpRef.current.value, initialIconName, backgroundImage?.url);
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

    const handleBackgroundImageImport = (event) => {
        const file = event.target.files[0];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            setBackgroundImage({ file, url: imageUrl });
        }
        event.target.value = null;
    };
    
    const clearBackgroundImage = () => {
        if (backgroundImage) {
            URL.revokeObjectURL(backgroundImage.url); // Clean up memory
        }
        setBackgroundImage(null);
    };

    return (
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
                
                {backgroundImage && (
                    <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.9em' }}>
                        <span>{backgroundImage.file.name}</span>
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
    );
};

export default StartupScreen;