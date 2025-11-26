// frontend/src/components/Map.js
import React, { useState, useRef, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  useViewport,
} from 'react-flow-renderer';

// --- SUB-COMPONENT: SELECTION BOX ---
const MarqueeSelection = ({ startPos, endPos }) => {
    if (!startPos || !endPos) return null;

    const style = {
        position: 'absolute',
        left: Math.min(startPos.x, endPos.x),
        top: Math.min(startPos.y, endPos.y),
        width: Math.abs(startPos.x - endPos.x),
        height: Math.abs(startPos.y - endPos.y),
        // Default styling for the selection box (Blue)
        border: '1px solid #007bff',
        backgroundColor: 'rgba(0, 123, 255, 0.2)', 
        pointerEvents: 'none',
        zIndex: 9999,
    };

    return <div className="marquee-selection" style={style} />;
};

// --- SUB-COMPONENT: SNAP LINES ---
const SnapLines = ({ lines }) => {
    const { zoom, x, y } = useViewport();
    if (!lines || !lines.length) return null;

    return (
        <>
            {lines.map((line, i) => {
                if (line.type === 'vertical') {
                    const screenX = line.x * zoom + x;
                    const screenY1 = line.y1 * zoom + y;
                    const screenY2 = line.y2 * zoom + y;
                    
                    return (
                        <div
                            key={i}
                            className="snap-line vertical"
                            style={{
                                position: 'absolute',
                                left: screenX,
                                top: Math.min(screenY1, screenY2),
                                height: Math.abs(screenY2 - screenY1),
                                width: '1px',
                                backgroundColor: 'var(--accent-primary, #ff0072)',
                                zIndex: 1000,
                                pointerEvents: 'none'
                            }}
                        />
                    );
                } else {
                    const screenY = line.y * zoom + y;
                    const screenX1 = line.x1 * zoom + x;
                    const screenX2 = line.x2 * zoom + x;
                    
                    return (
                        <div
                            key={i}
                            className="snap-line horizontal"
                            style={{
                                position: 'absolute',
                                top: screenY,
                                left: Math.min(screenX1, screenX2),
                                width: Math.abs(screenX2 - screenX1),
                                height: '1px',
                                backgroundColor: 'var(--accent-primary, #ff0072)',
                                zIndex: 1000,
                                pointerEvents: 'none'
                            }}
                        />
                    );
                }
            })}
        </>
    );
};

// --- MAIN COMPONENT ---
const Map = ({ nodes, edges, onNodeClick, onNodesChange, onPaneClick, onSelectionChange, nodeTypes, theme, setReactFlowInstance, onNodeContextMenu, snapLines, onPaneContextMenu }) => {
  
  const [marqueeStart, setMarqueeStart] = useState(null);
  const [marqueeEnd, setMarqueeEnd] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false); // Track if we are in middle-click mode
  
  const mapRef = useRef(null);
  const reactFlowInstance = useReactFlow();

  if (setReactFlowInstance) {
    setReactFlowInstance(reactFlowInstance);
  }

  const minimapNodeColor = (node) => {
    switch (node.type) {
      case 'custom':
        return theme === 'dark' ? '#a8b3cf' : '#6f81a4';
      case 'group':
        return node.data.color || '#e9ecef';
      case 'text':
        return 'transparent';
      default:
        return '#eee';
    }
  };

  // --- 1. MOUSE DOWN: Start Selection on Middle Click ---
  const handlePaneMouseDown = (event) => {
      // Check for Middle Mouse Button (Button 1)
      if (event.button === 1) {
          event.preventDefault();  // Stop browser auto-scroll icon
          event.stopPropagation(); // Stop React Flow from Panning

          // Don't start if clicking on controls
          if (event.target.closest('.react-flow__controls')) return;

          const mapBounds = mapRef.current.getBoundingClientRect();
          const pos = {
              x: event.clientX - mapBounds.left,
              y: event.clientY - mapBounds.top,
          };

          setMarqueeStart(pos);
          setMarqueeEnd(pos);
          setIsSelecting(true);
      }
      // Left click logic (handled by React Flow or onPaneClick usually)
  };

  // --- 2. MOUSE MOVE: Update Box Size ---
  const handlePaneMouseMove = (event) => {
      if (!isSelecting || !marqueeStart) return;
      
      const mapBounds = mapRef.current.getBoundingClientRect();
      setMarqueeEnd({
          x: event.clientX - mapBounds.left,
          y: event.clientY - mapBounds.top,
      });
  };
  
  // --- 3. MOUSE UP: Calculate Selection ---
  const handlePaneMouseUp = useCallback((event) => {
      // If we were not middle-click selecting, handle standard left-click pane logic
      if (!isSelecting) {
        // Only trigger onPaneClick for Left Button (0) to deselect items
        if (event.button === 0 && !event.target.closest('.react-flow__node') && !event.target.closest('.react-flow__edge')) {
             onPaneClick(event);
        }
        return;
      }

      // If we were selecting, finish the logic
      if (marqueeStart && marqueeEnd) {
          const selectionRect = {
              x: Math.min(marqueeStart.x, marqueeEnd.x),
              y: Math.min(marqueeStart.y, marqueeEnd.y),
              width: Math.abs(marqueeStart.x - marqueeEnd.x),
              height: Math.abs(marqueeStart.y - marqueeEnd.y),
          };

          // Filter nodes that intersect with the box
          // Note: Project node positions to screen coordinates to compare with selectionRect
          if (selectionRect.width >= 5 || selectionRect.height >= 5) {
              const selectedNodes = reactFlowInstance.getNodes().filter(node => {
                  if (!node.position) return false;
                  
                  // Convert Node Graph Position -> Screen Position
                  const nodePosition = reactFlowInstance.project(node.position);
                  
                  // Scale width/height by current zoom level
                  const currentZoom = reactFlowInstance.getZoom();
                  const nodeWidth = (node.width || 150) * currentZoom;
                  const nodeHeight = (node.height || 50) * currentZoom;

                  return (
                      nodePosition.x < selectionRect.x + selectionRect.width &&
                      nodePosition.x + nodeWidth > selectionRect.x &&
                      nodePosition.y < selectionRect.y + selectionRect.height &&
                      nodePosition.y + nodeHeight > selectionRect.y
                  );
              });
              
              // Notify parent of new selection
              onSelectionChange({ nodes: selectedNodes, edges: [] });
          }
      }

      // Reset State
      setMarqueeStart(null);
      setMarqueeEnd(null);
      setIsSelecting(false);
      
  }, [marqueeStart, marqueeEnd, isSelecting, reactFlowInstance, onSelectionChange, onPaneClick]);

  const handleNodeMouseUp = (event) => {
    event.stopPropagation();
  };

  return (
    <div 
        className="map-view"
        ref={mapRef}
        onMouseDown={handlePaneMouseDown}
        onMouseMove={handlePaneMouseMove}
        onMouseUp={handlePaneMouseUp}
        // Ensure the div takes up space
        style={{ width: '100%', height: '100%' }} 
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        onNodeMouseUp={handleNodeMouseUp}
        onNodesChange={onNodesChange}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        // We handle clicks manually in handlePaneMouseUp to distinguish drag vs click
        onPaneClick={undefined} 
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        fitView
        selectNodesOnDrag={false}
        // Optional: Disable standard pan on middle button so it doesn't fight our logic
        // panOnDrag={ [0] } // Only Left Click Pans? (Requires React Flow v11+)
      >
        <MiniMap nodeColor={minimapNodeColor} />
        <Controls />
        <Background color={theme === 'dark' ? '#404040' : '#ddd'} gap={24} />
        <SnapLines lines={snapLines} />
      </ReactFlow>
      
      <MarqueeSelection startPos={marqueeStart} endPos={marqueeEnd} />
    </div>
  );
};

export default Map;