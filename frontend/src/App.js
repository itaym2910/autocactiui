import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { ReactFlowProvider } from 'react-flow-renderer';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import * as htmlToImage from 'html-to-image';

import { useThemeManager } from './hooks/useThemeManager';
import { useLocalizationManager } from './hooks/useLocalizationManager';
import { useMapInteraction } from './hooks/useMapInteraction';

import Map from './components/Map';
import Sidebar from './components/Sidebar/Sidebar';
import CustomNode from './components/CustomNode';
import GroupNode from './components/GroupNode';
import TextNode from './components/TextNode';
import StartupScreen from './components/Startup/StartupScreen';
import LoginScreen from './components/Login/LoginScreen';
import TopToolbar from './components/TopToolbar/TopToolbar';
import ContextMenu from './components/ContextMenu/ContextMenu';
import UploadSuccessPopup from './components/common/UploadSuccessPopup';
import NeighborsPopup from './components/common/NeighborsPopup';
import AdminPanel from './components/Admin/AdminPanel';
import NotFound from './components/errors/NotFound';
import Forbidden from './components/errors/Forbidden';

import * as api from './services/apiService';
import { handleUploadProcess } from './services/mapExportService';
import * as mapImportExport from './services/mapImportExportService';
import { ICONS_BY_THEME } from './config/constants';
import './App.css';
import './components/TopToolbar/TopToolbar.css';
import './components/ContextMenu/ContextMenu.css';
import './components/common/UploadSuccessPopup.css';
import './components/common/NeighborsPopup.css';

export const NodeContext = React.createContext(null);

// ==========================================
// DASHBOARD COMPONENT
// ==========================================
const Dashboard = ({ token, currentUser, onLogout }) => {
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [mapName, setMapName] = useState('My-Network-Map');

  // UI State
  const [contextMenu, setContextMenu] = useState(null);
  const [uploadSuccessData, setUploadSuccessData] = useState(null);
  const [neighborPopup, setNeighborPopup] = useState({ isOpen: false, neighbors: [], sourceNode: null });
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [mapInteractionLoading, setMapInteractionLoading] = useState(false);

  // --- SERVER SELECTION & POPUP STATE ---
  const [cactiGroups, setCactiGroups] = useState([]);
  const [selectedCactiGroupId, setSelectedCactiGroupId] = useState('');
  const [showUploadPopup, setShowUploadPopup] = useState(false);

  const { t } = useTranslation();
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useRef(null);

  // --- Popup Handlers ---
  const handleShowNeighborPopup = useCallback((neighbors, sourceNode) => {
    // console.log("App.js: Updating Neighbor Popup", { count: neighbors.length, node: sourceNode?.data?.hostname });
    setNeighborPopup({ isOpen: true, neighbors, sourceNode });
  }, []);

  // --- Custom Hooks ---
  const { theme, toggleTheme } = useThemeManager();
  useLocalizationManager();

  // --- FETCH GROUPS ON LOAD ---
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await api.getCactiGroups();
        let loadedGroups = [];
        if (response.data && response.data.data) {
          loadedGroups = response.data.data;
        } else if (Array.isArray(response.data)) {
          loadedGroups = response.data;
        } else {
          loadedGroups = response.data || [];
        }
        setCactiGroups(loadedGroups);
      } catch (err) {
        console.error("Failed to load Cacti groups", err);
      }
    };

    if (token) {
      fetchGroups();
    }
  }, [token]);

  // --- MAP INTERACTION HOOK ---
  const {
    nodes, setNodes, edges, setEdges, selectedElements, snapLines, currentNeighbors,
    onNodesChange, onNodeClick, onPaneClick, onSelectionChange, handleDeleteElements,
    handleUpdateNodeData, handleAddGroup, handleAddTextNode, createNodeObject,
    resetMap, alignElements, distributeElements, bringForward, sendBackward,
    bringToFront, sendToBack, selectAllByType, confirmNeighbor, 
    // handleFullScan, // <--- Removed this to avoid the signature error
    setLoading: setMapHookLoading, setError: setMapHookError, setState: setMapState,
  } = useMapInteraction(theme, handleShowNeighborPopup);

  // --- Memos ---
  const nodeTypes = useMemo(() => ({ custom: CustomNode, group: GroupNode, text: TextNode }), []);
  const availableIcons = useMemo(() => Object.keys(ICONS_BY_THEME), []);
  const selectedCustomNode = useMemo(() =>
    selectedElements.length === 1 && selectedElements[0].type === 'custom' ? selectedElements[0] : null,
    [selectedElements]
  );
  const availableNeighbors = useMemo(() => {
    if (!selectedCustomNode) return [];
    const existingConnections = new Set(
      edges.filter(e => e.source === selectedCustomNode.id || e.target === selectedCustomNode.id)
        .map(e => e.target)
    );
    return currentNeighbors.filter(n => !nodes.some(node => node.id === n.ip));
  }, [selectedCustomNode, currentNeighbors, nodes, edges]);

  // --- Helper Callbacks ---
  const setIsLoading = useCallback((value) => {
    setMapInteractionLoading(value);
    setMapHookLoading(value);
  }, [setMapHookLoading]);

  const setAppError = useCallback((message) => {
    setError(message);
    setMapHookError(message);
    if (message) setTimeout(() => setError(''), 5000);
  }, [setMapHookError]);

  // --- Effects ---
  useEffect(() => {
    if (!contextMenu) return;
    const isNodeStillSelected = selectedElements.some(el => el.id === contextMenu.node.id);
    if (!isNodeStillSelected) setContextMenu(null);
  }, [selectedElements, contextMenu]);

  // --- Map Handlers ---
  const handleStart = async (ip, initialIconName) => {
    if (!ip) { setAppError(t('app.errorStartIp')); return; }
    setIsLoading(true);
    setAppError('');
    try {
      const response = await api.getInitialDevice(ip);
      const newNode = createNodeObject(response.data, { x: 400, y: 150 }, initialIconName);
      setMapState({ nodes: [newNode], edges: [] });
      onNodeClick(null, newNode, setIsLoading, setAppError);
    } catch (err) {
      setAppError(t('app.errorInitialDevice'));
      resetMap();
      setIsLoading(false);
    }
  };

  const handleAddNeighborFromPopup = useCallback(async (neighborGroup) => {
    const { sourceNode } = neighborPopup;
    if (!sourceNode) return;
    await confirmNeighbor(neighborGroup, sourceNode.id, setIsLoading, setAppError, false);
  }, [neighborPopup, confirmNeighbor, setIsLoading, setAppError]);

  const handleAddSelectedNeighbors = useCallback(async (selectedNeighborGroups) => {
    const { sourceNode } = neighborPopup;
    if (!sourceNode || selectedNeighborGroups.length === 0) return;
    setNeighborPopup(prev => ({ ...prev, isOpen: false }));
    setIsLoading(true);
    try {
      for (const neighborGroup of selectedNeighborGroups) {
        await confirmNeighbor(neighborGroup, sourceNode.id, setIsLoading, setAppError, true);
      }
    } catch (err) {
      setAppError(t('app.errorAddNeighborGeneric'));
    } finally {
      setIsLoading(false);
    }
  }, [neighborPopup, confirmNeighbor, setIsLoading, setAppError, t]);

  // ==========================================
  // NEW: LOCAL FULL SCAN HANDLER (FIX)
  // ==========================================
  const handlePopupFullScan = async () => {
    const node = neighborPopup.sourceNode;
    if (!node) {
        setAppError("No source node selected for scan");
        return;
    }

    setIsLoading(true);
    setAppError('');
    
    try {
      // Direct API call to avoid hook signature mismatches.
      // Assumes api.getFullDeviceNeighbors exists (mapping to Python's get_full_device_neighbors)
      // If your apiService uses a different name, please verify it (e.g. api.getDeviceNeighbors(ip, true))
      const response = await api.getFullDeviceNeighbors(node.id);
      
      if (response && response.data && response.data.neighbors) {
         // Update the popup state with the new extended list
         setNeighborPopup(prev => ({
            ...prev,
            neighbors: response.data.neighbors
         }));
      } else {
         setAppError(t('app.noNeighborsFound'));
      }
    } catch (err) {
      console.error("Full scan failed:", err);
      setAppError(t('app.errorFullScan') || "Full scan failed");
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // UPLOAD LOGIC
  // ==========================================
  const handleOpenUploadPopup = () => {
    if (!reactFlowWrapper.current || nodes.length === 0) {
      setAppError(t('app.errorEmptyMap'));
      return;
    }
    if (!selectedCactiGroupId && cactiGroups.length > 0) {
      setSelectedCactiGroupId(cactiGroups[0].id);
    }
    setShowUploadPopup(true);
  };

  const handleConfirmUpload = async () => {
    setShowUploadPopup(false);
    if (!selectedCactiGroupId) {
      setAppError(t('app.errorSelectCacti') || "No server group selected.");
      return;
    }
    setIsUploading(true);
    setAppError('');
    try {
      const taskResponse = await handleUploadProcess({
        mapElement: reactFlowWrapper.current,
        nodes,
        edges,
        mapName,
        cactiGroupId: selectedCactiGroupId,
        theme,
        setNodes,
        setEdges
      });
      setUploadSuccessData(taskResponse);
      setMapName('My-Network-Map');
    } catch (err) {
      setAppError(t('app.errorUpload'));
    } finally {
      setIsUploading(false);
    }
  };

  // --- Download Handlers ---
  const handleDownloadConfig = useCallback(async () => {
    const dataStr = JSON.stringify({ nodes, edges, mapName }, null, 2);
    const fileName = `${mapName || 'network-map'}.json`;

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'JSON Config', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(dataStr);
        await writable.close();
        return;
      } catch (err) { if (err.name === 'AbortError') return; }
    }
    mapImportExport.downloadMapConfig(nodes, edges, mapName);
  }, [nodes, edges, mapName]);

  const handleDownloadPng = useCallback(async () => {
    const mapElement = document.querySelector('.react-flow');
    if (!mapElement) { setAppError('Map element not found'); return; }
    setIsLoading(true);
    const paths = mapElement.querySelectorAll('.react-flow__edge-path');
    paths.forEach(path => { path.style.fill = 'none'; });

    const fileName = `${mapName || 'network-map'}.png`;
    const options = {
      backgroundColor: theme === 'dark' ? '#1f1f1f' : '#ffffff',
      pixelRatio: 2,
      filter: (node) => !['react-flow__controls', 'react-flow__minimap'].some(cls => node.classList && node.classList.contains(cls)),
      style: { 'fill': 'none' }
    };
    try {
      const blob = await htmlToImage.toBlob(mapElement, options);
      if (!blob) throw new Error('Failed to create image blob');
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (fsErr) { if (fsErr.name !== 'AbortError') throw fsErr; }
      } else {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
      }
    } catch (err) {
      if (err.name !== 'AbortError') setAppError(t('app.errorDownloadPng') || 'Failed to generate image');
    } finally {
      setIsLoading(false);
    }
  }, [mapName, theme, setIsLoading, setAppError, t]);

  const handleImportConfig = useCallback(async (file) => {
    setIsLoading(true);
    setAppError('');
    try {
      const { nodes: impNodes, edges: impEdges, mapName: impName } = await mapImportExport.importMapConfig(file);
      setMapState({ nodes: impNodes, edges: impEdges });
      setMapName(impName);
    } catch (err) {
      setAppError(t('app.errorImportMap'));
    } finally {
      setIsLoading(false);
    }
  }, [setMapState, t]);

  // --- Click Handlers ---
  const onNodeClickHandler = useCallback((event, node) => {
    setContextMenu(null);
    onNodeClick(event, node, setIsLoading, setAppError);
  }, [onNodeClick, setIsLoading, setAppError]);

  const onPaneClickHandler = useCallback(() => {
    onPaneClick();
    setContextMenu(null);
    setNeighborPopup(prev => ({ ...prev, isOpen: false }));
  }, [onPaneClick]);

  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault();
    setContextMenu(null);
    setNeighborPopup(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    onNodeClick(event, node, setIsLoading, setAppError, true);
    setContextMenu({ node, top: event.clientY, left: event.clientX });
  }, [onNodeClick, setIsLoading, setAppError]);

  return (
    <NodeContext.Provider value={{ onUpdateNodeData: handleUpdateNodeData }}>
      <div className="app-container">
        <Sidebar
          selectedElements={selectedElements}
          onUploadMap={handleOpenUploadPopup}
          onAddGroup={handleAddGroup}
          onAddTextNode={handleAddTextNode}
          onResetMap={resetMap}
          onLogout={onLogout}
          availableIcons={availableIcons}
          mapName={mapName}
          setMapName={setMapName}
          isMapStarted={nodes.length > 0}
          isUploading={isUploading}

          selectAllByType={selectAllByType}
          onDeleteElements={handleDeleteElements}
          alignElements={alignElements}
          distributeElements={distributeElements}
          bringForward={bringForward}
          sendBackward={sendBackward}
          bringToFront={bringToFront}
          sendToBack={sendToBack}
          onDownloadConfig={handleDownloadConfig}
          onDownloadPng={handleDownloadPng}

          neighbors={availableNeighbors}
          onAddNeighbor={(neighbor) => {
            if (selectedCustomNode) {
              confirmNeighbor(neighbor, selectedCustomNode.id, setIsLoading, setAppError);
            }
          }}

          currentUser={currentUser}
          onOpenAdmin={() => setShowAdminPanel(true)}
        />

        <div className="main-content" ref={reactFlowWrapper}>
          <TopToolbar
            selectedElements={selectedElements}
            onUpdateNodeData={handleUpdateNodeData}
            alignElements={alignElements}
            distributeElements={distributeElements}
            availableIcons={availableIcons}
            theme={theme}
            toggleTheme={toggleTheme}
          />
          <div className='map-container'>
            {nodes.length === 0 ? (
              <div className="startup-wrapper">
                <StartupScreen
                  onStart={handleStart}
                  onImportConfig={handleImportConfig}
                  isLoading={mapInteractionLoading}
                  availableIcons={availableIcons}
                />
              </div>
            ) : (
              <ReactFlowProvider>
                <Map
                  nodes={nodes}
                  edges={edges}
                  snapLines={snapLines}
                  onNodeClick={onNodeClickHandler}
                  onNodesChange={onNodesChange}
                  onPaneClick={onPaneClickHandler}
                  onSelectionChange={onSelectionChange}
                  onNodeContextMenu={handleNodeContextMenu}
                  onPaneContextMenu={onPaneContextMenu}
                  nodeTypes={nodeTypes}
                  theme={theme}
                  setReactFlowInstance={(instance) => (reactFlowInstance.current = instance)}
                />
              </ReactFlowProvider>
            )}

            {showUploadPopup && (
              <div className="download-popup-overlay">
                <div className="download-popup-content">
                  <div className="popup-header">
                    <h3 className="popup-title">{t('modals.upload.title') || "Select Destination Group"}</h3>
                    <p className="popup-description">{t('modals.upload.description')}</p>
                  </div>
                  <div className="popup-body">
                    <div className="custom-select-wrapper">
                      <select
                        className="popup-select-input"
                        value={selectedCactiGroupId}
                        onChange={(e) => setSelectedCactiGroupId(e.target.value)}
                      >
                        {cactiGroups.length === 0 && <option disabled>{t('modals.upload.loading')}</option>}
                        {cactiGroups.map((group) => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                      </select>
                      <span className="custom-arrow"></span>
                    </div>
                  </div>
                  <div className="popup-footer">
                    <button className="btn-cancel" onClick={() => setShowUploadPopup(false)}>{t('common.cancel')}</button>
                    <button className="btn-confirm" onClick={handleConfirmUpload} disabled={!selectedCactiGroupId}>{t('modals.upload.confirm')}</button>
                  </div>
                </div>
              </div>
            )}

            {contextMenu && (
              <ContextMenu
                node={contextMenu.node}
                top={contextMenu.top}
                left={contextMenu.left}
                onClose={() => setContextMenu(null)}
                onDeleteElements={handleDeleteElements}
                bringToFront={bringToFront}
                sendToBack={sendToBack}
                bringForward={bringForward}
                sendBackward={sendBackward}
              />
            )}

            {error && <p className="error-message">{error}</p>}

            {(isUploading || mapInteractionLoading) && (
              <p className="loading-message">{isUploading ? t('app.processingMap') : t('app.loading')}</p>
            )}

            <UploadSuccessPopup
              key={uploadSuccessData ? JSON.stringify(uploadSuccessData.tasks) : 'popup-closed'}
              data={uploadSuccessData}
              onClose={() => setUploadSuccessData(null)}
            />

            {/* --- UPDATED: Use local handler --- */}
            <NeighborsPopup
              isOpen={neighborPopup.isOpen}
              neighbors={neighborPopup.neighbors}
              sourceHostname={neighborPopup.sourceNode?.data?.hostname}
              onAddNeighbor={handleAddNeighborFromPopup}
              onAddSelectedNeighbors={handleAddSelectedNeighbors}
              onClose={() => setNeighborPopup(prev => ({ ...prev, isOpen: false }))}
              isLoading={mapInteractionLoading}
              onFullScan={handlePopupFullScan}
            />

            <AdminPanel
              isOpen={showAdminPanel}
              onClose={() => setShowAdminPanel(false)}
              currentUser={currentUser}
            />

          </div>
        </div>
      </div>
    </NodeContext.Provider>
  );
};

// ==========================================
// MAIN APP ROUTER
// ==========================================
function App() {
  const { t } = useTranslation();
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const storedUser = localStorage.getItem('user_info');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = async (username, password) => {
    setIsAuthLoading(true);
    setAuthError('');
    try {
      const response = await api.login(username, password);
      const { token: newToken, user } = response.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      if (user) {
        setCurrentUser(user);
        localStorage.setItem('user_info', JSON.stringify(user));
      }
      navigate('/');
    } catch (err) {
      setAuthError(t('app.errorLogin') || 'Login failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_info');
    setToken(null);
    setCurrentUser(null);
    navigate('/login');
  }, [navigate]);

  return (
    <Routes>
      <Route path="/login" element={!token ? <LoginScreen onLogin={handleLogin} error={authError} isLoading={isAuthLoading} /> : <Navigate to="/" replace />} />
      <Route path="/" element={token ? <Dashboard token={token} currentUser={currentUser} onLogout={handleLogout} /> : <Navigate to="/login" state={{ from: location }} replace />} />
      <Route path="/403" element={<Forbidden />} />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

export default App;