// frontend/src/components/common/NeighborsPopup.js
import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./NeighborsPopup.css";

// --- Icons ---
const SearchIcon = () => (
  <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6L18 18" />
  </svg>
);

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12.6111L8.92308 17.5L20 6.5" />
    </svg>
);

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
    <path d="M2 12H22" />
    <path d="M12 2A15.3 15.3 0 0 1 16 12A15.3 15.3 0 0 1 12 22A15.3 15.3 0 0 1 8 12A15.3 15.3 0 0 1 12 2Z" />
  </svg>
);

const LinkIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
);

// --- Internal Component: Link Selection Modal ---
const LinkSelectionModal = ({ device, onConfirm, onCancel, t }) => {
    const [selectedLinks, setSelectedLinks] = useState(new Set());

    // Pre-select all links by default
    useEffect(() => {
        if (device && device.links) {
            const allIndices = new Set(device.links.map((_, idx) => idx));
            setSelectedLinks(allIndices);
        }
    }, [device]);

    const toggleLink = (index) => {
        setSelectedLinks(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const handleConfirm = () => {
        // Create a copy of the device but with ONLY the selected links
        const subsetLinks = device.links.filter((_, idx) => selectedLinks.has(idx));
        const deviceWithSelectedLinks = { ...device, links: subsetLinks };
        onConfirm(deviceWithSelectedLinks);
    };

    return (
        <div className="link-selection-overlay" onClick={onCancel}>
            <div className="link-selection-content" onClick={e => e.stopPropagation()}>
                <div className="link-selection-header">
                    <h3>{t('neighborsPopup.selectLinksTitle', { hostname: device.hostname })}</h3>
                    <button className="icon-button" onClick={onCancel}><CloseIcon /></button>
                </div>
                
                <div className="link-list-container">
                    <ul className="link-list">
                        {device.links.map((link, idx) => {
                            const isSelected = selectedLinks.has(idx);
                            return (
                                <li key={idx} className={`link-item ${isSelected ? 'selected' : ''}`} onClick={() => toggleLink(idx)}>
                                    <div className="link-checkbox">
                                        {isSelected && <CheckIcon />}
                                    </div>
                                    <div className="link-details">
                                        <div className="link-name">
                                            <LinkIcon />
                                            <span>{link.interface || "Unknown Interface"}</span>
                                        </div>
                                        <div className="link-meta">
                                            {link.description && <span className="link-desc">{link.description}</span>}
                                            {link.bandwidth && <span className="link-bw">{link.bandwidth}</span>}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <div className="link-selection-footer">
                    <button className="cancel-button" onClick={onCancel}>
                        {t('neighborsPopup.cancel')}
                    </button>
                    <button 
                        className="confirm-links-button" 
                        onClick={handleConfirm}
                        disabled={selectedLinks.size === 0}
                    >
                        {t('neighborsPopup.addLinks', { count: selectedLinks.size })}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Main Component ---
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNeighbors, setSelectedNeighbors] = useState(new Set());
  const [inspectingDevice, setInspectingDevice] = useState(null); // For Full Scan Link Selection
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedNeighbors(new Set());
      setInspectingDevice(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
          if (inspectingDevice) setInspectingDevice(null);
          else onClose();
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
  }, [isOpen, onClose, inspectingDevice]);

  const groupedNeighbors = useMemo(() => {
    const neighborMap = new Map();
    neighbors.forEach(neighbor => {
      const key = neighbor.ip || neighbor.hostname;
      if (!neighborMap.has(key)) {
        neighborMap.set(key, { ...neighbor, links: [neighbor] });
      } else {
        neighborMap.get(key).links.push(neighbor);
      }
    });
    return Array.from(neighborMap.values());
  }, [neighbors]);
  
  const groupedNeighborsMap = useMemo(() => {
    const map = new Map();
    groupedNeighbors.forEach(group => map.set(group.ip || group.hostname, group));
    return map;
  }, [groupedNeighbors]);

  const filteredNeighbors = useMemo(() => 
    groupedNeighbors.filter(n =>
        n.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (n.ip && n.ip.toLowerCase().includes(searchTerm.toLowerCase()))
    ), 
  [groupedNeighbors, searchTerm]);

  const regularNeighbors = useMemo(() => filteredNeighbors.filter(n => !n.isFullScan), [filteredNeighbors]);
  const fullScanNeighbors = useMemo(() => filteredNeighbors.filter(n => n.isFullScan), [filteredNeighbors]);

  const filteredKeys = useMemo(() => new Set(filteredNeighbors.map(n => n.ip || n.hostname)), [filteredNeighbors]);
  const areAllFilteredSelected = useMemo(() => {
      if (filteredKeys.size === 0) return false;
      return Array.from(filteredKeys).every(key => selectedNeighbors.has(key));
  }, [selectedNeighbors, filteredKeys]);

  const handleSelectAllClick = () => {
      if (areAllFilteredSelected) {
          setSelectedNeighbors(prev => {
              const newSelection = new Set(prev);
              filteredKeys.forEach(key => newSelection.delete(key));
              return newSelection;
          });
      } else {
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
        if (newSelection.has(key)) newSelection.delete(key);
        else newSelection.add(key);
        return newSelection;
    });
  };

  const handleAddSelectedClick = () => {
    if (isLoading || selectedNeighbors.size === 0) return;
    const selectedGroups = [];
    selectedNeighbors.forEach(key => {
        if (groupedNeighborsMap.has(key)) selectedGroups.push(groupedNeighborsMap.get(key));
    });
    if (selectedGroups.length > 0) onAddSelectedNeighbors(selectedGroups);
  };

  // Handle adding a single neighbor
  const handleSingleAdd = (e, group) => {
      e.stopPropagation();
      
      if (group.isFullScan) {
          // Open the Link Selection Modal for Full Scan devices
          setInspectingDevice(group);
      } else {
          // Add directly for regular devices
          onAddNeighbor(group);
      }
  };

  // Handle confirmation from the Link Selection Modal
  const handleLinkSelectionConfirm = (modifiedGroup) => {
      setInspectingDevice(null);
      onAddNeighbor(modifiedGroup);
  };

  const renderNeighborGrid = (groups) => (
      <ul className="neighbor-grid">
        {groups.map((group) => {
          const key = group.ip || group.hostname;
          const isSelected = selectedNeighbors.has(key);
          return (
            <li
              key={key}
              className={`neighbor-item ${isSelected ? 'selected' : ''} ${group.isFullScan ? 'full-scan-item' : ''}`}
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
                onClick={(e) => handleSingleAdd(e, group)}
                disabled={isLoading}
              >
                {group.isFullScan ? t("neighborsPopup.selectLinks") : t("sidebar.add")}
              </button>
            </li>
          );
        })}
      </ul>
  );

  if (!isOpen) return null;

  return (
    <div className="neighbor-popup-overlay" onClick={onClose}>
      <div className="neighbor-popup-content" onClick={(e) => e.stopPropagation()}>
        <button className="neighbor-popup-close-button" onClick={onClose} aria-label="Close">
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
            {filteredNeighbors.length === 0 ? (
              <div className="no-results">
                <span className="no-results-text">{t("neighborsPopup.noResults")}</span>
              </div>
            ) : (
                <>
                    {regularNeighbors.length > 0 && (
                        <div className="neighbor-section">
                            <h3 className="neighbor-section-title">{t("neighborsPopup.regularDevices")}</h3>
                            {renderNeighborGrid(regularNeighbors)}
                        </div>
                    )}
                    {fullScanNeighbors.length > 0 && (
                        <div className="neighbor-section">
                            <h3 className="neighbor-section-title full-scan-title">
                                {t("neighborsPopup.fullScanDevices")}
                                <span className="badge">{fullScanNeighbors.length}</span>
                            </h3>
                            {renderNeighborGrid(fullScanNeighbors)}
                        </div>
                    )}
                </>
            )}
          </div>
            
            <div className="neighbor-popup-footer">
                {filteredNeighbors.length > 0 && (
                    <button 
                      className="add-neighbor-button" 
                      onClick={handleAddSelectedClick}
                      disabled={isLoading || selectedNeighbors.size === 0}
                    >
                       {t('neighborsPopup.addSelected', { count: selectedNeighbors.size })}
                    </button>
                )}
                {onFullScan && (
                    <button 
                        className="full-scan-button"
                        onClick={onFullScan}
                        disabled={isLoading}
                        title={t("neighborsPopup.fullScanTooltip")}
                    >
                        <div style={{ width: '16px', height: '16px', display: 'flex' }}><GlobeIcon /></div>
                        <span>{t("neighborsPopup.fullScan")}</span>
                    </button>
                )}
            </div>
        </div>

        {/* Render the Link Selection Modal ON TOP if active */}
        {inspectingDevice && (
            <LinkSelectionModal 
                device={inspectingDevice}
                onConfirm={handleLinkSelectionConfirm}
                onCancel={() => setInspectingDevice(null)}
                t={t}
            />
        )}

      </div>
    </div>
  );
};

export default NeighborsPopup;