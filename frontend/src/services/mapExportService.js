import { toBlob } from 'html-to-image';
import { generateCactiConfig } from './configGenerator';
import { createMap, getConfigTemplate } from './apiService';

const BACKGROUND_WIDTH = 1920;
const BACKGROUND_HEIGHT = 1080;

// Helper: Convert Blob URL to Base64
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

// Helper: Load Image
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
 * Gets the current visual alignment of the Viewport relative to the Background.
 * Keeps the "Good Placement" logic.
 */
const getVisualAlignment = (mapElement) => {
    const viewportEl = mapElement.querySelector('.react-flow__viewport');
    if (!viewportEl) throw new Error('Viewport not found');

    const mapRect = mapElement.getBoundingClientRect();
    const viewportRect = viewportEl.getBoundingClientRect();

    // Calculate where the 1920x1080 background is sitting on screen
    const bgScreenLeft = mapRect.left + (mapRect.width - BACKGROUND_WIDTH) / 2;
    const bgScreenTop = mapRect.top + (mapRect.height - BACKGROUND_HEIGHT) / 2;

    // Calculate offset of nodes relative to background
    const tx = viewportRect.left - bgScreenLeft;
    const ty = viewportRect.top - bgScreenTop;

    // Get Zoom Level
    const style = window.getComputedStyle(viewportEl);
    const matrix = new DOMMatrixReadOnly(style.transform);
    const scale = matrix.a;

    return { viewportEl, tx, ty, scale };
};

/**
 * Composites the nodes onto the background image.
 */
const combineBackgroundAndMap = async (nodesBlob, backgroundUrl) => {
    const canvas = document.createElement('canvas');
    canvas.width = BACKGROUND_WIDTH;
    canvas.height = BACKGROUND_HEIGHT;
    const ctx = canvas.getContext('2d');

    // 1. Fill White
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, BACKGROUND_WIDTH, BACKGROUND_HEIGHT);

    // 2. Draw Background Image
    try {
        if (backgroundUrl) {
            const base64Bg = await blobToDataURL(backgroundUrl);
            if (base64Bg) {
                const bgImg = await loadImage(base64Bg);
                ctx.drawImage(bgImg, 0, 0, BACKGROUND_WIDTH, BACKGROUND_HEIGHT);
            }
        }
    } catch (err) {
        console.error("Error drawing background:", err);
    }

    // 3. Draw Nodes/Edges
    try {
        if (nodesBlob) {
            const mapUrl = URL.createObjectURL(nodesBlob);
            const mapImg = await loadImage(mapUrl);
            ctx.drawImage(mapImg, 0, 0);
            URL.revokeObjectURL(mapUrl);
        }
    } catch (err) {
        console.error("Error drawing nodes:", err);
    }

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
};

export const exportAndUploadMap = async ({
    mapElement,
    nodes,
    edges,
    mapName,
    cactiGroupId,
    theme,
    backgroundImageUrl
}) => {
    
    // STEP 1: Calculate Visual Alignment
    const { viewportEl, tx, ty, scale } = getVisualAlignment(mapElement);

    // FIX FOR "BLACK LINKS":
    // We manually set the fill of SVG paths to 'none' before capturing.
    // We do NOT change the stroke color, so your original link colors are preserved.
    const originalFills = [];
    const svgPaths = viewportEl.querySelectorAll('.react-flow__edge-path');
    
    svgPaths.forEach((path, index) => {
        originalFills[index] = path.style.fill; // Save original
        path.style.fill = 'none'; // Force no fill to prevent black blobs
    });

    try {
        // STEP 2: Snapshot Viewport
        const nodesBlob = await toBlob(viewportEl, {
            backgroundColor: 'rgba(0,0,0,0)', 
            width: BACKGROUND_WIDTH,
            height: BACKGROUND_HEIGHT,
            style: {
                // Apply the visual alignment transform
                transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
                transformOrigin: 'top left',
                width: `${BACKGROUND_WIDTH}px`,
                height: `${BACKGROUND_HEIGHT}px`,
                background: 'transparent',
                'fill': 'none' // Extra safety for SVG
            },
            // Filter out controls/minimap
            filter: node => node.classList && !node.classList.contains('react-flow__controls') && !node.classList.contains('react-flow__minimap'),
        });

        // Restore original fills immediately (just in case)
        svgPaths.forEach((path, index) => {
            path.style.fill = originalFills[index];
        });

        // STEP 3: Combine
        const finalMapBlob = await combineBackgroundAndMap(nodesBlob, backgroundImageUrl);

        // STEP 4: Generate Config
        const templateResponse = await getConfigTemplate();
        
        // Calculate Cacti Positions based on Visual Alignment
        const nodesForConfig = nodes.map(node => ({
            ...node,
            position: {
                x: node.position.x * scale + tx,
                y: node.position.y * scale + ty,
            },
            width: (node.width || 50) * scale,
            height: (node.height || 50) * scale
        }));

        const configContent = generateCactiConfig({
            nodes: nodesForConfig,
            edges,
            mapName,
            mapWidth: BACKGROUND_WIDTH,
            mapHeight: BACKGROUND_HEIGHT,
            scaleFactor: 1, 
            configTemplate: templateResponse.data,
        });

        const formData = new FormData();
        formData.append('map_image', finalMapBlob, `${mapName}.png`);
        formData.append('config_content', configContent);
        formData.append('map_name', mapName);
        formData.append('cacti_group_id', cactiGroupId);

        return await createMap(formData);

    } catch (error) {
        // Restore styles if error occurs
        svgPaths.forEach((path, index) => {
            path.style.fill = originalFills[index];
        });
        console.error("Export failed:", error);
        throw error;
    }
};

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
    // FIX: Simplified Preparation
    // We only remove the "selected" state so blue borders don't appear in the image.
    // We do NOT change colors, icons, or classes, preserving your Names and Links.
    const exportNodes = nodes.map(n => ({
        ...n,
        selected: false,
        // Ensure handles (dots on nodes) are hidden if your CSS hides them when not selected
    }));
    
    const exportEdges = edges.map(e => ({
        ...e,
        selected: false
    }));

    // 2. Temporarily apply clean state
    const originalNodes = [...nodes];
    const originalEdges = [...edges];
    
    setNodes(exportNodes);
    setEdges(exportEdges);
    
    // 3. Short delay to allow React to remove selection borders
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        const response = await exportAndUploadMap({
            mapElement,
            nodes: exportNodes,
            edges: exportEdges,
            mapName,
            cactiGroupId,
            theme,
            backgroundImageUrl
        });
        return response.data;
    } finally {
        // 4. Restore original state (selection comes back)
        setNodes(originalNodes);
        setEdges(originalEdges);
    }
};