// マップ・グリッド操作（移動範囲・距離計算）

function buildTerrainGrid(map) {
  const grid = [];
  for (let y = 0; y < map.height; y++) {
    const row = [];
    for (let x = 0; x < map.width; x++) {
      row.push(getTerrainAt(map, x, y));
    }
    grid.push(row);
  }
  return grid;
}

function inBounds(map, x, y) {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function unitAt(units, x, y) {
  return units.find(u => isAlive(u) && u.x === x && u.y === y) || null;
}

// 移動可能範囲をBFSで計算。戻り値は "x,y" -> コスト の Map
function computeReachable(unit, map, terrainGrid, units) {
  const maxCost = unit.stats.move;
  const visited = new Map();
  const startKey = unit.x + ',' + unit.y;
  visited.set(startKey, 0);
  const queue = [{ x: unit.x, y: unit.y, cost: 0 }];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (queue.length > 0) {
    const cur = queue.shift();
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const terrain = terrainGrid[ny][nx];
      const terrainDef = TERRAIN[terrain];
      if (terrainDef.impassable) continue;
      const occupant = unitAt(units, nx, ny);
      if (occupant && occupant.id !== unit.id) continue;
      const newCost = cur.cost + terrainDef.moveCost;
      if (newCost > maxCost) continue;
      const key = nx + ',' + ny;
      if (visited.has(key) && visited.get(key) <= newCost) continue;
      visited.set(key, newCost);
      queue.push({ x: nx, y: ny, cost: newCost });
    }
  }
  return visited;
}

// originから武器の射程内にあるタイル一覧（マンハッタン距離ベース、障害物は無視）
function tilesInRange(map, originX, originY, range) {
  const [min, max] = range;
  const result = [];
  for (let dy = -max; dy <= max; dy++) {
    for (let dx = -max; dx <= max; dx++) {
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < min || dist > max) continue;
      const nx = originX + dx, ny = originY + dy;
      if (!inBounds(map, nx, ny)) continue;
      result.push({ x: nx, y: ny, dist: dist });
    }
  }
  return result;
}
