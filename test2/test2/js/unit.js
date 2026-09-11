// ユニットの生成・成長・戦闘状態管理

let __unitIdCounter = 1;
function nextUnitId() {
  return 'u' + (__unitIdCounter++);
}

function createPlayerUnit(classId, x, y) {
  const def = PLAYER_CLASS_DEFS[classId];
  const stats = Object.assign({}, def.baseStats);
  const unit = {
    id: nextUnitId(),
    classId: classId,
    name: def.name,
    glyph: def.glyph,
    team: 'player',
    level: 1,
    exp: 0,
    x: x, y: y,
    hp: stats.maxHp,
    stats: stats,
    growth: Object.assign({}, def.growth),
    inventory: def.weapons.map(createWeaponInstance),
    equippedIndex: 0,
    moved: false,
    acted: false,
  };
  return unit;
}

function createEnemyUnit(classId, x, y, mapIndex, mod) {
  const def = ENEMY_CLASS_DEFS[classId];
  const stats = scaleEnemyStats(def.baseStats, mapIndex);
  if (mod) {
    stats.atk += mod.atk || 0;
    stats.def += mod.def || 0;
  }
  const unit = {
    id: nextUnitId(),
    classId: classId,
    name: def.name,
    glyph: def.glyph,
    team: 'enemy',
    level: enemyLevelForMap(mapIndex),
    exp: 0,
    x: x, y: y,
    hp: stats.maxHp,
    stats: stats,
    growth: null,
    inventory: def.weapons.map(createWeaponInstance),
    equippedIndex: 0,
    moved: false,
    acted: false,
  };
  return unit;
}

function getEquippedWeapon(unit) {
  return unit.inventory[unit.equippedIndex] || null;
}

function isAlive(unit) {
  return unit.hp > 0;
}

function unitAttackPower(unit, weapon) {
  if (weapon.type === 'tome') return unit.stats.mag + weapon.might;
  return unit.stats.atk + weapon.might;
}

const EXP_PER_LEVEL = 100;

function gainExp(unit, amount) {
  if (unit.team !== 'player') return [];
  unit.exp += amount;
  const levelUps = [];
  while (unit.exp >= EXP_PER_LEVEL) {
    unit.exp -= EXP_PER_LEVEL;
    levelUps.push(applyLevelUp(unit));
  }
  return levelUps;
}

function applyLevelUp(unit) {
  unit.level += 1;
  const gains = {};
  for (const stat in unit.growth) {
    const roll = Math.random() * 100;
    if (roll < unit.growth[stat]) {
      if (stat === 'hp') {
        unit.stats.maxHp += 1;
        unit.hp += 1;
      } else {
        unit.stats[stat] += 1;
      }
      gains[stat] = 1;
    }
  }
  return { level: unit.level, gains: gains };
}

function equipWeaponAt(unit, index) {
  if (index >= 0 && index < unit.inventory.length && unit.inventory[index].durability > 0) {
    unit.equippedIndex = index;
    return true;
  }
  return false;
}

function removeBrokenWeapon(unit, weapon) {
  const idx = unit.inventory.indexOf(weapon);
  if (idx === -1) return;
  unit.inventory.splice(idx, 1);
  if (unit.equippedIndex >= unit.inventory.length) unit.equippedIndex = 0;
  // 使用可能な武器に自動で切り替え
  if (unit.inventory.length > 0 && unit.inventory[unit.equippedIndex].durability <= 0) {
    const usable = unit.inventory.findIndex(w => w.durability > 0);
    if (usable !== -1) unit.equippedIndex = usable;
  }
}

function serializeUnit(unit) {
  return JSON.parse(JSON.stringify(unit));
}
