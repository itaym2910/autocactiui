import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { ReactFlowProvider } from 'react-flow-renderer';
import { useTranslation } from 'react-i18next';
import * as htmlToImage from 'html-to-image';

import { useThemeManager } from './hooks/useThemeManager';
import { useLocalizationManager } from './hooks/useLocalizationManager';
import { useCacti } from './hooks/useCacti';
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

function App() {
  const [error, setError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mapName, setMapName] = useState('My-Network-Map');
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [contextMenu, setContextMenu] = useState(null);
  const [uploadSuccessData, setUploadSuccessData] = useState(null);
  const [neighborPopup, setNeighborPopup] = useState({ isOpen: false, neighbors: [], sourceNode: null });
  const [mapInteractionLoading, setMapInteractionLoading] = useState(false);
  
  const { t } = useTranslation();
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useRef(null);

  // --- Popup Handlers ---
  const handleShowNeighborPopup = useCallback((neighbors, sourceNode) => {
    setNeighborPopup({ isOpen: true, neighbors, sourceNode });
  }, []);

  const handleCloseNeighborPopup = useCallback(() => {
    setNeighborPopup(prev => ({ ...prev, isOpen: false }));
  }, []);

  // --- Custom Hooks ---
  const { theme, toggleTheme } = useThemeManager();
  useLocalizationManager();
  const { cactiGroups, selectedCactiGroupId, setSelectedCactiGroupId } = useCacti(setError, token);
  const {
    nodes, setNodes,
    edges, setEdges,
    selectedElements,
    snapLines,
    currentNeighbors,
    onNodesChange,
    onNodeClick,
    onPaneClick,
    onSelectionChange,
    handleDeleteElements,
    handleUpdateNodeData,
    handleAddGroup,
    handleAddTextNode,
    createNodeObject,
    resetMap,
    undo,
    redo,
    alignElements,
    distributeElements,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    selectAllByType,
    confirmPreviewNode,
    confirmNeighbor,
    handleFullScan,
    setLoading: setMapHookLoading,
    setError: setMapHookError,
    setState: setMapState,
  } = useMapInteraction(theme, handleShowNeighborPopup);

  // --- Memos ---
  const nodeTypes = useMemo(() => ({ custom: CustomNode, group: GroupNode, text: TextNode }), []);
  const availableIcons = useMemo(() => Object.keys(ICONS_BY_THEME).filter(k => k !== 'Unknown'), []);

  const selectedCustomNode = useMemo(() => 
    selectedElements.length === 1 && selectedElements[0].type === 'custom' ? selectedElements[0] : null,
    [selectedElements]
  );

  const availableNeighbors = useMemo(() => {
      if (!selectedCustomNode) return [];
      const existingConnections = new Set(
          edges
              .filter(e => e.source === selectedCustomNode.id || e.target === selectedCustomNode.id)
              .map(e => {
                  const targetNode = nodes.find(n => n.id === e.target);
                  if (targetNode && !targetNode.data.ip) {
                      return `${e.source}-${targetNode.data.hostname}-${e.data.interface}`;
                  }
                  return e.target;
              })
      );
      return currentNeighbors.filter(n => {
          if (n.ip) {
              return !nodes.some(node => node.id === n.ip);
          }
          const connectionKey = `${selectedCustomNode.id}-${n.hostname}-${n.interface}`;
          return !existingConnections.has(connectionKey);
      });
  }, [selectedCustomNode, currentNeighbors, nodes, edges]);


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

  useEffect(() => {
    if (!neighborPopup.isOpen) return;
    const shouldPopupBeOpen = 
      selectedElements.length === 1 && 
      selectedElements[0].type === 'custom' && 
      neighborPopup.sourceNode?.id === selectedElements[0].id;

    if (!shouldPopupBeOpen) handleCloseNeighborPopup();
  }, [selectedElements, neighborPopup.isOpen, neighborPopup.sourceNode, handleCloseNeighborPopup]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z') { event.preventDefault(); undo(); } 
        else if (event.key === 'y') { event.preventDefault(); redo(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // --- Auth & Startup ---
  const handleLogin = async (username, password) => {
    setIsAuthLoading(true);
    setAppError('');
    try {
      const response = await api.login(username, password);
      localStorage.setItem('token', response.data.token);
      setToken(response.data.token);
    } catch (err) {
      setAppError(t('app.errorLogin'));
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    resetMap();
  };

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
    handleCloseNeighborPopup();
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
  }, [neighborPopup, confirmNeighbor, setIsLoading, setAppError, handleCloseNeighborPopup, t]);

  const handleCreateMap = async () => {
    if (!reactFlowWrapper.current || nodes.length === 0) { setAppError(t('app.errorEmptyMap')); return; }
    if (!selectedCactiGroupId) { setAppError(t('app.errorSelectCacti')); return; }
    
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

  // --- UPDATED: JSON Download with "Save As" support ---
  const handleDownloadConfig = useCallback(async () => {
    const dataStr = JSON.stringify({ nodes, edges, mapName }, null, 2);
    const fileName = `${mapName || 'network-map'}.json`;

    // 1. Try File System Access API (Chrome/Edge/Opera)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'JSON Configuration File',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(dataStr);
        await writable.close();
        return;
      } catch (err) {
        // User cancelled picker, do nothing
        if (err.name === 'AbortError') return;
        console.warn('File System Access API failed, falling back to download.', err);
      }
    }

    // 2. Fallback for Firefox/Safari
    mapImportExport.downloadMapConfig(nodes, edges, mapName);
  }, [nodes, edges, mapName]);

  // --- UPDATED: PNG Download with "Save As" support ---
  const handleDownloadPng = useCallback(async () => {
    const mapElement = document.querySelector('.react-flow');
    if (!mapElement) {
      setAppError('Map element not found');
      return;
    }

    setIsLoading(true);
    const fileName = `${mapName || 'network-map'}.png`;
    const backgroundColor = theme === 'dark' ? '#1f1f1f' : '#ffffff';
    const options = {
      backgroundColor: backgroundColor,
      pixelRatio: 2,
      filter: (node) => {
        const exclude = ['react-flow__controls', 'react-flow__minimap'];
        return !exclude.some(cls => node.classList && node.classList.contains(cls));
      }
    };

    try {
        // Generate Blob instead of Data URL for better file handling
        const blob = await htmlToImage.toBlob(mapElement, options);
        if (!blob) throw new Error('Failed to create image blob');

        // 1. Try File System Access API (Chrome/Edge/Opera)
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'PNG Image',
                        accept: { 'image/png': ['.png'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
            } catch (fsErr) {
                 // User cancelled, ignore. If real error, fall through to fallback.
                 if (fsErr.name !== 'AbortError') throw fsErr;
            }
        } 
        else {
            // 2. Fallback for Firefox/Safari
            const link = document.createElement('a');
            link.download = fileName;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
        }
    } catch (err) {
      console.error('Failed to download PNG', err);
      if (err.name !== 'AbortError') {
         setAppError(t('app.errorDownloadPng') || 'Failed to generate image');
      }
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

  // --- Render ---
  const onNodeClickHandler = useCallback((event, node) => {
      setContextMenu(null);
      onNodeClick(event, node, setIsLoading, setAppError); 
  }, [onNodeClick, setIsLoading, setAppError]);

  const onPaneClickHandler = useCallback(() => {
    onPaneClick();
    setContextMenu(null);
    handleCloseNeighborPopup();
  }, [onPaneClick, handleCloseNeighborPopup]);

  const onPaneContextMenu = useCallback((event) => {
    event.preventDefault();
    setContextMenu(null);
    handleCloseNeighborPopup();
  }, [handleCloseNeighborPopup]);

  const handleNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    onNodeClick(event, node, setIsLoading, setAppError, true);
    setContextMenu({ node, top: event.clientY, left: event.clientX });
  }, [onNodeClick, setIsLoading, setAppError]);

  if (!token) {
    return <LoginScreen onLogin={handleLogin} error={error} isLoading={isAuthLoading} />;
  }

  return (
    <NodeContext.Provider value={{ onUpdateNodeData: handleUpdateNodeData }}>
      <div className="app-container">
        <Sidebar 
          selectedElements={selectedElements}
          onUploadMap={handleCreateMap}
          onAddGroup={handleAddGroup}
          onAddTextNode={handleAddTextNode}
          onResetMap={resetMap}
          onLogout={handleLogout}
          availableIcons={availableIcons}
          mapName={mapName}
          setMapName={setMapName}
          isMapStarted={nodes.length > 0}
          isUploading={isUploading}
          cactiGroups={cactiGroups}
          selectedCactiGroupId={selectedCactiGroupId}
          setSelectedCactiGroupId={setSelectedCactiGroupId}
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
                  isLoading={isAuthLoading || mapInteractionLoading}
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
            {(isAuthLoading || isUploading || mapInteractionLoading) && (
              <p className="loading-message">
                {isUploading ? t('app.processingMap') : t('app.loading')}
              </p>
            )}
            <UploadSuccessPopup 
              key={uploadSuccessData ? JSON.stringify(uploadSuccessData.tasks) : 'popup-closed'}
              data={uploadSuccessData} 
              onClose={() => setUploadSuccessData(null)} 
            />
            
            <NeighborsPopup
              isOpen={neighborPopup.isOpen}
              neighbors={neighborPopup.neighbors}
              sourceHostname={neighborPopup.sourceNode?.data?.hostname}
              onAddNeighbor={handleAddNeighborFromPopup}
              onAddSelectedNeighbors={handleAddSelectedNeighbors}
              onClose={handleCloseNeighborPopup}
              isLoading={mapInteractionLoading}
              onFullScan={() => handleFullScan(setIsLoading, setAppError)}
            />
          </div>
        </div>
      </div>
    </NodeContext.Provider>
  );
}

export default App;