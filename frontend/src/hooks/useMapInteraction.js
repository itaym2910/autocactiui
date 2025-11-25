// frontend/src/hooks/useMapInteraction.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { applyNodeChanges } from 'react-flow-renderer';
import { useTranslation } from 'react-i18next';
import * as api from '../services/apiService';
import { ICONS_BY_THEME, NODE_WIDTH, NODE_HEIGHT } from '../config/constants';
import { useHistoryState } from './useHistoryState';
import { useNodeManagement } from './useNodeManagement';
import { useTooling } from './useTooling';
import { calculateSnaps } from './useSnapping';


/**
 * Creates a React Flow edge object.
 */
const createEdgeObject = (sourceId, targetId, neighborInfo, isPreview = false) => {
    const { interface: iface, bandwidth } = neighborInfo;
    const safeInterface = iface ? iface.replace(/[/]/g, '-') : `unknown-${Math.random()}`;
    const edgeId = `e-${sourceId}-${targetId}-${safeInterface}`;

    const style = isPreview
        ? { stroke: '#007bff', strokeDasharray: '5 5' }
        : { stroke: '#6c757d' };

    return {
        id: edgeId,
        source: sourceId,
        target: targetId,
        animated: isPreview, 
        style,
        data: {
            isPreview,
            interface: iface,
            bandwidth: bandwidth
        }
    };
};


export const useMapInteraction = (theme, onShowNeighborPopup) => {
  const { state, setState, undo, redo, resetState } = useHistoryState();
  const { nodes, edges } = state || { nodes: [], edges: [] };

  const [selectedElements, setSelectedElements] = useState([]);
  const [currentNeighbors, setCurrentNeighbors] = useState([]);
  const [snapLines, setSnapLines] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();
  const dragContext = useRef(null);
  
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const currentNeighborsRef = useRef(currentNeighbors);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { currentNeighborsRef.current = currentNeighbors; }, [currentNeighbors]);


  const {
    createNodeObject,
    handleDeleteElements: baseHandleDeleteElements,
    handleUpdateNodeData,
    handleAddGroup,
    handleAddTextNode,
  } = useNodeManagement(theme, setState);

  const {
    alignElements,
    distributeElements,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    selectAllByType,
  } = useTooling(selectedElements, setState);

  useEffect(() => {
    setState(prev => ({
      ...prev,
      nodes: prev.nodes.map(node => {
        if (node.type !== 'custom') return node;
        const iconType = node.data.iconType;
        if (iconType && ICONS_BY_THEME[iconType]) {
          return { ...node, data: { ...node.data, icon: ICONS_BY_THEME[iconType][theme] } };
        }
        return node;
      })
    }), true);
  }, [theme, setState]);
  
  const clearPreviewElements = useCallback(() => {
      setState(prev => {
          if (!prev) return prev;
          const nextNodes = prev.nodes.filter(n => !n.data.isPreview);
          const nextEdges = prev.edges.filter(e => !e.data.isPreview);
          if (nextNodes.length < prev.nodes.length || nextEdges.length < prev.edges.length) {
              return { nodes: nextNodes, edges: nextEdges };
          }
          return prev;
      }, true);
  }, [setState]);

  // --- 1. STANDARD SCAN ---
  const handleFetchNeighbors = useCallback(async (sourceNode, setLoading, setError) => {
    setLoading(true); setError('');
    setCurrentNeighbors([]);
    try {
      const response = await api.getDeviceNeighbors(sourceNode.id);
      const allNeighbors = response.data.neighbors;
      
      allNeighbors.forEach(neighbor => {
        if (neighbor.ip) {
          api.getDeviceInfo(neighbor.ip).catch(() => {});
          api.getDeviceNeighbors(neighbor.ip).catch(() => {});
        }
      });

      setState(prev => {
        if (!prev) return prev;
        
        const nodesWithoutPreviews = prev.nodes.filter(n => !n.data.isPreview).map(n => ({ ...n, selected: n.id === sourceNode.id }));
        const edgesWithoutPreviews = prev.edges.filter(e => !e.data.isPreview);

        const nodeIdsOnMap = new Set(nodesWithoutPreviews.map(n => n.id));
        const hostnamesOnMap = new Set(nodesWithoutPreviews.filter(n => n.data?.hostname).map(n => n.data.hostname));
     
        const neighborsToAddAsPreview = allNeighbors
            .filter(n => {
                if (n.ip) return !nodeIdsOnMap.has(n.ip);
                return !hostnamesOnMap.has(n.hostname);
            })
            .map(n => ({ ...n, isFullScan: false })); // Explicitly mark as regular
       
        const edgesToCreate = [];
        const neighborsToConnect = allNeighbors.filter(n => n.ip && nodeIdsOnMap.has(n.ip));
        
        neighborsToConnect.forEach(neighbor => {
            const edgeId = `e-${sourceNode.id}-${neighbor.ip}-${neighbor.interface.replace(/[/]/g, '-')}`;
            if (!edgesWithoutPreviews.some(e => e.id === edgeId)) {
                edgesToCreate.push(createEdgeObject(sourceNode.id, neighbor.ip, neighbor, false));
            }
        });

        const edgesWithNewConnections = [...edgesWithoutPreviews, ...edgesToCreate];

        onShowNeighborPopup(neighborsToAddAsPreview, sourceNode);
        setCurrentNeighbors(neighborsToAddAsPreview);
        setSelectedElements(nodesWithoutPreviews.filter(n => n.id === sourceNode.id)); 
        return { nodes: nodesWithoutPreviews, edges: edgesWithNewConnections };

      });
    } catch (err) {
      setError(t('app.errorFetchNeighbors', { ip: sourceNode.id }));
    } finally {
      setLoading(false);
    }
  }, [setState, t, onShowNeighborPopup, setSelectedElements]);

  // --- 2. FULL SCAN (FIXED) ---
  const handleFullScan = useCallback(async (setLoading, setError) => {
    const sourceNode = selectedElements[0];
    if (!sourceNode || !sourceNode.data.ip) return;

    setLoading(true);
    setError('');
    
    try {
        const response = await api.getFullDeviceNeighbors(sourceNode.data.ip); 
        const allNeighbors = response.data.neighbors;

        allNeighbors.forEach(neighbor => {
            if (neighbor.ip) api.getDeviceInfo(neighbor.ip).catch(() => {});
        });

        setState(prev => {
            if (!prev) return prev;

            const nodesWithoutPreviews = prev.nodes.filter(n => !n.data.isPreview);
            const nodeIdsOnMap = new Set(nodesWithoutPreviews.map(n => n.id));
            const hostnamesOnMap = new Set(nodesWithoutPreviews.filter(n => n.data?.hostname).map(n => n.data.hostname));

            // 1. Filter out nodes that are already physically on the map
            const potentialNeighbors = allNeighbors.filter(n => {
                if (n.ip) return !nodeIdsOnMap.has(n.ip);
                return !hostnamesOnMap.has(n.hostname);
            });

            // 2. Get keys of currently displayed "Regular" neighbors
            const existingRegularKeys = new Set(
                currentNeighborsRef.current.map(n => n.ip || n.hostname)
            );

            // 3. Identify NEW neighbors found only by full scan
            const newFullScanNeighbors = [];
            potentialNeighbors.forEach(n => {
                const key = n.ip || n.hostname;
                // If it's NOT in the regular list, it's a Full Scan result
                if (!existingRegularKeys.has(key)) {
                    newFullScanNeighbors.push({ ...n, isFullScan: true });
                }
            });

            // 4. Combine lists
            const combinedNeighbors = [...currentNeighborsRef.current, ...newFullScanNeighbors];

            // 5. Update Local State AND Notify Parent Component
            setCurrentNeighbors(combinedNeighbors);
            
            // !!! THIS LINE WAS MISSING !!!
            // Use the callback to update App.js state, forcing the popup to re-render
            onShowNeighborPopup(combinedNeighbors, sourceNode); 

            return prev; 
        });

    } catch (err) {
        console.error("Full scan failed", err);
        setError(t('app.errorFullScan', { ip: sourceNode.data.ip }) || "Full scan failed.");
    } finally {
        setLoading(false);
    }
  }, [selectedElements, setState, t, onShowNeighborPopup]);

  const confirmNeighbor = useCallback(async (neighborGroup, sourceNodeId, setLoading, setError, isBatchOperation = false) => {
    setLoading(true);
    setError('');

    const isEndDevice = !neighborGroup.ip;
    const neighborIp = neighborGroup.ip;
    const hostname = neighborGroup.hostname;

    const handleStateUpdate = (prev, newNode, newEdges = []) => {
        const sourceNode = prev.nodes.find(n => n.id === sourceNodeId);
        if (!sourceNode) return prev;
        
        const nodesWithoutOld = prev.nodes.filter(n => !n.data.isPreview && n.id !== newNode.id);
        const edgesWithoutPreviews = prev.edges.filter(e => !e.data.isPreview);
        
        const nextNodes = [...nodesWithoutOld, newNode];
        nextNodes.forEach(n => n.selected = n.id === sourceNodeId);
        
        const nextEdges = [...edgesWithoutPreviews, ...newEdges];
        setSelectedElements([sourceNode]);

        const permanentNodeIpsOnMap = new Set(nextNodes.filter(n => n.data.ip).map(n => n.data.ip));
        
        const remainingNeighbors = currentNeighborsRef.current.filter(n => {
            if (n.ip) return !permanentNodeIpsOnMap.has(n.ip);
            const key = `${n.hostname}-${n.interface}`;
            const addedLinks = new Set(neighborGroup.links.map(l => `${l.hostname}-${l.interface}`));
            return !addedLinks.has(key);
        });
        setCurrentNeighbors(remainingNeighbors);

        if (!isBatchOperation) {
          onShowNeighborPopup(remainingNeighbors, sourceNode);
        }
        
        return { nodes: nextNodes, edges: nextEdges };
    };

    if (isEndDevice) {
        setState(prev => {
            const sourceNode = prev.nodes.find(n => n.id === sourceNodeId);
            if (!sourceNode) return prev;
            const linkInfo = neighborGroup.links[0]; 
            const position = { x: sourceNode.position.x + (Math.random() * 300 - 150), y: sourceNode.position.y + 200 };
            const newNode = createNodeObject({ ip: '', hostname: hostname, type: 'Switch' }, position);
            const newEdge = createEdgeObject(sourceNodeId, newNode.id, linkInfo, false);
            return handleStateUpdate(prev, newNode, [newEdge]);
        });
        setLoading(false);
        return;
    }
    
    try {
        let confirmedNode;
        const existingNode = nodesRef.current.find(n => n.id === neighborIp);

        if (existingNode) {
            confirmedNode = existingNode;
        } else {
            const sourceNode = nodesRef.current.find(n => n.id === sourceNodeId);
            const position = { x: sourceNode.position.x + (Math.random() * 300 - 150), y: sourceNode.position.y + 200 };
            try {
                const deviceResponse = await api.getDeviceInfo(neighborIp);
                confirmedNode = createNodeObject(deviceResponse.data, position);
            } catch (infoError) {
                const fallbackDeviceData = { ip: neighborIp, hostname: hostname, type: 'Unknown' };
                confirmedNode = createNodeObject(fallbackDeviceData, position, 'Unknown');
            }
        }

        let allNeighborsOfNewNode = [];
        try {
            const neighborsResponse = await api.getDeviceNeighbors(neighborIp);
            if (neighborsResponse.data.neighbors) {
                allNeighborsOfNewNode = neighborsResponse.data.neighbors;
            }
        } catch (neighborError) {}

        setState(prev => {
            const newEdgesFromSource = neighborGroup.links.map(link => 
                createEdgeObject(sourceNodeId, confirmedNode.id, link, false)
            );
            let tempState = handleStateUpdate(prev, confirmedNode, newEdgesFromSource);
            const permanentNodeIdsOnMap = new Set(tempState.nodes.map(n => n.id));
            const existingEdgeIds = new Set(tempState.edges.map(e => e.id));
            const neighborsToConnect = allNeighborsOfNewNode.filter(n => 
                n.ip && n.ip !== sourceNodeId && permanentNodeIdsOnMap.has(n.ip)
            );
            neighborsToConnect.forEach(neighbor => {
                const edgeId = `e-${confirmedNode.id}-${neighbor.ip}-${neighbor.interface.replace(/[/]/g, '-')}`;
                if (!existingEdgeIds.has(edgeId)) {
                    tempState.edges.push(createEdgeObject(confirmedNode.id, neighbor.ip, neighbor, false));
                }
            });
            return tempState;
        });
    } catch (err) {
        setError(t('app.errorAddNeighbor', { ip: neighborIp }));
        clearPreviewElements();
    } finally {
        setLoading(false);
    }
  }, [createNodeObject, t, onShowNeighborPopup, setState, clearPreviewElements]);

  const confirmPreviewNode = useCallback(async (nodeToConfirm, setLoading, setError) => {
    const edge = edgesRef.current.find(e => e.target === nodeToConfirm.id && e.data.isPreview);
    if (!edge) { setError(t('app.errorAddNeighborGeneric')); return; }
    const neighborGroup = { ...nodeToConfirm.data, links: [{ ...nodeToConfirm.data, interface: edge.data.interface }] };
    await confirmNeighbor(neighborGroup, edge.source, setLoading, setError);
  }, [confirmNeighbor, t]);

  const onNodeClick = useCallback((event, node, setLoading, setError, isContextMenu = false) => {
    if (node.data.isPreview) {
        if (event) event.stopPropagation();
        confirmPreviewNode(node, setLoading, setError);
        return;
    }
    const isNodeAlreadySelected = selectedElements.some(el => el.id === node.id);
    if (isContextMenu && isNodeAlreadySelected) return;

    const isMultiSelect = event && (event.ctrlKey || event.metaKey);
    let newSelectedNodes;
    if (isMultiSelect) {
        newSelectedNodes = isNodeAlreadySelected ? selectedElements.filter(el => el.id !== node.id) : [...selectedElements, node];
    } else {
        newSelectedNodes = [node];
    }
    setSelectedElements(newSelectedNodes);
    clearPreviewElements();
    setState(prev => ({ ...prev, nodes: prev.nodes.map(n => ({...n, selected: newSelectedNodes.some(sn => sn.id === n.id)})) }), true);

    const selectedNode = newSelectedNodes[0];
    if (newSelectedNodes.length === 1 && selectedNode.type === 'custom' && selectedNode.data.ip && !isContextMenu) {
        handleFetchNeighbors(selectedNode, setLoading, setError); 
    } else {
        setCurrentNeighbors([]);
    }
  }, [selectedElements, setState, clearPreviewElements, handleFetchNeighbors, confirmPreviewNode]);

  const onPaneClick = useCallback(() => {
    setSelectedElements([]); setCurrentNeighbors([]); clearPreviewElements();
    setState(prev => ({ ...prev, nodes: prev.nodes.map(n => ({...n, selected: false})) }), true);
  }, [setState, clearPreviewElements]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }) => {
      setSelectedElements(selectedNodes);
      if (selectedNodes.length !== 1 || (selectedNodes.length === 1 && selectedNodes[0].type !== 'custom')) {
          clearPreviewElements(); setCurrentNeighbors([]);
      }
  }, [clearPreviewElements]);
  
  const handleDeleteElements = useCallback(() => {
    baseHandleDeleteElements(selectedElements); setSelectedElements([]);
  }, [baseHandleDeleteElements, selectedElements]);

  const onNodesChange = useCallback((changes) => {
    const isDrag = changes.some(c => c.type === 'position' && c.dragging);
    const isDragEnd = changes.some(c => c.type === 'position' && c.dragging === false);
    if (!isDrag && !isDragEnd) setSnapLines([]);
    setState(prev => {
        if (isDrag && !dragContext.current) {
             const context = { childrenMap: new Map() };
             dragContext.current = context;
             // ... (Group logic) ...
        }
        if (isDrag) {
             const draggedNodeIds = new Set(changes.filter(c => c.dragging).map(c => c.id));
             const draggedNodes = prev.nodes.filter(n => draggedNodeIds.has(n.id));
             const updatedDraggedNodes = draggedNodes.map(dn => {
                 const change = changes.find(c => c.id === dn.id && c.position);
                 return change ? { ...dn, position: change.position } : dn;
             });
             const { snapLines, positionAdjustment } = calculateSnaps(updatedDraggedNodes, prev.nodes);
             setSnapLines(snapLines);
             changes.forEach(change => {
                 if (draggedNodeIds.has(change.id) && change.position) {
                     change.position.x += positionAdjustment.x;
                     change.position.y += positionAdjustment.y;
                 }
             });
        }
        let nextNodes = applyNodeChanges(changes, prev.nodes);
        // ... (Group children movement logic) ...
        return { ...prev, nodes: nextNodes };
    }, !isDragEnd);
    if (isDragEnd) { dragContext.current = null; setSnapLines([]); }
  }, [setState]);

  const resetMap = useCallback(() => {
    resetState(); setSelectedElements([]); setCurrentNeighbors([]);
  }, [resetState]);
  
  const selectAllByTypeHandler = useCallback((iconType) => {
    selectAllByType(iconType, setSelectedElements);
  }, [selectAllByType, setSelectedElements]);

  return {
    nodes, setNodes: (newNodes) => setState(prev => ({...prev, nodes: typeof newNodes === 'function' ? newNodes(prev.nodes) : newNodes}), true),
    edges, setEdges: (newEdges) => setState(prev => ({...prev, edges: typeof newEdges === 'function' ? newEdges(prev.edges) : newEdges}), true),
    selectedElements, snapLines, onNodesChange, onNodeClick, onPaneClick, onSelectionChange, handleDeleteElements, handleUpdateNodeData, handleAddGroup, handleAddTextNode, createNodeObject, resetMap, undo, redo, alignElements, distributeElements, bringForward, sendBackward, bringToFront, sendToBack, selectAllByType: selectAllByTypeHandler, currentNeighbors, confirmNeighbor, confirmPreviewNode, setLoading: setIsLoading, setError: setError, handleFullScan, setState,
  };
};