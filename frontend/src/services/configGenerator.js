// frontend/src/services/configGenerator.js
import { NODE_WIDTH, NODE_HEIGHT } from '../config/constants';

const CONFIG_X_OFFSET = 0;
const CONFIG_Y_OFFSET = 0;
const DUMMY_NODE_TEMPLATE = "NODE {id}\n\tPOSITION {x} {y}";

export function generateCactiConfig({ nodes, edges, mapName, mapWidth, mapHeight, scaleFactor, configTemplate }) {
  const deviceNodes = nodes.filter(node => node.type !== 'group');
  const nodeStrings = [];
  const linkStrings = [];

  const nodeInfoMap = new Map(deviceNodes.map(node => [node.id, node]));
  let nodeCounter = 1;

  const edgeGroups = new Map();
  for (const edge of edges) {
      const key = [edge.source, edge.target].sort().join('-');
      if (!edgeGroups.has(key)) {
          edgeGroups.set(key, []);
      }
      edgeGroups.get(key).push(edge);
  }

  const LINK_ENDPOINT_OFFSET = 70;
  const PARALLEL_LINK_OFFSET = 15;

  for (const [key, edgeGroup] of edgeGroups.entries()) {
    const [nodeA_id, nodeB_id] = key.split('-'); 

    const forwardEdges = edgeGroup.filter(e => e.source === nodeA_id);
    const reverseEdges = edgeGroup.filter(e => e.source === nodeB_id);
    
    const edgesToProcess = forwardEdges.length >= reverseEdges.length ? forwardEdges : reverseEdges;

    const totalEdgesInGroup = edgesToProcess.length;
    let initialOffset = -PARALLEL_LINK_OFFSET * (totalEdgesInGroup - 1) / 2;

    for (let i = 0; i < totalEdgesInGroup; i++) {
      const edge = edgesToProcess[i];
      const sourceNodeInfo = nodeInfoMap.get(edge.source);
      const targetNodeInfo = nodeInfoMap.get(edge.target);

      if (!sourceNodeInfo || !targetNodeInfo) continue;

      const sourceCenterX = sourceNodeInfo.position.x + (NODE_WIDTH / 2);
      const sourceCenterY = sourceNodeInfo.position.y + (NODE_HEIGHT / 2);
      const targetCenterX = targetNodeInfo.position.x + (NODE_WIDTH / 2);
      const targetCenterY = targetNodeInfo.position.y + (NODE_HEIGHT / 2);

      const dx = targetCenterX - sourceCenterX;
      const dy = targetCenterY - sourceCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance === 0) continue;

      const ux = dx / distance;
      const uy = dy / distance;
      const px = -uy;
      const py = ux;

      const currentOffset = initialOffset + i * PARALLEL_LINK_OFFSET;

      const offsetX = px * currentOffset;
      const offsetY = py * currentOffset;
      
      const offsetSourceCenterX = sourceCenterX + offsetX;
      const offsetSourceCenterY = sourceCenterY + offsetY;
      const offsetTargetCenterX = targetCenterX + offsetX;
      const offsetTargetCenterY = targetCenterY + offsetY;

      const dummy1_x = Math.round((offsetSourceCenterX + ux * LINK_ENDPOINT_OFFSET) * scaleFactor) + CONFIG_X_OFFSET;
      const dummy1_y = Math.round((offsetSourceCenterY + uy * LINK_ENDPOINT_OFFSET) * scaleFactor) + CONFIG_Y_OFFSET;
      const dummy2_x = Math.round((offsetTargetCenterX - ux * LINK_ENDPOINT_OFFSET) * scaleFactor) + CONFIG_X_OFFSET;
      const dummy2_y = Math.round((offsetTargetCenterY - uy * LINK_ENDPOINT_OFFSET) * scaleFactor) + CONFIG_Y_OFFSET;

      const dummy1_id = `node${String(nodeCounter++).padStart(5, '0')}`;
      const dummy2_id = `node${String(nodeCounter++).padStart(5, '0')}`;

      nodeStrings.push(DUMMY_NODE_TEMPLATE.replace('{id}', dummy1_id).replace('{x}', dummy1_x).replace('{y}', dummy1_y));
      nodeStrings.push(DUMMY_NODE_TEMPLATE.replace('{id}', dummy2_id).replace('{x}', dummy2_x).replace('{y}', dummy2_y));
      
      const interfaceName = edge.data?.interface || 'unknown';
      const populatedLink = `LINK ${dummy1_id}-${dummy2_id}
\tNODES ${dummy1_id} ${dummy2_id}
\tDEVICE ${sourceNodeInfo.data.hostname} ${sourceNodeInfo.data.ip}
\tINTERFACE ${interfaceName}
\tBANDWIDTH ${edge.data.bandwidth || '1G'}`;

      linkStrings.push(populatedLink);
    }
  }
  
  // --- FINAL CONFIG ASSEMBLY ---
  let finalConfig = configTemplate;

  // 1. Create the BACKGROUND command
  // This tells Cacti to look for the image file named "{mapName}.png"
  const backgroundCommand = `BACKGROUND ${mapName}.png`;

  // 2. Prepend it to the template (Global Config section)
  finalConfig = `${backgroundCommand}\n${finalConfig}`;

  // 3. Perform Standard Replacements
  finalConfig = finalConfig.replace(/%name%/g, mapName);
  finalConfig = finalConfig.replace('%width%', mapWidth);
  finalConfig = finalConfig.replace('%height%', mapHeight);
  finalConfig = finalConfig.replace('%nodes%', nodeStrings.join('\n\n'));
  finalConfig = finalConfig.replace('%links%', linkStrings.join('\n\n'));

  return finalConfig.trim();
}