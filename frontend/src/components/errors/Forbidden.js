import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './ErrorPages.css';

const Forbidden = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="error-container">
      <div className="error-card">
        <div className="error-icon-wrapper" style={{ color: '#ef4444' }}>
          {/* Shield / Lock Icon */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
             <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
             <path d="M12 8v4"></path>
             <path d="M12 16h.01"></path>
          </svg>
        </div>

        {/* Massive Gradient Text */}
        <h1 className="error-code-display code-403">403</h1>

        <h2 className="error-title">{t('errors.403_title') || "Access Restricted"}</h2>
        <div className="error-actions">
          <button className="btn-primary" onClick={() => navigate('/')}>
            {t('common.home') || "Back to Safety"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Forbidden;