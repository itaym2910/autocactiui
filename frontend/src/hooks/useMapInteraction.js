// frontend/src/hooks/useMapInteraction.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { applyNodeChanges } from 'react-flow-renderer';
import { useTranslation } from 'react-i18next';
import * as api from '../services/apiService';
import { ICONS_BY_THEME } from '../config/constants';
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

  // Destructure base update function as 'baseHandleUpdateNodeData'
  const {
    createNodeObject,
    handleDeleteElements: baseHandleDeleteElements,
    handleUpdateNodeData: baseHandleUpdateNodeData,
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

  // --- WRAPPER FIX: Updates both Map State AND Selected Elements State ---
  const handleUpdateNodeData = useCallback((id, newData, saveToHistory = true) => {
    baseHandleUpdateNodeData(id, newData, saveToHistory);

    setSelectedElements((prevSelected) =>
      prevSelected.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  }, [baseHandleUpdateNodeData]);

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
          api.getDeviceInfo(neighbor.ip).catch(() => { });
          api.getDeviceNeighbors(neighbor.ip).catch(() => { });
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
          .map(n => ({ ...n, isFullScan: false }));

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

  // --- 2. FULL SCAN ---
  const handleFullScan = useCallback(async (setLoading, setError) => {
    const sourceNode = selectedElements[0];
    if (!sourceNode || !sourceNode.data.ip) {
      console.log("❌ Full Scan: No source node or no IP");
      return;
    }

    console.log("🚀 FULL SCAN TRIGGERED for:", sourceNode.data.hostname, sourceNode.data.ip);
    setLoading(true);
    setError('');

    try {
      const response = await api.getFullDeviceNeighbors(sourceNode.data.ip);
      const allNeighbors = response.data.neighbors;

      console.log("📡 Full Scan API Response - Total neighbors:", allNeighbors.length);
      console.log("📡 Full Scan neighbors details:", allNeighbors);

      allNeighbors.forEach(neighbor => {
        if (neighbor.ip) api.getDeviceInfo(neighbor.ip).catch(() => { });
      });

      setState(prev => {
        if (!prev) return prev;

        const nodesWithoutPreviews = prev.nodes.filter(n => !n.data.isPreview);
        const edgesWithoutPreviews = prev.edges.filter(e => !e.data.isPreview);

        const nodeIdsOnMap = new Set(nodesWithoutPreviews.map(n => n.id));
        const hostnamesOnMap = new Set(nodesWithoutPreviews.filter(n => n.data?.hostname).map(n => n.data.hostname));

        console.log("🔍 Full Scan Starting...");
        console.log("📋 Nodes on map:", nodesWithoutPreviews.map(n => ({
          id: n.id,
          hostname: n.data?.hostname,
          hasIp: !!n.data?.ip
        })));
        console.log("📋 Edges on map:", edgesWithoutPreviews.map(e => ({
          source: e.source,
          target: e.target,
          interface: e.data?.interface
        })));

        // ✅ NEW: Build a set of existing edge keys: "nodeId-interface"
        const existingEdgeKeys = new Set();
        edgesWithoutPreviews.forEach(edge => {
          // For each edge, store both directions with their interfaces
          if (edge.data?.interface) {
            existingEdgeKeys.add(`${edge.source}-${edge.target}-${edge.data.interface}`);
            existingEdgeKeys.add(`${edge.target}-${edge.source}-${edge.data.interface}`);
          }
        });

        console.log("🔑 Existing edge keys:", Array.from(existingEdgeKeys));
        console.log("📥 Full scan returned neighbors:", allNeighbors.map(n => ({
          hostname: n.hostname,
          interface: n.interface,
          hasIp: !!n.ip
        })));

        const potentialNeighbors = allNeighbors.filter(n => {
          console.log(`\n🔍 Processing: ${n.hostname} - ${n.interface}`);

          // First check: Is the device itself already on the map as a node?
          if (n.ip && nodeIdsOnMap.has(n.ip)) {
            console.log(`  ⏭️  SKIP: Device ${n.hostname} (${n.ip}) already on map as a node`);
            return false;
          }

          if (!n.ip && hostnamesOnMap.has(n.hostname)) {
            console.log(`  ℹ️  Device ${n.hostname} exists on map (no IP) - checking if link exists...`);

            // ✅ Device exists on map - check if THIS SPECIFIC LINK already exists
            const deviceNodeOnMap = nodesWithoutPreviews.find(node =>
              node.data?.hostname === n.hostname && (!node.data?.ip || node.data?.ip === '')
            );

            if (deviceNodeOnMap) {
              console.log(`  📍 Found device node: ${deviceNodeOnMap.id}`);

              // Check if edge for this interface already exists
              const edgeKey = `${sourceNode.id}-${deviceNodeOnMap.id}-${n.interface}`;
              const linkExists = existingEdgeKeys.has(edgeKey);

              console.log(`  🔑 Checking edge key: ${edgeKey}`);
              console.log(`  ${linkExists ? '⏭️  SKIP' : '✅ INCLUDE'}: Link ${linkExists ? 'already exists' : 'is NEW'}`);

              return !linkExists; // Only include if link doesn't exist
            }
          }

          // Device is not on map at all
          console.log(`  ✅ INCLUDE: Device not on map yet`);
          return true;
        });

        console.log(`\n📊 After filtering: ${potentialNeighbors.length} potential neighbors`);

        const existingRegularKeys = new Set(
          currentNeighborsRef.current.map(n => `${n.ip || n.hostname}-${n.interface}`)
        );

        const newFullScanNeighbors = [];
        potentialNeighbors.forEach(n => {
          const key = `${n.ip || n.hostname}-${n.interface}`;
          if (!existingRegularKeys.has(key)) {
            console.log(`  ✅ Adding to full scan results: ${n.hostname} - ${n.interface}`);
            newFullScanNeighbors.push({ ...n, isFullScan: true });
          } else {
            console.log(`  ⏭️  Already in current neighbors: ${n.hostname} - ${n.interface}`);
          }
        });

        console.log(`📊 Full Scan Results: ${newFullScanNeighbors.length} new links found`);

        const combinedNeighbors = [...currentNeighborsRef.current, ...newFullScanNeighbors];

        setCurrentNeighbors(combinedNeighbors);
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

  // --- 3. CONFIRM NEIGHBOR (FIXED) ---
  const confirmNeighbor = useCallback(async (neighborGroup, sourceNodeId, setLoading, setError, isBatchOperation = false) => {
    setLoading(true);
    setError('');

    const neighborIp = neighborGroup.ip;
    const hostname = neighborGroup.hostname;

    console.log("🔍 confirmNeighbor starting:", { hostname, neighborIp, sourceNodeId });

    try {
      setState(prev => {
        const sourceNode = prev.nodes.find(n => n.id === sourceNodeId);
        if (!sourceNode) return prev;

        // 1. FIND EXISTING NODE: Search map by IP OR by Hostname
        const existingNode = prev.nodes.find(n => {
          if (n.type !== 'custom') return false;
          // Match by IP if both have it
          if (neighborIp && n.data.ip === neighborIp) return true;
          // Match by Hostname (case insensitive)
          if (hostname && n.data.hostname &&
            n.data.hostname.toLowerCase().trim() === hostname.toLowerCase().trim()) {
            return true;
          }
          return false;
        });

        const edgesWithoutPreviews = prev.edges.filter(e => !e.data.isPreview);
        let nextNodes = [...prev.nodes.filter(n => !n.data.isPreview)];
        let nextEdges = [...edgesWithoutPreviews];

        if (existingNode) {
          console.log("✅ Found existing node on map, adding links only:", existingNode.id);

          // 2. ADD ONLY NEW EDGES
          neighborGroup.links.forEach(linkInfo => {
            const edgeId = `e-${sourceNodeId}-${existingNode.id}-${linkInfo.interface?.replace(/[/]/g, '-') || 'unknown'}`;
            const alreadyExists = nextEdges.some(e => e.id === edgeId);

            if (!alreadyExists) {
              console.log("  ➕ Adding new link:", linkInfo.interface);
              nextEdges.push(createEdgeObject(sourceNodeId, existingNode.id, linkInfo, false));
            }
          });
        } else {
          console.log("🆕 No existing node found, creating new one.");

          // 3. CREATE NEW NODE (Logic moved inside setState to be safe)
          const position = {
            x: sourceNode.position.x + (Math.random() * 300 - 150),
            y: sourceNode.position.y + 200
          };

          // Note: createNodeObject is called here. 
          // If neighborIp is null, it will generate a random ID.
          const newNode = createNodeObject(
            { ip: neighborIp || '', hostname: hostname, type: neighborGroup.type || 'Switch' },
            position
          );

          nextNodes.push(newNode);

          neighborGroup.links.forEach(linkInfo => {
            nextEdges.push(createEdgeObject(sourceNodeId, newNode.id, linkInfo, false));
          });
        }

        // 4. UPDATE CURRENT NEIGHBORS (To remove the added items from the popup)
        const addedLinkKeys = new Set(neighborGroup.links.map(l => `${l.hostname}-${l.interface}`));

        setCurrentNeighbors(prevNeighbors => {
          const remaining = prevNeighbors.filter(n => {
            const key = `${n.hostname}-${n.interface}`;
            return !addedLinkKeys.has(key);
          });

          // Refresh popup if not in batch mode
          if (!isBatchOperation) {
            onShowNeighborPopup(remaining, sourceNode);
          }
          return remaining;
        });

        // Ensure the source node remains selected
        nextNodes = nextNodes.map(n => ({ ...n, selected: n.id === sourceNodeId }));

        return { nodes: nextNodes, edges: nextEdges };
      });
    } catch (err) {
      console.error("Error in confirmNeighbor:", err);
      setError(t('app.errorAddNeighbor', { ip: neighborIp || hostname }));
    } finally {
      setLoading(false);
    }
  }, [createNodeObject, t, onShowNeighborPopup, setState]);

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
    setState(prev => ({ ...prev, nodes: prev.nodes.map(n => ({ ...n, selected: newSelectedNodes.some(sn => sn.id === n.id) })) }), true);

    const selectedNode = newSelectedNodes[0];
    if (newSelectedNodes.length === 1 && selectedNode.type === 'custom' && selectedNode.data.ip && !isContextMenu) {
      handleFetchNeighbors(selectedNode, setLoading, setError);
    } else {
      setCurrentNeighbors([]);
    }
  }, [selectedElements, setState, clearPreviewElements, handleFetchNeighbors, confirmPreviewNode]);

  const onPaneClick = useCallback(() => {
    setSelectedElements([]); setCurrentNeighbors([]); clearPreviewElements();
    setState(prev => ({ ...prev, nodes: prev.nodes.map(n => ({ ...n, selected: false })) }), true);
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
    nodes, setNodes: (newNodes) => setState(prev => ({ ...prev, nodes: typeof newNodes === 'function' ? newNodes(prev.nodes) : newNodes }), true),
    edges, setEdges: (newEdges) => setState(prev => ({ ...prev, edges: typeof newEdges === 'function' ? newEdges(prev.edges) : newEdges }), true),
    selectedElements, snapLines, onNodesChange, onNodeClick, onPaneClick, onSelectionChange, handleDeleteElements,
    handleUpdateNodeData,
    handleAddGroup, handleAddTextNode, createNodeObject, resetMap, undo, redo, alignElements, distributeElements, bringForward, sendBackward, bringToFront, sendToBack, selectAllByType: selectAllByTypeHandler, currentNeighbors, confirmNeighbor, confirmPreviewNode, setLoading: setIsLoading, setError: setError, handleFullScan, setState
  };
};