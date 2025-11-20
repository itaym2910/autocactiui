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
 * @param {string} sourceId - The ID of the source node.
 * @param {string} targetId - The ID of the target node.
 * @param {object} neighborInfo - The neighbor data from the API.
 * @param {boolean} [isPreview=false] - Whether the edge is a temporary preview.
 * @returns {object} A complete React Flow edge object.
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
        animated: isPreview, // Animate only previews
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
  
  // Refs to hold the latest state for use in callbacks to avoid stale closures
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const currentNeighborsRef = useRef(currentNeighbors);
  useEffect(() => {
      nodesRef.current = nodes;
  }, [nodes]);
   useEffect(() => {
      edgesRef.current = edges;
  }, [edges]);
  useEffect(() => {
    currentNeighborsRef.current = currentNeighbors;
  }, [currentNeighbors]);


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

  const handleFetchNeighbors = useCallback(async (sourceNode, setLoading, setError) => {
    setLoading(true); setError('');
    setCurrentNeighbors([]);
    try {
      const response = await api.getDeviceNeighbors(sourceNode.id);
      const allNeighbors = response.data.neighbors;
      
      // --- Preloading Enhancement ---
      allNeighbors.forEach(neighbor => {
        if (neighbor.ip) {
          // Preload device info (icon, model, etc.)
          api.getDeviceInfo(neighbor.ip).catch(err => {
            console.warn(`Preload failed for device info ${neighbor.ip}:`, err.message);
          });
          // Preload the next level of neighbors ("grandchildren")
          api.getDeviceNeighbors(neighbor.ip).catch(err => {
            console.warn(`Preload failed for neighbors of ${neighbor.ip}:`, err.message);
          });
        }
      });
      // --- End Preloading ---

      setState(prev => {
        if (!prev) return prev;
        
        const nodesWithoutPreviews = prev.nodes.filter(n => !n.data.isPreview).map(n => ({ ...n, selected: n.id === sourceNode.id }));
        const edgesWithoutPreviews = prev.edges.filter(e => !e.data.isPreview);

        const nodeIdsOnMap = new Set(nodesWithoutPreviews.map(n => n.id));
        const hostnamesOnMap = new Set(nodesWithoutPreviews.filter(n => n.data?.hostname).map(n => n.data.hostname));
     
        const neighborsToAddAsPreview = allNeighbors.filter(n => {
            if (n.ip) {
                return !nodeIdsOnMap.has(n.ip);
            } else {
                return !hostnamesOnMap.has(n.hostname);
            }
        });
       
       
        const edgesToCreate = [];
        const existingConnections = new Set(edgesWithoutPreviews.map(e => [e.source, e.target].sort().join('--')));
        const neighborsToConnect = allNeighbors.filter(n => n.ip && nodeIdsOnMap.has(n.ip));
        
        neighborsToConnect.forEach(neighbor => {
            const edgeId = `e-${sourceNode.id}-${neighbor.ip}-${neighbor.interface.replace(/[/]/g, '-')}`;
            // Add edge only if this specific interface connection doesn't exist
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

  // NEW: Full Scan Handler
  const handleFullScan = useCallback(async (setLoading, setError) => {
    const sourceNode = selectedElements[0];
    if (!sourceNode || !sourceNode.data.ip) return;

    setLoading(true);
    setError('');
    
    try {
        // Calling the new API endpoint
        const response = await api.getFullDeviceNeighbors(sourceNode.data.ip); 
        const allNeighbors = response.data.neighbors;

        // --- Preloading Enhancement (Same as regular scan) ---
        allNeighbors.forEach(neighbor => {
            if (neighbor.ip) {
                api.getDeviceInfo(neighbor.ip).catch(() => {});
            }
        });

        // Update the popup list without modifying the map state yet
        setState(prev => {
            if (!prev) return prev;

            // We only need to calculate which neighbors are not already on the map
            // to update the `currentNeighbors` state that the popup consumes.
            const nodesWithoutPreviews = prev.nodes.filter(n => !n.data.isPreview);
            const nodeIdsOnMap = new Set(nodesWithoutPreviews.map(n => n.id));
            const hostnamesOnMap = new Set(nodesWithoutPreviews.filter(n => n.data?.hostname).map(n => n.data.hostname));

            const neighborsToAddAsPreview = allNeighbors.filter(n => {
                if (n.ip) {
                    return !nodeIdsOnMap.has(n.ip);
                } else {
                    return !hostnamesOnMap.has(n.hostname);
                }
            });

            setCurrentNeighbors(neighborsToAddAsPreview);
            return prev; 
        });

    } catch (err) {
        console.error("Full scan failed", err);
        setError(t('app.errorFullScan', { ip: sourceNode.data.ip }) || "Full scan failed.");
    } finally {
        setLoading(false);
    }
  }, [selectedElements, setState, t]);

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

        // Only reopen/refresh the popup if this is not part of a batch operation.
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
                // This call will be instantaneous if data was successfully preloaded.
                const deviceResponse = await api.getDeviceInfo(neighborIp);
                confirmedNode = createNodeObject(deviceResponse.data, position);
            } catch (infoError) {
                console.warn(`Could not get device info for ${neighborIp}. Creating a fallback node.`, infoError);
                const fallbackDeviceData = { ip: neighborIp, hostname: hostname, type: 'Unknown' };
                confirmedNode = createNodeObject(fallbackDeviceData, position, 'Unknown');
            }
        }

        let allNeighborsOfNewNode = [];
        try {
            // This call will be instantaneous if data was successfully preloaded.
            const neighborsResponse = await api.getDeviceNeighbors(neighborIp);
            if (neighborsResponse.data.neighbors) {
                allNeighborsOfNewNode = neighborsResponse.data.neighbors;
            }
        } catch (neighborError) {
            console.warn(`Could not get neighbors for ${neighborIp}. Proceeding without them.`, neighborError);
        }

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
        console.error("A critical error occurred while adding a neighbor:", err);
        setError(t('app.errorAddNeighbor', { ip: neighborIp }));
        clearPreviewElements();
    } finally {
        setLoading(false);
    }
  }, [createNodeObject, t, onShowNeighborPopup, setState, clearPreviewElements]);

  const confirmPreviewNode = useCallback(async (nodeToConfirm, setLoading, setError) => {
    const edge = edgesRef.current.find(e => e.target === nodeToConfirm.id && e.data.isPreview);
    if (!edge) {
      setError(t('app.errorAddNeighborGeneric'));
      return;
    }
    
    const neighborGroup = {
      ...nodeToConfirm.data,
      links: [{ ...nodeToConfirm.data, interface: edge.data.interface }]
    };

    await confirmNeighbor(neighborGroup, edge.source, setLoading, setError);
  }, [confirmNeighbor, t, setError]);

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
        newSelectedNodes = isNodeAlreadySelected
            ? selectedElements.filter(el => el.id !== node.id)
            : [...selectedElements, node];
    } else {
        newSelectedNodes = [node];
    }

    setSelectedElements(newSelectedNodes);
    clearPreviewElements();

    setState(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => ({...n, selected: newSelectedNodes.some(sn => sn.id === n.id)}))
    }), true);

    const selectedNode = newSelectedNodes[0];
    if (newSelectedNodes.length === 1 && selectedNode.type === 'custom' && selectedNode.data.ip && !isContextMenu) {
        handleFetchNeighbors(selectedNode, setLoading, setError); 
    } else {
        setCurrentNeighbors([]);
    }
  }, [selectedElements, setState, clearPreviewElements, handleFetchNeighbors, confirmPreviewNode]);

  const onPaneClick = useCallback(() => {
    setSelectedElements([]);
    setCurrentNeighbors([]);
    clearPreviewElements();
    setState(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => ({...n, selected: false}))
    }), true);
  }, [setState, clearPreviewElements]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }) => {
      setSelectedElements(selectedNodes);
      if (selectedNodes.length !== 1 || (selectedNodes.length === 1 && selectedNodes[0].type !== 'custom')) {
          clearPreviewElements();
          setCurrentNeighbors([]);
      }
  }, [clearPreviewElements]);
  
  const handleDeleteElements = useCallback(() => {
    baseHandleDeleteElements(selectedElements);
    setSelectedElements([]);
  }, [baseHandleDeleteElements, selectedElements]);

  const onNodesChange = useCallback((changes) => {
    const isDrag = changes.some(c => c.type === 'position' && c.dragging);
    const isDragEnd = changes.some(c => c.type === 'position' && c.dragging === false);
    
    if (!isDrag && !isDragEnd) {
        setSnapLines([]);
    }

    setState(prev => {
        if (isDrag && !dragContext.current) {
            const context = { childrenMap: new Map() };
            const movedGroupIds = new Set(
                changes.map(c => prev.nodes.find(n => n.id === c.id)).filter(n => n && n.type === 'group').map(n => n.id)
            );

            if (movedGroupIds.size > 0) {
                const potentialChildren = prev.nodes.filter(n => n.type !== 'group');
                for (const node of potentialChildren) {
                    const parentGroup = prev.nodes
                        .filter(g => movedGroupIds.has(g.id) &&
                            node.position.x >= g.position.x && (node.position.x + (node.width || NODE_WIDTH)) <= (g.position.x + g.data.width) &&
                            node.position.y >= g.position.y && (node.position.y + (node.height || NODE_HEIGHT)) <= (g.position.y + g.data.height)
                        ).sort((a, b) => (b.zIndex || 1) - (a.zIndex || 1))[0];
                    if (parentGroup) {
                        if (!context.childrenMap.has(parentGroup.id)) context.childrenMap.set(parentGroup.id, new Set());
                        context.childrenMap.get(parentGroup.id).add(node.id);
                    }
                }
            }
            dragContext.current = context;
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

        if (isDrag && dragContext.current && dragContext.current.childrenMap.size > 0) {
            const groupDeltas = new Map();
            const positionChanges = changes.filter(c => c.type === 'position' && c.position);

            for (const change of positionChanges) {
                const originalNode = prev.nodes.find(n => n.id === change.id);
                if (originalNode && originalNode.type === 'group') {
                    groupDeltas.set(originalNode.id, { dx: change.position.x - originalNode.position.x, dy: change.position.y - originalNode.position.y });
                }
            }

            if (groupDeltas.size > 0) {
                const directlyMovedNodeIds = new Set(positionChanges.map(c => c.id));
                const childrenToMove = new Map();
                dragContext.current.childrenMap.forEach((childIds, groupId) => {
                    const delta = groupDeltas.get(groupId);
                    if (delta) {
                        childIds.forEach(childId => {
                            if (!directlyMovedNodeIds.has(childId)) {
                                const originalChildNode = prev.nodes.find(n => n.id === childId);
                                if(originalChildNode) {
                                    childrenToMove.set(childId, { x: originalChildNode.position.x + delta.dx, y: originalChildNode.position.y + delta.dy });
                                }
                            }
                        });
                    }
                });
                nextNodes = nextNodes.map(node => childrenToMove.has(node.id) ? { ...node, position: childrenToMove.get(node.id) } : node);
            }
        }
        return { ...prev, nodes: nextNodes };
    }, !isDragEnd);

    if (isDragEnd) {
        dragContext.current = null;
        setSnapLines([]);
    }
  }, [setState]);

  const resetMap = useCallback(() => {
    resetState();
    setSelectedElements([]);
    setCurrentNeighbors([]);
  }, [resetState]);
  
  const selectAllByTypeHandler = useCallback((iconType) => {
    selectAllByType(iconType, setSelectedElements);
  }, [selectAllByType, setSelectedElements]);

  return {
    nodes, setNodes: (newNodes) => setState(prev => ({...prev, nodes: typeof newNodes === 'function' ? newNodes(prev.nodes) : newNodes}), true),
    edges, setEdges: (newEdges) => setState(prev => ({...prev, edges: typeof newEdges === 'function' ? newEdges(prev.edges) : newEdges}), true),
    selectedElements,
    snapLines,
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
    selectAllByType: selectAllByTypeHandler,
    currentNeighbors,
    confirmNeighbor,
    confirmPreviewNode,
    setLoading: setIsLoading,
    setError: setError,
    handleFullScan,
    setState,
  };
};