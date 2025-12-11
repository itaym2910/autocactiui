import { toBlob } from 'html-to-image';
import { generateCactiConfig } from './configGenerator';
import { createMap, getConfigTemplate } from './apiService';
import { ICONS_BY_THEME, NODE_WIDTH, NODE_HEIGHT } from '../config/constants';

const BACKGROUND_WIDTH = 1920;
const BACKGROUND_HEIGHT = 1080;

/**
 * Prepares nodes for a clean export by applying specific styles.
 */
const prepareElementsForExport = (nodes, theme) => {
    const exportNodes = nodes.map(node => {
        const exportNode = {
            ...node,
            selected: false,
            className: 'export-node',
        };

        if (node.type === 'custom') {
            exportNode.data = {
                ...node.data,
                icon: ICONS_BY_THEME[node.data.iconType][theme],
            };
        } else if (node.type === 'group' && theme === 'light') {
            const lightColors = ['#ffffff', '#fff3cd', '#e9ecef'];
            if (lightColors.includes(node.data.color?.toLowerCase())) {
                exportNode.data = {
                    ...node.data,
                    color: '#cfe2ff',
                };
            }
        }

        return exportNode;
    });

    return { exportNodes };
};

/**
 * Calculates bounding box and transform - keeps original logic
 */
const calculateBoundsAndTransform = (nodes) => {
    const padding = 50;
    const MIN_WIDTH = 1920;
    const MIN_HEIGHT = 1080;

    if (nodes.length === 0) {
        return { width: MIN_WIDTH, height: MIN_HEIGHT, transform: 'translate(0,0)', minX: 0, minY: 0, padding };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
        const nodeWidth = node.type === 'group' ? node.data.width : NODE_WIDTH;
        const nodeHeight = node.type === 'group' ? node.data.height : NODE_HEIGHT;

        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + nodeWidth);
        maxY = Math.max(maxY, node.position.y + nodeHeight);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const finalWidth = Math.max(contentWidth + padding * 2, MIN_WIDTH);
    const finalHeight = Math.max(contentHeight + padding * 2, MIN_HEIGHT);

    const offsetX = (finalWidth - contentWidth) / 2;
    const offsetY = (finalHeight - contentHeight) / 2;

    const transform = `translate(${-minX + offsetX}px, ${-minY + offsetY}px)`;

    return {
        width: finalWidth,
        height: finalHeight,
        transform: transform,
        minX,
        minY,
        padding
    };
};

/**
 * Helper: Convert Blob URL to Base64
 */
const blobToDataURL = async (blobUrl) => {
    try {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error converting blob to base64:", error);
        return null;
    }
};

/**
 * Helper: Load Image
 */
const loadImage = (src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = src;
    });
};

/**
 * Composites the nodes onto the background image if provided
 */
const combineBackgroundAndMap = async (nodesBlob, backgroundUrl, width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Fill with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Background Image if provided
    if (backgroundUrl) {
        try {
            const base64Bg = await blobToDataURL(backgroundUrl);
            if (base64Bg) {
                const bgImg = await loadImage(base64Bg);
                // Draw background centered and sized to match BACKGROUND_WIDTH x BACKGROUND_HEIGHT
                const bgX = (width - BACKGROUND_WIDTH) / 2;
                const bgY = (height - BACKGROUND_HEIGHT) / 2;
                ctx.drawImage(bgImg, bgX, bgY, BACKGROUND_WIDTH, BACKGROUND_HEIGHT);
            }
        } catch (err) {
            console.error("Error drawing background:", err);
        }
    }

    // 3. Draw Nodes/Edges on top
    if (nodesBlob) {
        try {
            const mapUrl = URL.createObjectURL(nodesBlob);
            const mapImg = await loadImage(mapUrl);
            ctx.drawImage(mapImg, 0, 0);
            URL.revokeObjectURL(mapUrl);
        } catch (err) {
            console.error("Error drawing nodes:", err);
        }
    }

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
};

/**
 * Captures the map view, generates a config, and uploads both to start a Cacti task.
 * NOW WITH BACKGROUND SUPPORT
 */
export const exportAndUploadMap = async ({ 
    mapElement, 
    nodes, 
    edges, 
    mapName, 
    cactiGroupId, 
    theme, 
    scaleFactor,
    backgroundImageUrl 
}) => {
    const viewport = mapElement.querySelector('.react-flow__viewport');
    if (!viewport) {
        throw new Error('Could not find map viewport for export.');
    }

    // Use original calculation logic
    const { transform, width, height, minX, minY } = calculateBoundsAndTransform(nodes);
    const originalTransform = viewport.style.transform;
    viewport.style.transform = transform;

    // Fix for black links - temporarily set fill to none
    const originalFills = [];
    const svgPaths = viewport.querySelectorAll('.react-flow__edge-path');
    svgPaths.forEach((path, index) => {
        originalFills[index] = path.style.fill;
        path.style.fill = 'none';
    });

    try {
        // Capture nodes with transparent background
        const nodesBlob = await toBlob(viewport, {
            width: width,
            height: height,
            backgroundColor: backgroundImageUrl ? 'rgba(0,0,0,0)' : (theme === 'dark' ? '#18191a' : '#ffffff'),
            filter: (node) => (node.className !== 'react-flow__controls' && node.className !== 'react-flow__minimap'),
        });

        if (!nodesBlob) {
            throw new Error('Failed to create image blob.');
        }

        // Restore fills
        svgPaths.forEach((path, index) => {
            path.style.fill = originalFills[index];
        });

        // Combine with background if provided
        const finalBlob = backgroundImageUrl 
            ? await combineBackgroundAndMap(nodesBlob, backgroundImageUrl, width, height)
            : nodesBlob;
        
        // Fetch the configuration template from the backend
        const templateResponse = await getConfigTemplate();
        const configTemplate = templateResponse.data;

        // Calculate offsets (original logic)
        const contentWidth = (nodes.reduce((max, n) => Math.max(max, n.position.x + (n.type === 'group' ? n.data.width : NODE_WIDTH)), 0) - minX);
        const contentHeight = (nodes.reduce((max, n) => Math.max(max, n.position.y + (n.type === 'group' ? n.data.height : NODE_HEIGHT)), 0) - minY);
        const offsetX = (width - contentWidth) / 2;
        const offsetY = (height - contentHeight) / 2;

        // Transform node positions for config (original logic)
        const nodesForConfig = nodes.map(node => ({
            ...node,
            position: {
                x: node.position.x - minX + offsetX,
                y: node.position.y - minY + offsetY,
            },
        }));
        
        const configContent = generateCactiConfig({
            nodes: nodesForConfig, 
            edges, 
            mapName, 
            mapWidth: width, 
            mapHeight: height,
            scaleFactor,
            configTemplate,
        });
        
        const formData = new FormData();
        formData.append('map_image', finalBlob, `${mapName}.png`);
        formData.append('config_content', configContent);
        formData.append('map_name', mapName);
        formData.append('cacti_group_id', cactiGroupId);

        return await createMap(formData);

    } catch (error) {
        // Restore fills on error
        svgPaths.forEach((path, index) => {
            path.style.fill = originalFills[index];
        });
        throw error;
    } finally {
        viewport.style.transform = originalTransform;
    }
};

/**
 * Wrapper function that handles the entire map upload process
 * NOW WITH BACKGROUND SUPPORT
 */
export const handleUploadProcess = async ({ 
    mapElement, 
    nodes, 
    edges, 
    mapName, 
    cactiGroupId, 
    theme, 
    setNodes, 
    setEdges,
    backgroundImageUrl 
}) => {
    const originalNodes = [...nodes];
    const originalEdges = [...edges];

    // Filter out preview elements
    const finalNodes = nodes.filter(n => !n.data?.isPreview);
    const finalEdges = edges.filter(e => !e.data?.isPreview);

    // Prepare for export styling
    const { exportNodes } = prepareElementsForExport(finalNodes, theme);
    
    // Set state for screenshot
    setNodes(exportNodes);
    setEdges([]);
    
    mapElement.classList.add('exporting');

    const scaleFactor = window.devicePixelRatio;

    // Wait for React to re-render
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
        const response = await exportAndUploadMap({ 
            mapElement, 
            nodes: exportNodes, 
            edges: finalEdges, 
            mapName, 
            cactiGroupId, 
            theme, 
            scaleFactor,
            backgroundImageUrl 
        });
        return response.data;
    } finally {
        // Restore UI
        mapElement.classList.remove('exporting');
        setNodes(originalNodes);
        setEdges(originalEdges);
    }
};