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
const SettingsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
);

// --- INTERNAL COMPONENT: Link Selection Modal ---
const LinkSelectionModal = ({ group, initialSelection, onSave, onClose }) => {
    const [localSelection, setLocalSelection] = useState(() => {
        if (initialSelection && initialSelection.size > 0) {
            return new Set(initialSelection);
        }
        return new Set(group.links.map(l => l.interface));
    });

    useEffect(() => {
        setLocalSelection(prev => {
            const next = new Set(prev);
            let changed = false;
            group.links.forEach(l => {
                if (!prev.has(l.interface)) {
                    next.add(l.interface);
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [group]);

    const toggleLink = (iface) => {
        setLocalSelection(prev => {
            const next = new Set(prev);
            if (next.has(iface)) next.delete(iface);
            else next.add(iface);
            return next;
        });
    };

    const handleSave = () => {
        onSave(group, localSelection);
    };

    const isAllSelected = localSelection.size === group.links.length;

    const toggleAll = () => {
        if (isAllSelected) {
            setLocalSelection(new Set());
        } else {
            setLocalSelection(new Set(group.links.map(l => l.interface)));
        }
    };

    return (
        <div className="link-popup-overlay" onClick={onClose}>
            <div className="link-popup-content" onClick={e => e.stopPropagation()}>
                <div className="link-popup-header">
                    <h3>Select Links</h3>
                    <button className="close-btn-mini" onClick={onClose}><CloseIcon/></button>
                </div>
                <div className="link-popup-subheader">
                    <span>{group.hostname}</span>
                    <button className="text-btn" onClick={toggleAll}>
                        {isAllSelected ? "Deselect All" : "Select All"}
                    </button>
                </div>
                
                <ul className="link-popup-list">
                    {group.links.map((link, idx) => {
                        const isChecked = localSelection.has(link.interface);
                        return (
                            <li key={idx} className={isChecked ? 'active' : ''} onClick={() => toggleLink(link.interface)}>
                                <div className={`link-checkbox ${isChecked ? 'checked' : ''}`}>
                                    {isChecked && <CheckIcon/>}
                                </div>
                                <div className="link-details">
                                    <span className="link-iface">{link.interface}</span>
                                    {link.bandwidth && <span className="link-bw">{link.bandwidth}</span>}
                                    {link.isFullScan && <span style={{fontSize:'0.6rem', color:'orange', marginLeft:'5px'}}>(New)</span>}
                                </div>
                            </li>
                        )
                    })}
                </ul>

                <div className="link-popup-footer">
                    <button className="btn-cancel" onClick={onClose}>Cancel</button>
                    <button className="btn-save" onClick={handleSave} disabled={localSelection.size === 0}>
                        Save Selection ({localSelection.size})
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- LINK HELPERS (no external files) ---
const buildLinkKey = (source, target, iface) =>
  `${source}::${target}::${iface}`;

const filterExistingLinks = (
  links,
  sourceHostname,
  targetHostname,
  existingLinks
) => {
  if (!existingLinks || existingLinks.size === 0) return links;

  return links.filter(link => {
    const key = buildLinkKey(
      sourceHostname,
      targetHostname,
      link.interface
    );
    return !existingLinks.has(key);
  });
};


// --- MAIN COMPONENT ---
const NeighborsPopup = ({
  isOpen,
  neighbors,
  sourceHostname,
  onAddNeighbor,
  existingLinks,
  onAddSelectedNeighbors,
  onClose,
  onFullScan,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDevices, setSelectedDevices] = useState(new Set()); 
  const [selectedLinks, setSelectedLinks] = useState(new Map()); 
  const [editingGroupKey, setEditingGroupKey] = useState(null); 
  
  const { t } = useTranslation();
  const getGroupKey = (group) => group.ip || group.hostname;

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedDevices(new Set());
      setSelectedLinks(new Map());
      setEditingGroupKey(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
        if (e.key === "Escape") {
            if (editingGroupKey) setEditingGroupKey(null);
            else if (isOpen) onClose();
        }
    };
    if (isOpen) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose, editingGroupKey]);

  // --- MERGING LOGIC ---
  const groupedNeighbors = useMemo(() => {
    const neighborMap = new Map();
    neighbors.forEach(neighbor => {
      const deviceKey = neighbor.ip || neighbor.hostname;
      if (!neighborMap.has(deviceKey)) {
        neighborMap.set(deviceKey, { 
            ...neighbor, 
            links: [neighbor], 
            isFullScan: neighbor.isFullScan || false 
        });
      } else {
        const existingGroup = neighborMap.get(deviceKey);
        const existingLinkIndex = existingGroup.links.findIndex(l => l.interface === neighbor.interface);
        if (existingLinkIndex === -1) {
            existingGroup.links.push(neighbor);
        } else {
            existingGroup.links[existingLinkIndex] = { ...existingGroup.links[existingLinkIndex], ...neighbor };
        }
        if (neighbor.isFullScan) existingGroup.isFullScan = true; 
      }
    });
    return Array.from(neighborMap.values());
  }, [neighbors]);

  // --- SYNC SELECTION ---
  useEffect(() => {
      setSelectedLinks(prevLinks => {
          const newLinksMap = new Map(prevLinks);
          let hasChanges = false;
          groupedNeighbors.forEach(group => {
              const key = getGroupKey(group);
              if (newLinksMap.has(key)) {
                  const currentSet = newLinksMap.get(key);
                  const missingLinks = group.links.filter(l => !currentSet.has(l.interface));
                  if (missingLinks.length > 0) {
                      const updatedSet = new Set(currentSet);
                      missingLinks.forEach(l => updatedSet.add(l.interface));
                      newLinksMap.set(key, updatedSet);
                      hasChanges = true;
                  }
              }
          });
          return hasChanges ? newLinksMap : prevLinks;
      });
  }, [groupedNeighbors]);

  // --- FILTER ---
  const filteredNeighbors = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return groupedNeighbors.filter((n) => {
        const matchesDevice = n.hostname.toLowerCase().includes(term) || (n.ip && n.ip.toLowerCase().includes(term));
        const matchesInterface = n.links.some(l => l.interface && l.interface.toLowerCase().includes(term));
        return matchesDevice || matchesInterface;
    });
  }, [groupedNeighbors, searchTerm]);

  // --- HANDLERS ---
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
            newLinks.set(key, new Set(group.links.map(l => l.interface)));
        }
        setSelectedLinks(newLinks);
        return newDevices;
    });
  };

  const handleSaveLinks = (group, newLinkSet) => {
      const key = getGroupKey(group);
      setSelectedLinks(prev => {
          const next = new Map(prev);
          next.set(key, newLinkSet);
          return next;
      });
      if (newLinkSet.size > 0) {
          setSelectedDevices(prev => new Set(prev).add(key));
      } else {
          setSelectedDevices(prev => { const next = new Set(prev); next.delete(key); return next; });
      }
      setEditingGroupKey(null);
  };

  const openLinkModal = (e, group) => {
      e.stopPropagation();
      setEditingGroupKey(getGroupKey(group));
  };

  const handleAddSingleGroup = (e, group) => {
      e.stopPropagation();
      const key = getGroupKey(group);
      let linksToAdd = [];
      const userSelectedLinks = selectedLinks.get(key);
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

    // ✅ IMPORTANT: local copy to prevent re-adding links in same operation
    const seenLinks = new Set(existingLinks || []);

    filteredNeighbors.forEach(group => {
        const key = getGroupKey(group);
        if (!selectedDevices.has(key)) return;

        const userSelectedLinks = selectedLinks.get(key);
        const candidateLinks = userSelectedLinks
        ? group.links.filter(l => userSelectedLinks.has(l.interface))
        : group.links;

        const newLinks = [];

        candidateLinks.forEach(link => {
        const linkKey = buildLinkKey(
            sourceHostname,
            group.hostname,
            link.interface
        );

        // 🔒 Skip if already exists OR already added in this batch
        if (seenLinks.has(linkKey)) return;

        seenLinks.add(linkKey);   // 👈 THIS IS THE CRITICAL LINE
        newLinks.push(link);
        });

        if (newLinks.length > 0) {
        groupsToAdd.push({
            ...group,
            links: newLinks
        });
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
          
          const userSelectedLinks = selectedLinks.get(key);
          const selectedCount = userSelectedLinks ? userSelectedLinks.size : group.links.length;
          const isPartial = userSelectedLinks && userSelectedLinks.size < group.links.length;
          const linkCount = group.links.length;

          return (
            <React.Fragment key={key}>
                <li 
                    className={`neighbor-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggleDevice(group)}
                >
                  <div className="selection-checkbox">
                    {isSelected && <CheckIcon />}
                  </div>

                  <div className="neighbor-info">
                    <strong>{group.hostname}</strong>
                    <small>{group.ip || ' '}</small>
                    
                    {/* --- REMOVED: interface text list --- */}

                    {/* --- UPDATED: Always show the link count button so number is visible --- */}
                    {linkCount > 0 && (
                        <button 
                            className={`link-count-badge ${isPartial ? 'partial' : ''}`} 
                            onClick={(e) => openLinkModal(e, group)}
                            title="Manage Links"
                        >
                            <SettingsIcon />
                            <span>
                                {isSelected ? `${selectedCount}/${linkCount}` : linkCount} {linkCount === 1 ? 'Link' : 'Links'}
                            </span>
                        </button>
                    )}
                  </div>

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

  const activeEditingGroup = editingGroupKey ? groupedNeighbors.find(g => getGroupKey(g) === editingGroupKey) : null;
  const regularNeighbors = filteredNeighbors.filter(n => !n.isFullScan);
  const fullScanNeighbors = filteredNeighbors.filter(n => n.isFullScan);

  return (
    <>
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

        {activeEditingGroup && (
            <LinkSelectionModal 
                key={`${getGroupKey(activeEditingGroup)}-${activeEditingGroup.links.length}`}
                group={activeEditingGroup}
                initialSelection={selectedLinks.get(getGroupKey(activeEditingGroup))}
                onSave={handleSaveLinks}
                onClose={() => setEditingGroupKey(null)}
            />
        )}
    </>
  );
};

export default NeighborsPopup;