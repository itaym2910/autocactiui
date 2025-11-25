import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './ErrorPages.css';

const NotFound = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="error-container">
      <div className="error-card">
        <div className="error-icon-wrapper" style={{ color: '#8b5cf6' }}>
          {/* Ghost / Search Icon */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <path d="M11 8v6"></path> {/* Simplified inner detail */}
          </svg>
        </div>
        
        {/* Massive Gradient Text */}
        <h1 className="error-code-display code-404">404</h1>
        
        {/* Title with extra bottom margin since text was removed */}
        <h2 className="error-title" style={{ marginBottom: '40px' }}>
          {t('errors.404_title') || "Page Not Found"}
        </h2>

        {/* Single Button */}
        <div className="error-actions">
          <button className="btn-primary" onClick={() => navigate('/')}>
            {t('common.home') || "Return Home"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;