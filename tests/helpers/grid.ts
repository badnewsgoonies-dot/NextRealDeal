/*
 * Test helper utilities for grid/map operations.
 * Provides BFS connectivity checking and other grid utilities.
 */

export type Tile = { x: number; y: number; t: number };
export type MapData = { width: number; height: number; tiles: Tile[] };

/**
 * Check if a tile type is walkable
 * Walkable: 0=floor, 3=door, 4=spawn, 5=exit
 * Impassable: 1=wall, 2=water
 */
export const isWalkable = (t: number): boolean => 
  t === 0 || t === 3 || t === 4 || t === 5;

/**
 * Get tile index in tiles array for position (x, y)
 */
const index = (m: MapData, x: number, y: number): number => 
  y * m.width + x;

/**
 * Get 4-directional neighbors
 */
const neighbors = (x: number, y: number): [number, number][] => 
  [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];

/**
 * Perform BFS from (sx, sy) and return set of reachable tile indices.
 * Only traverses walkable tiles.
 */
export function bfsReachable(m: MapData, sx: number, sy: number): Set<number> {
  const seen = new Set<number>();
  const q: [number, number][] = [[sx, sy]];
  
  while (q.length > 0) {
    const [x, y] = q.shift()!;
    const i = index(m, x, y);
    
    if (seen.has(i)) continue;
    seen.add(i);
    
    for (const [nx, ny] of neighbors(x, y)) {
      if (nx >= 0 && ny >= 0 && nx < m.width && ny < m.height) {
        const tile = m.tiles.find(t => t.x === nx && t.y === ny);
        if (tile && isWalkable(tile.t) && !seen.has(index(m, nx, ny))) {
          q.push([nx, ny]);
        }
      }
    }
  }
  
  return seen;
}

/**
 * Check if all walkable tiles in the map are connected.
 * Returns true if there's a path from spawn to all other walkable tiles.
 */
export function isFullyConnected(m: MapData): boolean {
  const spawn = m.tiles.find(t => t.t === 4);
  if (!spawn) return false;
  
  const reachable = bfsReachable(m, spawn.x, spawn.y);
  const walkableTiles = m.tiles.filter(t => isWalkable(t.t));
  
  return walkableTiles.every(t => reachable.has(index(m, t.x, t.y)));
}

/**
 * Count tiles of a specific type
 */
export function countTileType(m: MapData, tileType: number): number {
  return m.tiles.filter(t => t.t === tileType).length;
}

/**
 * Check if border tiles are all walls
 */
export function hasBorderWalls(m: MapData): boolean {
  for (let x = 0; x < m.width; x++) {
    const topTile = m.tiles.find(t => t.x === x && t.y === 0);
    const bottomTile = m.tiles.find(t => t.x === x && t.y === m.height - 1);
    if (topTile?.t !== 1 || bottomTile?.t !== 1) return false;
  }
  
  for (let y = 0; y < m.height; y++) {
    const leftTile = m.tiles.find(t => t.x === 0 && t.y === y);
    const rightTile = m.tiles.find(t => t.x === m.width - 1 && t.y === y);
    if (leftTile?.t !== 1 || rightTile?.t !== 1) return false;
  }
  
  return true;
}

