// frontend/src/components/common/NeighborsPopup.js
import React from "react";
import { useTranslation } from "react-i18next";
import "./NeighborsPopup.css";

const SearchIcon = () => (
  <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
      clipRule="evenodd"
    />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M18 6L6 18M6 6L18 18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 12.6111L8.92308 17.5L20 6.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 2A15.3 15.3 0 0 1 16 12A15.3 15.3 0 0 1 12 22A15.3 15.3 0 0 1 8 12A15.3 15.3 0 0 1 12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);


const NeighborsPopup = ({
  isOpen,
  neighbors,
  sourceHostname,
  onAddNeighbor,
  onAddSelectedNeighbors,
  onClose,
  onFullScan,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedNeighbors, setSelectedNeighbors] = React.useState(new Set());
  const { t } = useTranslation();

  React.useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedNeighbors(new Set());
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const groupedNeighbors = React.useMemo(() => {
    const neighborMap = new Map();
    neighbors.forEach(neighbor => {
      const key = neighbor.ip || neighbor.hostname;
      if (!neighborMap.has(key)) {
        neighborMap.set(key, {
          ...neighbor,
          links: [neighbor]
        });
      } else {
        neighborMap.get(key).links.push(neighbor);
      }
    });
    return Array.from(neighborMap.values());
  }, [neighbors]);
  
  const groupedNeighborsMap = React.useMemo(() => {
    const map = new Map();
    groupedNeighbors.forEach(group => {
        const key = group.ip || group.hostname;
        map.set(key, group);
    });
    return map;
  }, [groupedNeighbors]);


  const filteredNeighbors = React.useMemo(() => 
    groupedNeighbors.filter(
      (n) =>
        n.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (n.ip && n.ip.toLowerCase().includes(searchTerm.toLowerCase()))
    ), 
  [groupedNeighbors, searchTerm]);

  const filteredKeys = React.useMemo(() => new Set(filteredNeighbors.map(n => n.ip || n.hostname)), [filteredNeighbors]);
  const areAllFilteredSelected = React.useMemo(() => {
      if (filteredKeys.size === 0) return false;
      return Array.from(filteredKeys).every(key => selectedNeighbors.has(key));
  }, [selectedNeighbors, filteredKeys]);

  const handleSelectAllClick = () => {
      if (areAllFilteredSelected) {
          // Deselect all filtered
          setSelectedNeighbors(prev => {
              const newSelection = new Set(prev);
              filteredKeys.forEach(key => newSelection.delete(key));
              return newSelection;
          });
      } else {
          // Select all filtered
          setSelectedNeighbors(prev => {
              const newSelection = new Set(prev);
              filteredKeys.forEach(key => newSelection.add(key));
              return newSelection;
          });
      }
  };

  const handleToggleSelection = (key) => {
    setSelectedNeighbors(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(key)) {
            newSelection.delete(key);
        } else {
            newSelection.add(key);
        }
        return newSelection;
    });
  };

  const handleAddSelectedClick = () => {
    if (isLoading || selectedNeighbors.size === 0) return;

    const selectedGroups = [];
    selectedNeighbors.forEach(key => {
        if (groupedNeighborsMap.has(key)) {
            selectedGroups.push(groupedNeighborsMap.get(key));
        }
    });

    if (selectedGroups.length > 0) {
        onAddSelectedNeighbors(selectedGroups);
    }
  };


  if (!isOpen) {
    return null;
  }

  return (
    <div className="neighbor-popup-overlay" onClick={onClose}>
      <div
        className="neighbor-popup-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="neighbor-popup-close-button"
          onClick={onClose}
          aria-label="Close"
        >
          <CloseIcon />
        </button>
        
        <div className="neighbor-popup-header">
            <div>
                <h2>{t("neighborsPopup.title", { hostname: sourceHostname })}</h2>
                <p>{t("neighborsPopup.subtitle", { count: neighbors.length })}</p>
            </div>

          <div className="search-bar">
            <SearchIcon />
            <input
              type="text"
              placeholder={t("neighborsPopup.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="neighbor-popup-body">
            <div className="neighbor-popup-actions">
                {filteredNeighbors.length > 0 && (
                    <button className="select-all-button" onClick={handleSelectAllClick}>
                        {areAllFilteredSelected ? t('neighborsPopup.deselectAll') : t('neighborsPopup.selectAll')}
                    </button>
                )}
            </div>
          <div className="neighbor-grid-panel">
            {filteredNeighbors.length > 0 ? (
              <ul className="neighbor-grid">
                {filteredNeighbors.map((group) => {
                  const key = group.ip || group.hostname;
                  const isSelected = selectedNeighbors.has(key);
                  return (
                    <li
                      key={key}
                      className={`neighbor-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggleSelection(key)}
                    >
                      <div className="selection-checkbox">
                        {isSelected && <CheckIcon />}
                      </div>
                      <div className="neighbor-info">
                        <strong>{group.hostname}</strong>
                        <small>{group.ip || ' '}</small>
                        {group.links.length > 1 && (
                          <small style={{ fontWeight: 'bold' }}>
                            {t('neighborsPopup.multipleLinks', { count: group.links.length })}
                          </small>
                        )}
                      </div>
                      <button
                        className="add-neighbor-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddNeighbor(group);
                        }}
                        disabled={isLoading}
                      >
                        {t("sidebar.add")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="no-results">
                <span className="no-results-text">
                  {t("neighborsPopup.noResults")}
                </span>
              </div>
            )}
          </div>
            
            {/* FOOTER SECTION */}
            <div className="neighbor-popup-footer">
                
                {/* 1. Add Selected Button */}
                {filteredNeighbors.length > 0 && (
                    <button 
                      className="add-neighbor-button" 
                      onClick={handleAddSelectedClick}
                      disabled={isLoading || selectedNeighbors.size === 0}
                    >
                       {t('neighborsPopup.addSelected', { count: selectedNeighbors.size })}
                    </button>
                )}

                {/* 2. Full Scan Button (Identical style to Add Selected) */}
                {onFullScan && (
                    <button 
                        className="full-scan-button"
                        onClick={onFullScan}
                        disabled={isLoading}
                        title={t("neighborsPopup.fullScanTooltip") || "Perform Full Scan"}
                    >
                        <div style={{ width: '16px', height: '16px', display: 'flex' }}><GlobeIcon /></div>
                        <span>{t("neighborsPopup.fullScan") || "Full Scan"}</span>
                    </button>
                )}
            </div>

        </div>
      </div>
    </div>
  );
};

export default NeighborsPopup;