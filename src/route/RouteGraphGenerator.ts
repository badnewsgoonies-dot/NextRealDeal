/*
 * RouteGraphGenerator: Helper for generating Slay the Spire-style route graphs.
 * 
 * Separated from RouteManager to maintain single responsibility and file size limits.
 */

import type { IRng } from '../util/Rng.js';
import type {
  NodeType,
  RouteNode,
  RouteGraph,
  RouteVisualization,
  RewardPreview,
} from '../types/contracts.js';
import { ok, err, type Result } from '../util/Result.js';

/**
 * Generate a complete route graph
 */
export function generateRouteGraph(rng: IRng, seed: number): Result<RouteGraph, string> {
  try {
    const graphRng = rng.fork(`graph:${seed}`);
    const layers = generateLayers(graphRng);
    const nodes = flattenNodes(layers);
    const connections = generateConnections(layers, graphRng);
    
    const graph: RouteGraph = {
      nodes,
      connections,
      startNode: nodes[0]?.id || '',
      endNode: nodes[nodes.length - 1]?.id || '',
      layers: layers.map(layer => layer.map(node => node.id)),
    };

    return ok(graph);
  } catch (error) {
    return err(`graph-generation-failed: ${String(error)}`);
  }
}

/**
 * Generate route visualization data
 */
export function getRouteVisualization(graph: RouteGraph): Result<RouteVisualization, string> {
  try {
    const bounds = calculateBounds(graph);
    const nodePositions = calculateNodePositions(graph);
    const connections = calculateConnectionPaths(graph, nodePositions);
    const svgPath = generateSVGPath(connections);

    const visualization: RouteVisualization = {
      svgPath,
      nodePositions,
      connections,
      bounds,
    };

    return ok(visualization);
  } catch (error) {
    return err(`visualization-failed: ${String(error)}`);
  }
}

/**
 * Determine node type based on layer position
 */
export function determineNodeType(layerIndex: number, totalLayers: number, rng: IRng): NodeType {
  if (layerIndex === 0) return 'battle';
  if (layerIndex === totalLayers - 1) return 'boss';
  
  const rand = rng.float();
  if (rand < 0.4) return 'battle';
  if (rand < 0.6) return 'elite_battle';
  if (rand < 0.8) return 'rest_site';
  if (rand < 0.9) return 'shop';
  return 'event';
}

/**
 * Calculate difficulty scaling
 */
export function calculateDifficulty(layerIndex: number, _totalLayers: number): number {
  const baseDifficulty = 1;
  const layerBonus = layerIndex * 0.5;
  const scalingFactor = Math.pow(1.2, layerIndex);
  return Math.round((baseDifficulty + layerBonus) * scalingFactor);
}

/**
 * Generate reward preview based on node type
 */
export function generateRewardPreview(nodeType: NodeType, layerIndex: number, rng: IRng): RewardPreview {
  const baseGold = 50 + (layerIndex * 25);
  const baseExp = 10 + (layerIndex * 5);
  
  let gold = baseGold;
  let exp = baseExp;
  let items: string[] = [];
  
  switch (nodeType) {
    case 'elite_battle':
      gold = Math.round(baseGold * 1.5);
      exp = Math.round(baseExp * 1.5);
      items = rng.float() < 0.3 ? ['rare_item'] : [];
      break;
    case 'shop':
      gold = Math.round(baseGold * 0.8);
      items = ['shop_access'];
      break;
    case 'rest_site':
      gold = Math.round(baseGold * 0.5);
      items = ['heal_potion'];
      break;
    case 'event':
      gold = Math.round(baseGold * 1.2);
      exp = Math.round(baseExp * 1.2);
      items = rng.float() < 0.4 ? ['mystery_item'] : [];
      break;
    case 'boss':
      gold = Math.round(baseGold * 2);
      exp = Math.round(baseExp * 2);
      items = ['legendary_item'];
      break;
  }
  
  return { gold, items, experience: exp };
}

/**
 * Generate node description text
 */
export function generateNodeDescription(nodeType: NodeType): string {
  const descriptions: Record<NodeType, string> = {
    battle: 'A challenging encounter awaits',
    elite_battle: 'A powerful enemy blocks your path',
    rest_site: 'A safe haven to rest and recover',
    shop: 'A merchant offers goods for sale',
    event: 'An unexpected event unfolds',
    boss: 'The final challenge approaches',
  };
  
  return descriptions[nodeType];
}

// ========================================
// Internal Helper Functions
// ========================================

function generateLayers(rng: IRng): RouteNode[][] {
  const layerCount = rng.int(3, 6);
  const layers: RouteNode[][] = [];
  
  for (let i = 0; i < layerCount; i++) {
    const nodeCount = i === 0 || i === layerCount - 1 ? 1 : rng.int(2, 4);
    const layer: RouteNode[] = [];
    
    for (let j = 0; j < nodeCount; j++) {
      const nodeType = determineNodeType(i, layerCount, rng);
      const node: RouteNode = {
        id: `layer${i}_node${j}`,
        type: nodeType,
        position: { x: i * 200, y: j * 150 },
        connections: [],
        difficulty: calculateDifficulty(i, layerCount),
        rewards: generateRewardPreview(nodeType, i, rng),
        description: generateNodeDescription(nodeType),
      };
      layer.push(node);
    }
    
    layers.push(layer);
  }
  
  return layers;
}

function flattenNodes(layers: RouteNode[][]): RouteNode[] {
  const allNodes: RouteNode[] = [];
  
  for (const layer of layers) {
    for (const node of layer) {
      allNodes.push(node);
    }
  }
  
  return allNodes;
}

function generateConnections(layers: RouteNode[][], rng: IRng): { from: string; to: string }[] {
  const connections: { from: string; to: string }[] = [];
  
  for (let i = 0; i < layers.length - 1; i++) {
    const currentLayer = layers[i];
    const nextLayer = layers[i + 1];
    
    for (const fromNode of currentLayer) {
      const connectionCount = rng.int(1, Math.min(3, nextLayer.length));
      const connectedIndices = new Set<number>();
      
      for (let j = 0; j < connectionCount; j++) {
        let targetIndex: number;
        do {
          targetIndex = rng.int(0, nextLayer.length - 1);
        } while (connectedIndices.has(targetIndex));
        
        connectedIndices.add(targetIndex);
        const toNode = nextLayer[targetIndex];
        
        connections.push({ from: fromNode.id, to: toNode.id });
      }
    }
  }
  
  return connections;
}

function calculateBounds(graph: RouteGraph): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  
  for (const node of graph.nodes) {
    maxX = Math.max(maxX, node.position.x);
    maxY = Math.max(maxY, node.position.y);
  }
  
  return { width: maxX + 100, height: maxY + 100 };
}

function calculateNodePositions(graph: RouteGraph): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  
  for (const node of graph.nodes) {
    positions[node.id] = {
      x: node.position.x,
      y: node.position.y,
    };
  }
  
  return positions;
}

function calculateConnectionPaths(
  graph: RouteGraph, 
  nodePositions: Record<string, { x: number; y: number }>
): { from: string; to: string; path: string }[] {
  return graph.connections.map(conn => {
    const fromPos = nodePositions[conn.from];
    const toPos = nodePositions[conn.to];
    
    if (!fromPos || !toPos) {
      return { from: conn.from, to: conn.to, path: '' };
    }
    
    const path = `M ${fromPos.x} ${fromPos.y} L ${toPos.x} ${toPos.y}`;
    return { from: conn.from, to: conn.to, path };
  });
}

function generateSVGPath(connections: { from: string; to: string; path: string }[]): string {
  return connections.map(conn => conn.path).join(' ');
}
