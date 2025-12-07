// frontend/src/services/mapExportService.js
import { toBlob } from 'html-to-image';
import { generateCactiConfig } from './configGenerator';
import { createMap, getConfigTemplate } from './apiService';
import { ICONS_BY_THEME, NODE_WIDTH, NODE_HEIGHT } from '../config/constants';

/**
 * Prepares nodes for a clean export by applying specific styles.
 * @param {Array} nodes - The original array of nodes.
 * @param {string} theme - The current theme ('light' or 'dark').
 * @returns {{exportNodes: Array}} An object containing stylized nodes.
 */
const prepareElementsForExport = (nodes, theme) => {
    const exportNodes = nodes.map(node => {
        const exportNode = {
            ...node,
            selected: false,
            className: 'export-node', // Add a universal class for export styling
        };

        // Force theme-specific visuals for elements not controlled by CSS overrides (like image src)
        if (node.type === 'custom') {
            exportNode.data = {
                ...node.data,
                icon: ICONS_BY_THEME[node.data.iconType][theme],
            };
        } else if (node.type === 'group' && theme === 'light') {
            // Ensure group color isn't pure white or too light to be seen on the light background
            const lightColors = ['#ffffff', '#fff3cd', '#e9ecef'];
            if (lightColors.includes(node.data.color?.toLowerCase())) {
                 exportNode.data = {
                    ...node.data,
                    color: '#cfe2ff', // A safe, visible light blue
                };
            }
        }

        return exportNode;
    });

    // Edges are not styled because they will not be rendered on the PNG.
    return { exportNodes };
};

/**
 * Calculates the exact bounding box of all nodes and the transform to position content for capture.
 * Ensures the final output is at least Full HD (1920x1080).
 * @param {Array} nodes - The array of all nodes on the map.
 * @returns {{width: number, height: number, transform: string, minX: number, minY: number, padding: number}}
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

    // Determine the final canvas size, ensuring it's at least HD resolution.
    const finalWidth = Math.max(contentWidth + padding * 2, MIN_WIDTH);
    const finalHeight = Math.max(contentHeight + padding * 2, MIN_HEIGHT);

    // Calculate offsets to center the content within the (potentially larger) canvas.
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
 * Captures the map view, generates a config, and uploads both to start a Cacti task.
 * @param {object} params - The export parameters.
 * @returns {Promise<object>} The API response from starting the task.
 */
export const exportAndUploadMap = async ({ mapElement, nodes, edges, mapName, cactiGroupId, theme, scaleFactor, backgroundImageUrl }) => {
    const viewport = mapElement.querySelector('.react-flow__viewport');
    if (!viewport) {
        throw new Error('Could not find map viewport for export.');
    }

    const { transform, width, height, minX, minY } = calculateBoundsAndTransform(nodes);
    const originalTransform = viewport.style.transform;
    viewport.style.transform = transform; 

    // If a custom image is provided, we set background to null so the CSS style takes over.
    // Otherwise, we use the theme color.
    const backgroundColor = backgroundImageUrl ? null : (theme === 'dark' ? '#18191a' : '#ffffff');

    try {
        const blob = await toBlob(viewport, {
            width: width,
            height: height,
            backgroundColor: backgroundColor,
            // If backgroundImageUrl exists, inject CSS to display it
            style: backgroundImageUrl ? {
                backgroundImage: `url(${backgroundImageUrl})`,
                backgroundSize: '100% 100%', // Stretch to fit the calculated map bounds
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            } : {},
            filter: (node) => (node.className !== 'react-flow__controls'),
        });

        if (!blob) {
            throw new Error('Failed to create image blob.');
        }
        
        // Fetch the configuration template from the backend.
        const templateResponse = await getConfigTemplate();
        const configTemplate = templateResponse.data;

        // Calculate the offsets needed to center the content in the final image.
        const contentWidth = (nodes.reduce((max, n) => Math.max(max, n.position.x + (n.type === 'group' ? n.data.width : NODE_WIDTH)), 0) - minX);
        const contentHeight = (nodes.reduce((max, n) => Math.max(max, n.position.y + (n.type === 'group' ? n.data.height : NODE_HEIGHT)), 0) - minY);
        const offsetX = (width - contentWidth) / 2;
        const offsetY = (height - contentHeight) / 2;

        // Create a new set of nodes with their positions transformed into the coordinate
        // system of the final PNG image, including the centering offset.
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
            configTemplate, // Pass the fetched template
        });
        
        const formData = new FormData();
        formData.append('map_image', blob, `${mapName}.png`);
        formData.append('config_content', configContent);
        formData.append('map_name', mapName);
        formData.append('cacti_group_id', cactiGroupId);

        return await createMap(formData);

    } finally {
        viewport.style.transform = originalTransform;
    }
};

/**
 * A wrapper function that handles the entire map upload process, returning a task ID.
 * @param {object} params - The export parameters, plus state setters.
 * @returns {Promise<string>} A promise that resolves with the task ID.
 */
export const handleUploadProcess = async ({ mapElement, nodes, edges, mapName, cactiGroupId, theme, setNodes, setEdges, backgroundImageUrl }) => {
    const originalNodes = [...nodes];
    const originalEdges = [...edges];

    // Filter out preview elements before preparing for export.
    const finalNodes = nodes.filter(n => !n.data?.isPreview);
    const finalEdges = edges.filter(e => !e.data?.isPreview);

    // Prepare NON-PREVIEW nodes for export styling, passing the current theme.
    const { exportNodes } = prepareElementsForExport(finalNodes, theme);
    
    // Set component state to render only the stylized nodes and NO edges for the screenshot.
    setNodes(exportNodes);
    setEdges([]);
    
    mapElement.classList.add('exporting');

    // Get the device pixel ratio, which accounts for browser zoom and OS scaling.
    const scaleFactor = window.devicePixelRatio;

    // Wait for React to re-render the component.
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
        // Perform the export and get the initial task response.
        const response = await exportAndUploadMap({ 
            mapElement, 
            nodes: exportNodes, 
            edges: finalEdges, 
            mapName, 
            cactiGroupId, 
            theme, 
            scaleFactor,
            backgroundImageUrl // Pass the image URL down
        });
        return response.data;
    } finally {
        // Restore the UI to its original state.
        mapElement.classList.remove('exporting');
        setNodes(originalNodes);
        setEdges(originalEdges);
    }
};