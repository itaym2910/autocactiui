import React, { useState, useEffect, useMemo } from "react";
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

const ChevronDownIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
);

const ChevronUpIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15"></polyline>
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
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDevices, setSelectedDevices] = useState(new Set()); // Set<DeviceKey>
  const [selectedLinks, setSelectedLinks] = useState(new Map()); // Map<DeviceKey, Set<InterfaceName>>
  const [expandedGroups, setExpandedGroups] = useState(new Set()); // Set<DeviceKey>
  
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedDevices(new Set());
      setSelectedLinks(new Map());
      setExpandedGroups(new Set());
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
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

  // Group neighbors by IP/Hostname
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

  const filteredNeighbors = useMemo(() => 
    groupedNeighbors.filter(
      (n) =>
        n.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (n.ip && n.ip.toLowerCase().includes(searchTerm.toLowerCase()))
    ), 
  [groupedNeighbors, searchTerm]);

  const getGroupKey = (group) => group.ip || group.hostname;

  // --- SELECTION LOGIC ---

  const handleToggleDevice = (group) => {
    const key = getGroupKey(group);
    
    setSelectedDevices(prev => {
        const newDevices = new Set(prev);
        const newLinks = new Map(selectedLinks);

        if (newDevices.has(key)) {
            newDevices.delete(key);
            newLinks.delete(key);
        } else {
            newDevices.add(key);
            // Default: Select ALL links when device is selected
            newLinks.set(key, new Set(group.links.map(l => l.interface)));
        }
        
        setSelectedLinks(newLinks);
        return newDevices;
    });
  };

  const handleToggleLink = (groupKey, linkInterface) => {
    setSelectedLinks(prevLinks => {
        const newLinks = new Map(prevLinks);
        let deviceLinks = newLinks.get(groupKey);

        // If device wasn't selected, start by initializing with NO links, then add this one
        if (!deviceLinks) {
            deviceLinks = new Set();
            setSelectedDevices(prev => new Set(prev).add(groupKey));
        } else {
            deviceLinks = new Set(deviceLinks);
        }

        if (deviceLinks.has(linkInterface)) {
            deviceLinks.delete(linkInterface);
        } else {
            deviceLinks.add(linkInterface);
        }

        // If no links selected, deselect the device
        if (deviceLinks.size === 0) {
            newLinks.delete(groupKey);
            setSelectedDevices(prev => {
                const next = new Set(prev);
                next.delete(groupKey);
                return next;
            });
        } else {
            newLinks.set(groupKey, deviceLinks);
        }

        return newLinks;
    });
  };

  const toggleExpand = (e, key) => {
      e.stopPropagation();
      setExpandedGroups(prev => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
      });
  };

  const isLinkSelected = (groupKey, linkInterface) => {
      return selectedLinks.get(groupKey)?.has(linkInterface) || false;
  };

  // --- ADD BUTTON LOGIC ---

  const handleAddSingleGroup = (e, group) => {
      e.stopPropagation();
      const key = getGroupKey(group);
      
      let linksToAdd = [];
      const userSelectedLinks = selectedLinks.get(key);

      // If user has specific selection in the Map, use it. Otherwise, assume all.
      if (userSelectedLinks && userSelectedLinks.size > 0) {
          linksToAdd = group.links.filter(l => userSelectedLinks.has(l.interface));
      } else {
          linksToAdd = group.links;
      }
      
      onAddNeighbor({ ...group, links: linksToAdd });
  };

  const handleAddSelectedClick = () => {
    if (isLoading || selectedDevices.size === 0) return;

    const groupsToAdd = [];
    filteredNeighbors.forEach(group => {
        const key = getGroupKey(group);
        if (selectedDevices.has(key)) {
            const userSelectedLinks = selectedLinks.get(key);
            // If we have specific links tracked, filter. Else add all.
            const links = userSelectedLinks 
                ? group.links.filter(l => userSelectedLinks.has(l.interface))
                : group.links;
            
            if (links.length > 0) {
                groupsToAdd.push({ ...group, links });
            }
        }
    });

    if (groupsToAdd.length > 0) {
        onAddSelectedNeighbors(groupsToAdd);
    }
  };

  const handleSelectAllVisible = () => {
      const allSelected = filteredNeighbors.every(g => selectedDevices.has(getGroupKey(g)));
      
      if (allSelected) {
          setSelectedDevices(new Set());
          setSelectedLinks(new Map());
      } else {
          const newDevices = new Set();
          const newLinks = new Map();
          filteredNeighbors.forEach(g => {
              const key = getGroupKey(g);
              newDevices.add(key);
              newLinks.set(key, new Set(g.links.map(l => l.interface)));
          });
          setSelectedDevices(newDevices);
          setSelectedLinks(newLinks);
      }
  };

  const renderNeighborGrid = (groups) => (
      <ul className="neighbor-grid">
        {groups.map((group) => {
          const key = getGroupKey(group);
          const isSelected = selectedDevices.has(key);
          const isExpanded = expandedGroups.has(key);
          const hasMultiple = group.links.length > 1;

          return (
            <React.Fragment key={key}>
                <li className={`neighbor-item ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}>
                  
                  {/* Selection Checkbox */}
                  <div 
                    className="selection-checkbox" 
                    onClick={() => handleToggleDevice(group)}
                  >
                    {isSelected && <CheckIcon />}
                  </div>

                  {/* Main Info */}
                  <div className="neighbor-info">
                    <strong>{group.hostname}</strong>
                    <small>{group.ip || ' '}</small>
                    
                    {hasMultiple && (
                        <div className="link-count-badge" onClick={(e) => toggleExpand(e, key)}>
                            <span>{group.links.length} Links</span>
                            {isExpanded ? <ChevronUpIcon/> : <ChevronDownIcon/>}
                        </div>
                    )}
                  </div>

                  {/* Sub-list for Multiple Links (Rendered INSIDE card) */}
                  {hasMultiple && isExpanded && (
                    <div className="neighbor-links-container">
                        <ul className="neighbor-links-list">
                            {group.links.map((link, idx) => (
                                <li key={`${key}-link-${idx}`} className="link-subitem" onClick={(e) => e.stopPropagation()}>
                                    <div 
                                        className={`link-checkbox ${isLinkSelected(key, link.interface) ? 'checked' : ''}`}
                                        onClick={() => handleToggleLink(key, link.interface)}
                                    >
                                         {isLinkSelected(key, link.interface) && <CheckIcon />}
                                    </div>
                                    <span className="link-name" title={link.interface}>
                                        {link.interface}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                  )}

                  {/* Add Button */}
                  <button
                    className="add-neighbor-button"
                    onClick={(e) => handleAddSingleGroup(e, group)}
                    disabled={isLoading}
                  >
                    {t("sidebar.add")}
                  </button>
                </li>
            </React.Fragment>
          );
        })}
      </ul>
  );

  if (!isOpen) return null;

  const regularNeighbors = filteredNeighbors.filter(n => !n.isFullScan);
  const fullScanNeighbors = filteredNeighbors.filter(n => n.isFullScan);

  return (
    <div className="neighbor-popup-overlay" onClick={onClose}>
      <div className="neighbor-popup-content" onClick={(e) => e.stopPropagation()}>
        <button className="neighbor-popup-close-button" onClick={onClose}><CloseIcon /></button>
        
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
                    <button className="select-all-button" onClick={handleSelectAllVisible}>
                        {filteredNeighbors.every(g => selectedDevices.has(getGroupKey(g))) 
                         ? t('neighborsPopup.deselectAll') 
                         : t('neighborsPopup.selectAll')}
                    </button>
                )}
            </div>
          
            <div className="neighbor-grid-panel">
                {filteredNeighbors.length === 0 ? (
                    <div className="no-results">{t("neighborsPopup.noResults")}</div>
                ) : (
                    <>
                        {regularNeighbors.length > 0 && (
                            <div className="neighbor-section">
                                <h3 className="neighbor-section-title">{t("neighborsPopup.regularDevices") || "Regular Devices"}</h3>
                                {renderNeighborGrid(regularNeighbors)}
                            </div>
                        )}
                        {fullScanNeighbors.length > 0 && (
                            <div className="neighbor-section">
                                <h3 className="neighbor-section-title full-scan-title">
                                    {t("neighborsPopup.fullScanDevices") || "Full Scan Devices"}
                                    <span className="badge">{fullScanNeighbors.length}</span>
                                </h3>
                                {renderNeighborGrid(fullScanNeighbors)}
                            </div>
                        )}
                    </>
                )}
            </div>
            
            <div className="neighbor-popup-footer">
                {selectedDevices.size > 0 && (
                    <button 
                      className="add-neighbor-button" 
                      onClick={handleAddSelectedClick}
                      disabled={isLoading}
                    >
                       {t('neighborsPopup.addSelected', { count: selectedDevices.size })}
                    </button>
                )}
                {onFullScan && (
                    <button 
                        className="full-scan-button"
                        onClick={onFullScan}
                        disabled={isLoading}
                    >
                        <div style={{ width: '16px', height: '16px', display:'flex' }}><GlobeIcon /></div>
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