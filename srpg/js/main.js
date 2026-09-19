// ゲーム全体の状態管理・進行ロジック

const state = {
  mapIndex: 1,
  map: null,
  terrainGrid: null,
  units: [],
  turn: 1,
  phase: 'player',
  selectedUnit: null,
  mode: 'idle', // idle | moveSelect | actionMenu | attackTarget | healTarget
  moveRange: null,
  attackTiles: null,
  healTiles: null,
  panelUnit: null,
  menuActions: [],
  log: [],
  cursor: { x: 0, y: 0 },
  usingCursor: false, // ゲームパッド/キーボード操作を使い始めたらtrueになり、カーソル表示が有効になる
};

function startMap(mapIndex, carryUnits, enemyMod) {
  state.mapIndex = mapIndex;
  state.map = MAPS[mapIndex];
  state.terrainGrid = buildTerrainGrid(state.map);

  const playerUnits = state.map.playerSpawns.map(spawn => {
    const existing = carryUnits && carryUnits.find(u => u.classId === spawn.classId);
    if (existing) {
      existing.x = spawn.x;
      existing.y = spawn.y;
      existing.hp = existing.stats.maxHp;
      existing.moved = false;
      existing.acted = false;
      return existing;
    }
    return createPlayerUnit(spawn.classId, spawn.x, spawn.y);
  });

  const enemyUnits = state.map.enemies.map(e => createEnemyUnit(e.classId, e.x, e.y, mapIndex, enemyMod));

  state.units = playerUnits.concat(enemyUnits);
  state.turn = 1;
  state.phase = 'player';
  clearSelection();
  state.cursor = { x: playerUnits[0].x, y: playerUnits[0].y };
  state.log = [`${state.map.name} 開始！`];

  showScreen('screen-game');
  renderAll(state);
}

function clearSelection() {
  state.selectedUnit = null;
  state.mode = 'idle';
  state.moveRange = null;
  state.attackTiles = null;
  state.healTiles = null;
  state.menuActions = [];
}

function selectUnitForAction(unit) {
  state.selectedUnit = unit;
  state.panelUnit = unit;
  state.mode = 'moveSelect';
  state.moveRange = computeReachable(unit, state.map, state.terrainGrid, state.units);
  state.attackTiles = null;
  state.healTiles = null;
  state.menuActions = [];
  renderAll(state);
}

function commitMove(unit, x, y) {
  unit.x = x;
  unit.y = y;
  unit.moved = true;
  state.moveRange = null;
  showActionMenuFor(unit);
}

function showActionMenuFor(unit) {
  const weapon = getEquippedWeapon(unit);
  state.attackTiles = null;
  state.healTiles = null;
  state.menuActions = [];

  if (weapon && weapon.type !== 'staff') {
    const candidates = tilesInRange(state.map, unit.x, unit.y, weapon.range);
    const targets = [];
    for (const c of candidates) {
      const target = unitAt(state.units, c.x, c.y);
      if (target && target.team !== unit.team && isAlive(target)) {
        targets.push({ x: c.x, y: c.y, target: target });
      }
    }
    if (targets.length > 0) {
      state.attackTiles = targets;
      state.menuActions.push({ label: 'こうげき', action: 'attack' });
    }
  }

  if (weapon && weapon.type === 'staff') {
    const candidates = tilesInRange(state.map, unit.x, unit.y, weapon.range);
    const targets = [];
    for (const c of candidates) {
      const target = unitAt(state.units, c.x, c.y);
      if (target && target.team === unit.team && isAlive(target) && target.hp < target.stats.maxHp) {
        targets.push({ x: c.x, y: c.y, target: target });
      }
    }
    if (targets.length > 0) {
      state.healTiles = targets;
      state.menuActions.push({ label: 'いやし', action: 'heal' });
    }
  }

  state.menuActions.push({ label: '待機', action: 'wait' });
  state.mode = 'actionMenu';
  renderAll(state);
}

function finalizeUnitTurn(unit) {
  unit.acted = true;
  unit.moved = true;
  clearSelection();
  state.panelUnit = unit;
  renderAll(state);
  if (checkMapEnd()) return;
  checkAutoEndTurn();
}

function checkAutoEndTurn() {
  const remaining = state.units.filter(u => u.team === 'player' && isAlive(u) && !u.acted);
  if (remaining.length === 0) {
    startEnemyPhase();
  }
}

function startEnemyPhase() {
  state.phase = 'enemy';
  clearSelection();
  state.panelUnit = null;
  renderAll(state);
  setTimeout(() => {
    runEnemyTurn(state.units, state.map, state.terrainGrid, state.log);
    renderAll(state);
    if (checkMapEnd()) return;
    startPlayerPhase();
  }, 400);
}

function startPlayerPhase() {
  state.turn += 1;
  state.phase = 'player';
  state.units.forEach(u => {
    if (u.team === 'player') {
      u.moved = false;
      u.acted = false;
    }
  });
  clearSelection();
  state.panelUnit = null;
  renderAll(state);
}

function checkMapEnd() {
  const prince = state.units.find(u => u.classId === 'prince');
  if (!prince || !isAlive(prince)) {
    showGameOver();
    return true;
  }
  const enemiesAlive = state.units.filter(u => u.team === 'enemy' && isAlive(u));
  if (enemiesAlive.length === 0) {
    showMapClear();
    return true;
  }
  return false;
}

function showGameOver() {
  showOverlay({
    title: 'ゲームオーバー',
    message: '王子が戦闘不能になった…',
    buttons: [{ label: 'タイトルへ', onClick: () => { hideOverlay(); showScreen('screen-title'); refreshTitleButtons(); } }],
  });
}

function showMapClear() {
  const survivors = state.units.filter(u => u.team === 'player' && isAlive(u));
  const clearedMapIndex = state.mapIndex;

  showDialogueScene(DIALOGUES[clearedMapIndex].outro, () => {
    if (clearedMapIndex < MAPS.length - 1) {
      const nextIndex = clearedMapIndex + 1;
      showDialogueScene(DIALOGUES[nextIndex].intro, (mod) => {
        startMap(nextIndex, survivors, mod);
      });
    } else {
      deleteSaveData();
      showScreen('screen-title');
      refreshTitleButtons();
    }
  });
}

// --- イベントハンドラ（render.jsから呼ばれるグローバル関数） ---

window.onTileClick = function (x, y) {
  if (state.phase !== 'player') return;
  const clickedUnit = unitAt(state.units, x, y);

  if (state.mode === 'idle') {
    if (clickedUnit && clickedUnit.team === 'player' && !clickedUnit.acted) {
      selectUnitForAction(clickedUnit);
    } else {
      state.panelUnit = clickedUnit || null;
      renderAll(state);
    }
    return;
  }

  if (state.mode === 'moveSelect') {
    const key = x + ',' + y;
    if (state.moveRange.has(key)) {
      commitMove(state.selectedUnit, x, y);
    } else if (clickedUnit && clickedUnit.team === 'player' && !clickedUnit.acted) {
      selectUnitForAction(clickedUnit);
    } else {
      clearSelection();
      renderAll(state);
    }
    return;
  }

  if (state.mode === 'attackTarget') {
    const info = state.attackTiles.find(t => t.x === x && t.y === y);
    if (info) {
      resolveCombat(state.selectedUnit, info.target, state.map, state.terrainGrid, state.log);
      finalizeUnitTurn(state.selectedUnit);
    }
    return;
  }

  if (state.mode === 'healTarget') {
    const info = state.healTiles.find(t => t.x === x && t.y === y);
    if (info) {
      resolveHeal(state.selectedUnit, info.target, state.log);
      finalizeUnitTurn(state.selectedUnit);
    }
    return;
  }
};

window.onMenuAction = function (action) {
  const unit = state.selectedUnit;
  if (!unit) return;
  if (action === 'attack') {
    state.mode = 'attackTarget';
    state.menuActions = [];
    renderAll(state);
  } else if (action === 'heal') {
    state.mode = 'healTarget';
    state.menuActions = [];
    renderAll(state);
  } else if (action === 'wait') {
    finalizeUnitTurn(unit);
  }
};

window.onWeaponSelect = function (index) {
  const unit = state.selectedUnit;
  if (!unit || unit.acted) return;
  if (equipWeaponAt(unit, index)) {
    if (state.mode === 'actionMenu') {
      showActionMenuFor(unit);
    } else {
      renderAll(state);
    }
  }
};

window.onEndTurn = function () {
  if (state.phase !== 'player') return;
  state.units.forEach(u => {
    if (u.team === 'player') {
      u.moved = true;
      u.acted = true;
    }
  });
  startEnemyPhase();
};

window.onSave = function () {
  if (state.phase !== 'player') return;
  saveGameState(state);
  state.log.push('セーブしました');
  renderLog(state);
};

function refreshTitleButtons() {
  document.getElementById('btn-continue').disabled = !hasSaveData();
  autoFocusFirstButton(document.getElementById('screen-title'));
}

window.addEventListener('DOMContentLoaded', () => {
  showScreen('screen-title');
  refreshTitleButtons();

  document.getElementById('btn-new-game').addEventListener('click', () => {
    showDialogueScene(DIALOGUES[1].intro, (mod) => {
      startMap(1, null, mod);
    });
  });

  document.getElementById('btn-continue').addEventListener('click', () => {
    const data = loadGameState();
    if (!data) return;
    state.mapIndex = data.mapIndex;
    state.map = MAPS[state.mapIndex];
    state.terrainGrid = buildTerrainGrid(state.map);
    state.units = data.units;
    state.turn = data.turn;
    state.phase = 'player';
    clearSelection();
    state.panelUnit = null;
    const firstPlayerUnit = state.units.find(u => u.team === 'player');
    if (firstPlayerUnit) state.cursor = { x: firstPlayerUnit.x, y: firstPlayerUnit.y };
    state.log = [`${state.map.name} を再開`];
    showScreen('screen-game');
    renderAll(state);
  });

  document.getElementById('btn-save').addEventListener('click', window.onSave);
  document.getElementById('btn-end-turn').addEventListener('click', window.onEndTurn);
  document.getElementById('btn-dialogue-next').addEventListener('click', window.onDialogueNext);
});
