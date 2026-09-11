// 描画（DOM操作）

const TILE_SIZE = 40;

function renderAll(state) {
  renderHud(state);
  renderMap(state);
  renderSidebar(state);
  renderLog(state);
}

function renderHud(state) {
  document.getElementById('map-info').textContent = state.map.name;
  document.getElementById('turn-info').textContent =
    `ターン${state.turn}｜${state.phase === 'player' ? '自軍フェーズ' : '敵フェーズ'}`;
}

function renderMap(state) {
  const grid = document.getElementById('map-grid');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${state.map.width}, ${TILE_SIZE}px)`;
  grid.style.gridTemplateRows = `repeat(${state.map.height}, ${TILE_SIZE}px)`;

  const moveKeys = state.moveRange ? new Set(state.moveRange.keys()) : null;
  const attackKeys = state.attackTiles ? new Set(state.attackTiles.map(t => t.x + ',' + t.y)) : null;
  const healKeys = state.healTiles ? new Set(state.healTiles.map(t => t.x + ',' + t.y)) : null;

  for (let y = 0; y < state.map.height; y++) {
    for (let x = 0; x < state.map.width; x++) {
      const terrain = state.terrainGrid[y][x];
      const tile = document.createElement('div');
      tile.className = 'tile terrain-' + terrain;
      const key = x + ',' + y;
      if (moveKeys && moveKeys.has(key)) tile.classList.add('highlight-move');
      if (attackKeys && attackKeys.has(key)) tile.classList.add('highlight-attack');
      if (healKeys && healKeys.has(key)) tile.classList.add('highlight-heal');
      if (state.selectedUnit && state.selectedUnit.x === x && state.selectedUnit.y === y) {
        tile.classList.add('selected');
      }
      if (state.usingCursor && state.cursor && state.cursor.x === x && state.cursor.y === y) {
        tile.classList.add('cursor');
      }
      tile.dataset.x = x;
      tile.dataset.y = y;
      tile.addEventListener('click', () => window.onTileClick(x, y));

      const unit = unitAt(state.units, x, y);
      if (unit) {
        tile.appendChild(buildUnitToken(unit));
      }
      grid.appendChild(tile);
    }
  }
}

function buildUnitToken(unit) {
  const token = document.createElement('div');
  token.className = 'unit-token team-' + unit.team;
  if (unit.acted) token.classList.add('acted');
  token.textContent = unit.glyph;
  token.title = unit.name;

  const hpBar = document.createElement('div');
  hpBar.className = 'hp-bar';
  const hpFill = document.createElement('div');
  const ratio = Math.max(0, unit.hp / unit.stats.maxHp);
  hpFill.className = 'hp-fill';
  hpFill.style.width = (ratio * 100) + '%';
  hpFill.classList.add(ratio > 0.5 ? 'hp-high' : ratio > 0.25 ? 'hp-mid' : 'hp-low');
  hpBar.appendChild(hpFill);
  token.appendChild(hpBar);

  return token;
}

function renderSidebar(state) {
  renderUnitPanel(state);
  renderActionMenu(state);
}

function renderUnitPanel(state) {
  const panel = document.getElementById('unit-panel');
  const unit = state.panelUnit;
  if (!unit) {
    panel.innerHTML = '<p class="hint">ユニットをクリックすると情報が表示されます</p>';
    return;
  }
  const weapon = getEquippedWeapon(unit);
  panel.innerHTML = `
    <h3>${unit.name}（Lv${unit.level}）</h3>
    <p>${unit.team === 'player' ? '自軍' : '敵軍'} ／ EXP ${unit.exp}</p>
    <p>HP ${unit.hp} / ${unit.stats.maxHp}</p>
    <p>攻 ${unit.stats.atk}　防 ${unit.stats.def}　魔 ${unit.stats.mag}</p>
    <p>移動 ${unit.stats.move}　命中 ${unit.stats.hit}　回避 ${unit.stats.avoid}</p>
    <p>装備: ${weapon ? `${weapon.name}（${weapon.durability}/${weapon.maxDurability}）` : 'なし'}</p>
    ${unit.inventory.length > 1 ? renderInventoryButtons(unit) : ''}
  `;

  panel.querySelectorAll('.inv-btn').forEach(btn => {
    btn.addEventListener('click', () => window.onWeaponSelect(parseInt(btn.dataset.index, 10)));
  });
}

function renderInventoryButtons(unit) {
  return '<div class="inventory-list">' + unit.inventory.map((w, i) =>
    `<button class="inv-btn ${i === unit.equippedIndex ? 'equipped' : ''}" data-index="${i}" ${w.durability <= 0 ? 'disabled' : ''}>${w.name} (${w.durability})</button>`
  ).join('') + '</div>';
}

function renderActionMenu(state) {
  const menu = document.getElementById('action-menu');
  menu.innerHTML = '';
  if (!state.menuActions || state.menuActions.length === 0) return;
  for (const action of state.menuActions) {
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.addEventListener('click', () => window.onMenuAction(action.action));
    menu.appendChild(btn);
  }
  autoFocusFirstButton(menu);
}

function renderLog(state) {
  const logPanel = document.getElementById('log-panel');
  logPanel.innerHTML = state.log.slice(-8).map(line => `<p>${line}</p>`).join('');
  logPanel.scrollTop = logPanel.scrollHeight;
}

function showOverlay(opts) {
  const overlay = document.getElementById('overlay');
  const content = document.getElementById('overlay-content');
  content.innerHTML = '';

  const title = document.createElement('h2');
  title.textContent = opts.title;
  content.appendChild(title);

  if (opts.message) {
    const msg = document.createElement('p');
    msg.textContent = opts.message;
    content.appendChild(msg);
  }

  const btnRow = document.createElement('div');
  btnRow.className = 'overlay-buttons';
  (opts.buttons || []).forEach(b => {
    const btn = document.createElement('button');
    btn.textContent = b.label;
    btn.addEventListener('click', b.onClick);
    btnRow.appendChild(btn);
  });
  content.appendChild(btnRow);

  overlay.classList.remove('hidden');
  autoFocusFirstButton(content);
}

function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}

// --- 会話パート描画 ---

function renderDialogueLine() {
  const line = dialogueState.lines[dialogueState.index];
  const info = CHARACTER_INFO[line.speaker];

  if (info.side === 'other') dialogueState.rightChar = line.speaker;

  const leftInfo = CHARACTER_INFO[dialogueState.leftChar];
  const rightInfo = dialogueState.rightChar ? CHARACTER_INFO[dialogueState.rightChar] : null;

  const leftBox = document.getElementById('dialogue-left');
  leftBox.innerHTML = `<div class="portrait-circle">${leftInfo.glyph}</div><div class="portrait-name">${leftInfo.name}</div>`;
  leftBox.classList.toggle('speaking', line.speaker === dialogueState.leftChar);
  leftBox.classList.remove('hidden');

  const rightBox = document.getElementById('dialogue-right');
  if (rightInfo) {
    rightBox.innerHTML = `<div class="portrait-circle">${rightInfo.glyph}</div><div class="portrait-name">${rightInfo.name}</div>`;
    rightBox.classList.remove('hidden');
    rightBox.classList.toggle('speaking', line.speaker === dialogueState.rightChar);
  } else {
    rightBox.classList.add('hidden');
  }

  document.getElementById('dialogue-name').textContent = info.name;
  document.getElementById('dialogue-text').textContent = line.text;
  document.getElementById('dialogue-choices').classList.add('hidden');
  document.getElementById('btn-dialogue-next').classList.remove('hidden');
  autoFocusFirstButton(document.getElementById('dialogue-box'));
}

function renderDialogueChoices() {
  document.getElementById('btn-dialogue-next').classList.add('hidden');
  const choice = dialogueState.choice;
  document.getElementById('dialogue-name').textContent = '';
  document.getElementById('dialogue-text').textContent = choice.question;

  const container = document.getElementById('dialogue-choices');
  container.innerHTML = '';
  choice.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.textContent = opt.label;
    btn.addEventListener('click', () => window.onDialogueChoiceSelect(i));
    container.appendChild(btn);
  });
  container.classList.remove('hidden');
  autoFocusFirstButton(document.getElementById('dialogue-box'));
}

function hideDialogueChoices() {
  document.getElementById('dialogue-choices').classList.add('hidden');
  document.getElementById('btn-dialogue-next').classList.remove('hidden');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'screen-title') autoFocusFirstButton(document.getElementById('screen-title'));
}
