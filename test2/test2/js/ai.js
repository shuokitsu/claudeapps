// 敵AI（敵フェーズの行動決定）

function findAttackOption(enemy, reachable, map, units) {
  const playerUnits = units.filter(u => u.team === 'player' && isAlive(u));
  const weapon = getEquippedWeapon(enemy);
  if (!weapon || weapon.type === 'staff') return null;

  let best = null;
  for (const [key, cost] of reachable.entries()) {
    const [tx, ty] = key.split(',').map(Number);
    for (const target of playerUnits) {
      const dist = manhattan(tx, ty, target.x, target.y);
      if (dist < weapon.range[0] || dist > weapon.range[1]) continue;
      const dmg = computeDamage(enemy, weapon, target);
      const score = dmg + (dmg >= target.hp ? 100 : 0);
      if (!best || score > best.score) {
        best = { x: tx, y: ty, target: target, score: score };
      }
    }
  }
  return best;
}

function findMoveTowardOption(enemy, reachable, units) {
  const playerUnits = units.filter(u => u.team === 'player' && isAlive(u));
  if (playerUnits.length === 0) return null;

  let best = null;
  for (const [key, cost] of reachable.entries()) {
    const [tx, ty] = key.split(',').map(Number);
    let nearest = Infinity;
    for (const p of playerUnits) {
      const d = manhattan(tx, ty, p.x, p.y);
      if (d < nearest) nearest = d;
    }
    if (!best || nearest < best.nearest) {
      best = { x: tx, y: ty, nearest: nearest };
    }
  }
  return best;
}

function runEnemyTurn(units, map, terrainGrid, log) {
  const enemies = units.filter(u => u.team === 'enemy' && isAlive(u));
  for (const enemy of enemies) {
    if (!isAlive(enemy)) continue;
    const reachable = computeReachable(enemy, map, terrainGrid, units);
    const attackOption = findAttackOption(enemy, reachable, map, units);

    if (attackOption) {
      enemy.x = attackOption.x;
      enemy.y = attackOption.y;
      resolveCombat(enemy, attackOption.target, map, terrainGrid, log);
    } else {
      const moveOption = findMoveTowardOption(enemy, reachable, units);
      if (moveOption) {
        enemy.x = moveOption.x;
        enemy.y = moveOption.y;
      }
    }
    enemy.moved = true;
    enemy.acted = true;
  }
}
