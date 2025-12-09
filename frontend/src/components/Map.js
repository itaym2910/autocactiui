// frontend/src/components/Map.js
import React, { useState, useRef, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  useViewport,
} from 'react-flow-renderer';

// --- SELECTION BOX ---
const MarqueeSelection = ({ startPos, endPos }) => {
    if (!startPos || !endPos) return null;

    const style = {
        position: 'absolute',
        left: Math.min(startPos.x, endPos.x),
        top: Math.min(startPos.y, endPos.y),
        width: Math.abs(startPos.x - endPos.x),
        height: Math.abs(startPos.y - endPos.y),
        border: '1px solid #007bff',
        backgroundColor: 'rgba(0, 123, 255, 0.2)',
        pointerEvents: 'none',
        zIndex: 9999,
    };

    return <div style={style} />;
};

// --- SNAP LINES ---
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
                            style={{
                                position: 'absolute',
                                left: screenX,
                                top: Math.min(screenY1, screenY2),
                                height: Math.abs(screenY2 - screenY1),
                                width: '1px',
                                backgroundColor: 'var(--accent-primary, #ff0072)',
                                zIndex: 1000,
                                pointerEvents: 'none',
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
                            style={{
                                position: 'absolute',
                                top: screenY,
                                left: Math.min(screenX1, screenX2),
                                width: Math.abs(screenX2 - screenX1),
                                height: '1px',
                                backgroundColor: 'var(--accent-primary, #ff0072)',
                                zIndex: 1000,
                                pointerEvents: 'none',
                            }}
                        />
                    );
                }
            })}
        </>
    );
};

// --- MAIN COMPONENT ---
const Map = ({
  nodes,
  edges,
  onNodeClick,
  onNodesChange,
  onPaneClick,
  onSelectionChange,
  nodeTypes,
  theme,
  setReactFlowInstance,
  onNodeContextMenu,
  snapLines,
  onPaneContextMenu,
  backgroundImage, // <-- prop for image
}) => {
  const [marqueeStart, setMarqueeStart] = useState(null);
  const [marqueeEnd, setMarqueeEnd] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const mapRef = useRef(null);
  const reactFlowInstance = useReactFlow();
  if (setReactFlowInstance) setReactFlowInstance(reactFlowInstance);

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

  // --- MOUSE EVENTS ---
  const handlePaneMouseDown = (event) => {
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
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
  };

  const handlePaneMouseMove = (event) => {
    if (!isSelecting || !marqueeStart) return;
    const mapBounds = mapRef.current.getBoundingClientRect();
    setMarqueeEnd({
      x: event.clientX - mapBounds.left,
      y: event.clientY - mapBounds.top,
    });
  };

  const handlePaneMouseUp = useCallback(
    (event) => {
      if (!isSelecting) {
        if (
          event.button === 0 &&
          !event.target.closest('.react-flow__node') &&
          !event.target.closest('.react-flow__edge')
        ) {
          reactFlowInstance.setNodes((prevNodes) =>
            prevNodes.map((n) => ({ ...n, selected: false }))
          );
          if (onPaneClick) onPaneClick(event);
        }
        return;
      }

      if (marqueeStart && marqueeEnd) {
        const selectionRect = {
          x: Math.min(marqueeStart.x, marqueeEnd.x),
          y: Math.min(marqueeStart.y, marqueeEnd.y),
          width: Math.abs(marqueeStart.x - marqueeEnd.x),
          height: Math.abs(marqueeStart.y - marqueeEnd.y),
        };

        if (selectionRect.width >= 5 || selectionRect.height >= 5) {
          const startGraphPos = reactFlowInstance.project({
            x: selectionRect.x,
            y: selectionRect.y,
          });
          const endGraphPos = reactFlowInstance.project({
            x: selectionRect.x + selectionRect.width,
            y: selectionRect.y + selectionRect.height,
          });

          const graphBox = {
            x: Math.min(startGraphPos.x, endGraphPos.x),
            y: Math.min(startGraphPos.y, endGraphPos.y),
            x2: Math.max(startGraphPos.x, endGraphPos.x),
            y2: Math.max(startGraphPos.y, endGraphPos.y),
          };

          const selectedIds = new Set();
          const selectedNodes = reactFlowInstance.getNodes().filter((node) => {
            if (!node.position || node.hidden) return false;
            const nodeWidth = node.width || 150;
            const nodeHeight = node.height || 50;

            const isSelected =
              node.position.x < graphBox.x2 &&
              node.position.x + nodeWidth > graphBox.x &&
              node.position.y < graphBox.y2 &&
              node.position.y + nodeHeight > graphBox.y;

            if (isSelected) selectedIds.add(node.id);
            return isSelected;
          });

          reactFlowInstance.setNodes((prevNodes) =>
            prevNodes.map((node) => ({
              ...node,
              selected: selectedIds.has(node.id),
            }))
          );

          if (onSelectionChange) {
            onSelectionChange({ nodes: selectedNodes, edges: [] });
          }
        }
      }

      setMarqueeStart(null);
      setMarqueeEnd(null);
      setIsSelecting(false);
    },
    [marqueeStart, marqueeEnd, isSelecting, reactFlowInstance, onSelectionChange, onPaneClick]
  );

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
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeMouseUp={handleNodeMouseUp}
        onNodesChange={onNodesChange}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={undefined}
        onSelectionChange={onSelectionChange}
        fitView
        selectNodesOnDrag={false}
        panOnDrag={[0, 2]}
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
