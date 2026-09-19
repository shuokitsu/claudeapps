// ゲームの静的データ定義（地形・武器・クラス・マップ）

const TERRAIN = {
  plain: { name: '平地', moveCost: 1, avoid: 0, color: '#bfe38a' },
  forest: { name: '森', moveCost: 2, avoid: 20, color: '#3f7d3f' },
  mountain: { name: '山', moveCost: 3, avoid: 30, color: '#9c8060' },
  wall: { name: '壁', moveCost: Infinity, avoid: 0, color: '#5a5a5a', impassable: true },
};

const WEAPON_DEFS = {
  iron_sword: { id: 'iron_sword', name: 'アイアンソード', type: 'sword', range: [1, 1], might: 5, hit: 0, maxDurability: 40 },
  iron_lance: { id: 'iron_lance', name: 'アイアンランス', type: 'lance', range: [1, 1], might: 6, hit: -5, maxDurability: 40 },
  iron_axe: { id: 'iron_axe', name: 'アイアンアックス', type: 'axe', range: [1, 1], might: 7, hit: -15, maxDurability: 35 },
  fire_tome: { id: 'fire_tome', name: 'ファイア', type: 'tome', range: [1, 2], might: 5, hit: 5, maxDurability: 30 },
  dark_tome: { id: 'dark_tome', name: 'ダーク', type: 'tome', range: [1, 2], might: 6, hit: 0, maxDurability: 25 },
  short_bow: { id: 'short_bow', name: 'ショートボウ', type: 'bow', range: [2, 2], might: 5, hit: 0, maxDurability: 30 },
  heal_staff: { id: 'heal_staff', name: 'いやしの杖', type: 'staff', range: [1, 3], might: 0, hit: 100, maxDurability: 20, healAmount: 12 },
};

function createWeaponInstance(weaponId) {
  const def = WEAPON_DEFS[weaponId];
  return Object.assign({}, def, { durability: def.maxDurability });
}

// プレイヤークラス定義
const PLAYER_CLASS_DEFS = {
  prince: {
    id: 'prince', name: '王子', glyph: '王',
    baseStats: { maxHp: 20, atk: 7, def: 5, mag: 0, move: 6, hit: 75, avoid: 15 },
    growth: { hp: 60, atk: 50, def: 40, mag: 0, hit: 40, avoid: 30 },
    weapons: ['iron_sword'],
  },
  heavy: {
    id: 'heavy', name: '重兵', glyph: '重',
    baseStats: { maxHp: 28, atk: 8, def: 9, mag: 0, move: 4, hit: 65, avoid: 5 },
    growth: { hp: 70, atk: 45, def: 55, mag: 0, hit: 30, avoid: 15 },
    weapons: ['iron_lance'],
  },
  mage: {
    id: 'mage', name: '魔導士', glyph: '魔',
    baseStats: { maxHp: 16, atk: 3, def: 3, mag: 8, move: 5, hit: 70, avoid: 15 },
    growth: { hp: 40, atk: 20, def: 25, mag: 60, hit: 35, avoid: 25 },
    weapons: ['fire_tome'],
  },
  priest: {
    id: 'priest', name: '僧侶', glyph: '僧',
    baseStats: { maxHp: 17, atk: 2, def: 4, mag: 5, move: 5, hit: 70, avoid: 20 },
    growth: { hp: 45, atk: 15, def: 30, mag: 40, hit: 30, avoid: 30 },
    weapons: ['heal_staff'],
  },
};

// 敵クラス定義（基礎値。マップごとにscaleEnemyStatsで補正する）
const ENEMY_CLASS_DEFS = {
  soldier: {
    id: 'soldier', name: '兵士', glyph: '兵',
    baseStats: { maxHp: 18, atk: 6, def: 4, mag: 0, move: 5, hit: 65, avoid: 5 },
    weapons: ['iron_sword'],
  },
  brigand: {
    id: 'brigand', name: '山賊', glyph: '斧',
    baseStats: { maxHp: 20, atk: 8, def: 2, mag: 0, move: 5, hit: 55, avoid: 0 },
    weapons: ['iron_axe'],
  },
  lancer: {
    id: 'lancer', name: '槍兵', glyph: '槍',
    baseStats: { maxHp: 19, atk: 7, def: 5, mag: 0, move: 5, hit: 60, avoid: 5 },
    weapons: ['iron_lance'],
  },
  archer: {
    id: 'archer', name: '弓兵', glyph: '弓',
    baseStats: { maxHp: 15, atk: 5, def: 3, mag: 0, move: 5, hit: 60, avoid: 10 },
    weapons: ['short_bow'],
  },
  darkMage: {
    id: 'darkMage', name: '闇魔道士', glyph: '闇',
    baseStats: { maxHp: 14, atk: 2, def: 2, mag: 7, move: 5, hit: 60, avoid: 10 },
    weapons: ['dark_tome'],
  },
};

// マップごとの敵の強化補正
function scaleEnemyStats(baseStats, mapIndex) {
  const bonus = [0, 0, 3, 6][mapIndex] || 0; // mapIndexは1始まり
  const atkBonus = [0, 0, 1, 2][mapIndex] || 0;
  return {
    maxHp: baseStats.maxHp + bonus,
    atk: baseStats.atk + atkBonus,
    def: baseStats.def + atkBonus,
    mag: baseStats.mag + (baseStats.mag > 0 ? atkBonus : 0),
    move: baseStats.move,
    hit: baseStats.hit,
    avoid: baseStats.avoid,
  };
}

function enemyLevelForMap(mapIndex) {
  return [0, 1, 3, 5][mapIndex] || 1;
}

// マップ定義
const MAPS = [
  null, // インデックスを1始まりにするためのダミー
  {
    index: 1,
    name: '第一章 王都陥落',
    width: 10,
    height: 8,
    terrainFeatures: {
      forest: [[4, 2], [4, 3], [6, 1], [3, 6], [7, 6]],
      mountain: [[7, 2], [2, 1]],
      wall: [[5, 3], [5, 4]],
    },
    playerSpawns: [
      { classId: 'prince', x: 1, y: 3 },
      { classId: 'heavy', x: 1, y: 4 },
      { classId: 'mage', x: 1, y: 2 },
      { classId: 'priest', x: 1, y: 5 },
    ],
    enemies: [
      { classId: 'soldier', x: 8, y: 1 },
      { classId: 'soldier', x: 8, y: 6 },
      { classId: 'brigand', x: 7, y: 3 },
      { classId: 'brigand', x: 6, y: 5 },
      { classId: 'lancer', x: 9, y: 3 },
      { classId: 'archer', x: 9, y: 5 },
    ],
  },
  {
    index: 2,
    name: '第二章 谷間の攻防',
    width: 12,
    height: 10,
    terrainFeatures: {
      forest: [[5, 2], [5, 3], [6, 6], [7, 7], [3, 7], [8, 2]],
      mountain: [[8, 4], [2, 6], [9, 6]],
      wall: [[6, 4], [6, 5], [0, 4]],
    },
    playerSpawns: [
      { classId: 'prince', x: 1, y: 4 },
      { classId: 'heavy', x: 1, y: 5 },
      { classId: 'mage', x: 1, y: 3 },
      { classId: 'priest', x: 1, y: 6 },
    ],
    enemies: [
      { classId: 'soldier', x: 9, y: 1 },
      { classId: 'soldier', x: 10, y: 3 },
      { classId: 'soldier', x: 9, y: 8 },
      { classId: 'brigand', x: 8, y: 5 },
      { classId: 'brigand', x: 7, y: 8 },
      { classId: 'lancer', x: 10, y: 6 },
      { classId: 'lancer', x: 11, y: 2 },
      { classId: 'archer', x: 11, y: 5 },
      { classId: 'archer', x: 8, y: 1 },
      { classId: 'darkMage', x: 10, y: 8 },
    ],
  },
  {
    index: 3,
    name: '第三章 決戦',
    width: 14,
    height: 11,
    terrainFeatures: {
      forest: [[6, 2], [6, 3], [7, 8], [8, 8], [3, 8], [4, 2], [10, 5]],
      mountain: [[9, 3], [2, 7], [11, 7], [5, 5]],
      wall: [[7, 5], [7, 6], [0, 5], [13, 5]],
    },
    playerSpawns: [
      { classId: 'prince', x: 1, y: 5 },
      { classId: 'heavy', x: 1, y: 6 },
      { classId: 'mage', x: 1, y: 4 },
      { classId: 'priest', x: 1, y: 7 },
    ],
    enemies: [
      { classId: 'soldier', x: 10, y: 1 },
      { classId: 'soldier', x: 11, y: 3 },
      { classId: 'soldier', x: 12, y: 6 },
      { classId: 'soldier', x: 10, y: 9 },
      { classId: 'brigand', x: 9, y: 2 },
      { classId: 'brigand', x: 8, y: 6 },
      { classId: 'brigand', x: 9, y: 9 },
      { classId: 'lancer', x: 12, y: 2 },
      { classId: 'lancer', x: 13, y: 4 },
      { classId: 'lancer', x: 12, y: 8 },
      { classId: 'archer', x: 13, y: 2 },
      { classId: 'archer', x: 13, y: 8 },
      { classId: 'archer', x: 11, y: 5 },
      { classId: 'darkMage', x: 12, y: 4 },
      { classId: 'darkMage', x: 11, y: 9 },
    ],
  },
];

function getTerrainAt(map, x, y) {
  const feats = map.terrainFeatures;
  for (const type in feats) {
    if (feats[type].some(([fx, fy]) => fx === x && fy === y)) return type;
  }
  return 'plain';
}
