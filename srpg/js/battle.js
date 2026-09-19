// 戦闘計算

function clampPercent(v) {
  return Math.max(5, Math.min(95, v));
}

function computeHitChance(attacker, weapon, defender, defenderTerrain) {
  const terrainAvoid = TERRAIN[defenderTerrain] ? TERRAIN[defenderTerrain].avoid : 0;
  const raw = attacker.stats.hit + weapon.hit - defender.stats.avoid - terrainAvoid;
  return clampPercent(raw);
}

function computeDamage(attacker, weapon, defender) {
  const power = unitAttackPower(attacker, weapon);
  return Math.max(1, power - defender.stats.def);
}

const EXP_HIT = 5;
const EXP_KILL_BASE = 20;
const EXP_HEAL = 8;

// 1回の攻撃（命中判定・ダメージ・耐久度・EXP）を解決する
function resolveSingleHit(attacker, defender, defenderTerrain, log) {
  const weapon = getEquippedWeapon(attacker);
  if (!weapon) return { hit: false, killed: false };
  const hitChance = computeHitChance(attacker, weapon, defender, defenderTerrain);
  const roll = Math.random() * 100;
  const hit = roll < hitChance;
  weapon.durability = Math.max(0, weapon.durability - 1);

  let killed = false;
  if (hit) {
    const dmg = computeDamage(attacker, weapon, defender);
    defender.hp = Math.max(0, defender.hp - dmg);
    killed = defender.hp <= 0;
    log.push(`${attacker.name}の攻撃！ ${defender.name}に${dmg}ダメージ${killed ? '（撃破！）' : ''}`);
    if (attacker.team === 'player') {
      const exp = killed ? EXP_KILL_BASE + defender.level * 2 : EXP_HIT;
      const levelUps = gainExp(attacker, exp);
      levelUps.forEach(lu => log.push(`${attacker.name}はレベル${lu.level}に上がった！`));
    }
  } else {
    log.push(`${attacker.name}の攻撃！ ${defender.name}は回避した`);
  }

  if (weapon.durability <= 0) {
    log.push(`${attacker.name}の${weapon.name}が壊れた`);
    removeBrokenWeapon(attacker, weapon);
  }

  return { hit, killed };
}

// 攻撃側→（生存していれば）防御側の反撃、を解決する
function resolveCombat(attacker, defender, map, terrainGrid, log) {
  const defenderTerrain = terrainGrid[defender.y][defender.x];
  const attackerTerrain = terrainGrid[attacker.y][attacker.x];

  const result1 = resolveSingleHit(attacker, defender, defenderTerrain, log);
  if (result1.killed || !isAlive(defender)) return;

  const counterWeapon = getEquippedWeapon(defender);
  if (!counterWeapon || counterWeapon.type === 'staff') return;
  const dist = manhattan(attacker.x, attacker.y, defender.x, defender.y);
  if (dist < counterWeapon.range[0] || dist > counterWeapon.range[1]) return;

  resolveSingleHit(defender, attacker, attackerTerrain, log);
}

function resolveHeal(healer, target, log) {
  const weapon = getEquippedWeapon(healer);
  if (!weapon || weapon.type !== 'staff') return;
  const healAmount = weapon.healAmount || 10;
  const before = target.hp;
  target.hp = Math.min(target.stats.maxHp, target.hp + healAmount);
  const healed = target.hp - before;
  weapon.durability = Math.max(0, weapon.durability - 1);
  log.push(`${healer.name}が${target.name}を${healed}回復した`);
  if (healer.team === 'player') {
    const levelUps = gainExp(healer, EXP_HEAL);
    levelUps.forEach(lu => log.push(`${healer.name}はレベル${lu.level}に上がった！`));
  }
  if (weapon.durability <= 0) {
    log.push(`${healer.name}の${weapon.name}が壊れた`);
    removeBrokenWeapon(healer, weapon);
  }
}
