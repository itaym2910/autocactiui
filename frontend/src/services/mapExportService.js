import { toBlob } from 'html-to-image';
import { generateCactiConfig } from './configGenerator';
import { createMap, getConfigTemplate } from './apiService';
import { ICONS_BY_THEME, NODE_WIDTH, NODE_HEIGHT } from '../config/constants';

/**
 * Helper: Converts a Blob URL to a Base64 Data String.
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
 * Helper: Loads an image source into an HTML Image Object safely.
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
 * Helper: Smartly draws an image to COVER the canvas area.
 */
const drawImageProp = (ctx, img, x, y, w, h, offsetX, offsetY) => {
    offsetX = typeof offsetX === "number" ? offsetX : 0.5;
    offsetY = typeof offsetY === "number" ? offsetY : 0.5;

    if (offsetX < 0) offsetX = 0;
    if (offsetY < 0) offsetY = 0;
    if (offsetX > 1) offsetX = 1;
    if (offsetY > 1) offsetY = 1;

    var iw = img.width,
        ih = img.height;

    // Scale logic: Cover the area completely
    var scale = Math.max(w / iw, h / ih);
    
    var nw = iw * scale;
    var nh = ih * scale;

    const dx = (w - nw) * offsetX;
    const dy = (h - nh) * offsetY;

    ctx.drawImage(img, x + dx, y + dy, nw, nh);
};

/**
 * Combines the background and the map using Canvas Layering.
 */
const combineBackgroundAndMap = async (mapBlob, backgroundUrl, width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    try {
        if (backgroundUrl) {
            const base64Bg = await blobToDataURL(backgroundUrl);
            if (base64Bg) {
                const bgImg = await loadImage(base64Bg);
                // Draw background centered, cropping edges to fit the exact map size
                drawImageProp(ctx, bgImg, 0, 0, width, height, 0.5, 0.5);
            } else {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, width, height);
            }
        } else {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
        }
    } catch (err) {
        console.error("Error drawing background:", err);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
    }

    try {
        if (mapBlob) {
            const mapUrl = URL.createObjectURL(mapBlob);
            const mapImg = await loadImage(mapUrl);
            ctx.drawImage(mapImg, 0, 0);
            URL.revokeObjectURL(mapUrl);
        }
    } catch (err) {
        console.error("Error drawing map nodes:", err);
    }

    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
};

const prepareElementsForExport = (nodes, theme) => {
    const exportNodes = nodes.map(node => {
        const exportNode = { ...node, selected: false, className: 'export-node' };
        if (node.type === 'custom') {
            exportNode.data = { ...node.data, icon: ICONS_BY_THEME[node.data.iconType][theme] };
        } else if (node.type === 'group' && theme === 'light') {
            const lightColors = ['#ffffff', '#fff3cd', '#e9ecef'];
            if (lightColors.includes(node.data.color?.toLowerCase())) {
                exportNode.data = { ...node.data, color: '#cfe2ff' };
            }
        }
        return exportNode;
    });
    return { exportNodes };
};


const calculateBoundsAndTransform = (nodes) => {
    const padding = 50; 
    
    // === CHANGE: Removed 800px/600px limits ===
    // This allows the map to be tall and thin (like Israel) without adding side bars.
    const MIN_WIDTH = 100; 
    const MIN_HEIGHT = 100;

    if (nodes.length === 0) return { width: MIN_WIDTH, height: MIN_HEIGHT, transform: 'translate(0,0)', minX: 0, minY: 0 };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
        const w = node.type === 'group' ? node.data.width : NODE_WIDTH;
        const h = node.type === 'group' ? node.data.height : NODE_HEIGHT;

        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + w);
        maxY = Math.max(maxY, node.position.y + h);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const finalWidth = Math.max(contentWidth + padding * 2, MIN_WIDTH);
    const finalHeight = Math.max(contentHeight + padding * 2, MIN_HEIGHT);

    const offsetX = (finalWidth - contentWidth) / 2;
    const offsetY = (finalHeight - contentHeight) / 2;
    
    const transform = `translate(${-minX + offsetX}px, ${-minY + offsetY}px)`;

    return { width: finalWidth, height: finalHeight, transform, minX, minY };
};

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
    if (!viewport) throw new Error('Could not find map viewport for export.');

    const { transform, width, height, minX, minY } = calculateBoundsAndTransform(nodes);

    try {
        // STEP 1: Capture Nodes
        const nodesBlob = await toBlob(viewport, {
            width: width,
            height: height,
            style: {
                transform: transform,
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor: 'rgba(0,0,0,0)',
            },
            filter: node => node.className !== 'react-flow__controls',
        });

        // STEP 2: Combine Background
        const finalMapBlob = await combineBackgroundAndMap(nodesBlob, backgroundImageUrl, width, height);

        // STEP 3: Download Local Verification Copy
        const downloadUrl = URL.createObjectURL(finalMapBlob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `${mapName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        // STEP 4: Config & Upload
        const templateResponse = await getConfigTemplate();
        const configTemplate = templateResponse.data;

        const contentWidth = (nodes.reduce((max, n) =>
            Math.max(max, n.position.x + (n.type === 'group' ? n.data.width : NODE_WIDTH)), 0) - minX);
        const contentHeight = (nodes.reduce((max, n) =>
            Math.max(max, n.position.y + (n.type === 'group' ? n.data.height : NODE_HEIGHT)), 0) - minY);
            
        const offsetX = (width - contentWidth) / 2;
        const offsetY = (height - contentHeight) / 2;

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
        formData.append('map_image', finalMapBlob, `${mapName}.png`);
        formData.append('config_content', configContent);
        formData.append('map_name', mapName);
        formData.append('cacti_group_id', cactiGroupId);

        return await createMap(formData);

    } catch (error) {
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
    const originalNodes = [...nodes];
    const originalEdges = [...edges];

    const finalNodes = nodes.filter(n => !n.data?.isPreview);
    const finalEdges = edges.filter(e => !e.data?.isPreview);

    const { exportNodes } = prepareElementsForExport(finalNodes, theme);

    setNodes(exportNodes);
    setEdges([]);

    await new Promise(resolve => setTimeout(resolve, 200));

    try {
        const response = await exportAndUploadMap({
            mapElement,
            nodes: exportNodes,
            edges: finalEdges,
            mapName,
            cactiGroupId,
            theme,
            scaleFactor: 1,
            backgroundImageUrl
        });
        return response.data;
    } finally {
        setNodes(originalNodes);
        setEdges(originalEdges);
    }
};