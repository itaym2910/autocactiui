// frontend/src/components/GroupNode.js
import React, { memo, useState, useEffect, useRef, useContext } from 'react';
import { useViewport } from 'react-flow-renderer';
import { NodeContext } from '../App';

// SVG Icon for Resizing (Bottom Right)
const ResizerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M20 20H4v-4h2v2h12v-2h2v4zM4 4h16v4h-2V6H6v2H4V4z" transform="rotate(-45 12 12)" />
    </svg>
);

// SVG Icon for Rotation (Top Right)
const RotateIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
        <path fill="currentColor" d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6 0 1.32-.42 2.54-1.13 3.55l1.49 1.49C19.65 16.67 20.37 14.82 20.37 13c0-4.63-3.74-8.37-8.37-8.37zM6 13c0 1.66.57 3.2 1.54 4.45l-1.48 1.48C4.69 17.29 4 15.24 4 13c0-4.63 3.73-8.37 8.37-8.37v3c-2.97 0-5.37 2.4-5.37 5.37z" />
    </svg>
);

export default memo(({ id, data, selected }) => {
    const { onUpdateNodeData } = useContext(NodeContext);
    const { label, color, width, height, opacity, shape, borderColor, borderStyle, borderWidth, rotation = 0 } = data;
    const { zoom } = useViewport();
    
    const [isEditing, setIsEditing] = useState(false);
    const [labelText, setLabelText] = useState(label);
    const nodeRef = useRef(null);
    const lastDimensions = useRef(null);
    const lastRotation = useRef(0);

    const supportsRotation = shape === 'rounded-rectangle' || shape === 'triangle' || !shape;

    useEffect(() => {
        setLabelText(label);
    }, [label]);

    const handleLabelDoubleClick = (e) => {
        e.stopPropagation(); 
        setIsEditing(true);
    };

    const handleLabelChange = (e) => {
        setLabelText(e.target.value);
    };

    const handleLabelUpdate = () => {
        onUpdateNodeData(id, { label: labelText });
        setIsEditing(false);
    };

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleLabelUpdate();
        } else if (e.key === 'Escape') {
            setLabelText(label);
            setIsEditing(false);
        }
    };

    const onRotateStart = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = nodeRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        lastRotation.current = rotation;

        const doRotate = (dragEvent) => {
            const dx = dragEvent.clientX - centerX;
            const dy = dragEvent.clientY - centerY;
            let deg = Math.atan2(dy, dx) * (180 / Math.PI);
            deg = deg + 45; 

            if (dragEvent.shiftKey) {
                deg = Math.round(deg / 15) * 15;
            }

            lastRotation.current = deg;
            onUpdateNodeData(id, { rotation: deg }, false);
        };

        const stopRotate = () => {
            document.removeEventListener('mousemove', doRotate);
            document.removeEventListener('mouseup', stopRotate);
            onUpdateNodeData(id, { rotation: lastRotation.current }, true);
        };

        document.addEventListener('mousemove', doRotate);
        document.addEventListener('mouseup', stopRotate);
    };

    const onResizeStart = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = width;
        const startHeight = height;
        
        const currentRotation = rotation || 0;
        const rad = currentRotation * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        lastDimensions.current = { width: startWidth, height: startHeight };

        const doDrag = (dragEvent) => {
            const deltaX = (dragEvent.clientX - startX) / zoom;
            const deltaY = (dragEvent.clientY - startY) / zoom;

            const rotatedDeltaX = deltaX * cos + deltaY * sin;
            const rotatedDeltaY = -deltaX * sin + deltaY * cos;

            let newWidth = startWidth + rotatedDeltaX;
            let newHeight = startHeight + rotatedDeltaY;

            if (dragEvent.altKey) {
                const side = Math.max(newWidth, newHeight);
                newWidth = side;
                newHeight = side;
            }
            
            const finalDimensions = {
                width: Math.max(newWidth, 50),
                height: Math.max(newHeight, 50)
            };

            lastDimensions.current = finalDimensions;
            onUpdateNodeData(id, finalDimensions, false);
        };

        const stopDrag = () => {
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
            if(lastDimensions.current) {
                onUpdateNodeData(id, lastDimensions.current, true);
            }
        };

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);
    };
    
    // 1. VISUAL LAYER: The colored shape
    const getShapeStyle = () => {
        const baseStyle = {
            backgroundColor: color,
            opacity: opacity,
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            border: `${borderWidth}px ${borderStyle} ${selected ? 'var(--accent-primary)' : borderColor}`,
            boxSizing: 'border-box', 
            // Shape stays in the background
            zIndex: 0, 
        };

        switch(shape) {
            case 'circle': 
                return { ...baseStyle, borderRadius: '50%' };
            case 'triangle':
                return { 
                    ...baseStyle,
                    clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                    borderRadius: '0px' 
                };
            default: // Rounded Rectangle
                return { ...baseStyle, borderRadius: '8px' };
        }
    }

    const isTriangle = shape === 'triangle';

    // 2. CONTAINER: The main wrapper
    const containerStyle = {
        width: `${width}px`,
        height: `${height}px`,
        transform: supportsRotation ? `rotate(${rotation}deg)` : 'none',
        position: 'relative',
        display: 'flex',
        justifyContent: isTriangle ? 'center' : 'flex-start',
        alignItems: 'flex-start',
    };

    // 3. LABEL CONTAINER
    const labelContainerStyle = {
        // Ensure label is above the shape
        zIndex: 10, 
        width: '100%',
        paddingTop: isTriangle ? `${height * 0.1}px` : '0px',
        paddingLeft: isTriangle ? '0' : '5px',
        paddingRight: '5px',
        // Slight offset so it's not glued to the very top border
        marginTop: '10px', 
        textAlign: isTriangle ? 'center' : 'left',
        pointerEvents: 'none', // Allow clicking "through" empty space around text to drag node
    };

    // Styles to remove the white box look
    const textStyle = {
        pointerEvents: 'auto', // Re-enable clicking on the text itself
        background: 'transparent', // REMOVE WHITE BACKGROUND
        padding: '2px 5px',
    };

    return (
        <div ref={nodeRef} className="group-node" style={containerStyle}>
            
            {/* Visual Shape */}
            <div className="group-node-shape" style={getShapeStyle()} />

            {/* Label */}
            <div style={labelContainerStyle}>
                {isEditing ? (
                    <input
                        type="text"
                        value={labelText}
                        onChange={handleLabelChange}
                        onBlur={handleLabelUpdate}
                        onKeyDown={handleInputKeyDown}
                        className="group-label-input nodrag"
                        autoFocus
                        style={{ ...textStyle, width: '90%' }} // Input matches text style
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    // We manually apply textStyle here to override the .group-label CSS class background
                    <div 
                        className="group-label" 
                        style={textStyle} 
                        onDoubleClick={handleLabelDoubleClick}
                    >
                        {label}
                    </div>
                )}
            </div>

            {/* Controls */}
            {selected && supportsRotation && (
                <div 
                    className="group-rotator nodrag" 
                    onMouseDown={onRotateStart}
                    style={{ position: 'absolute', top: -25, right: -25, cursor: 'grab', padding: 5, zIndex: 20 }}
                >
                    <RotateIcon />
                </div>
            )}

            <div 
                className="group-resizer nodrag" 
                onMouseDown={onResizeStart}
                style={{ zIndex: 20 }}
            >
                <ResizerIcon />
            </div>
        </div>
    );
});