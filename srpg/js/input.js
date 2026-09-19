// ゲームパッド・キーボード入力（既存のクリック処理を再利用するカーソル操作レイヤー）

// --- ボタンリストのフォーカス制御（タイトル画面・行動メニュー・会話・オーバーレイ共通） ---

function getFocusableButtons(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('button')).filter(
    b => !b.disabled && b.offsetParent !== null
  );
}

function autoFocusFirstButton(container) {
  const buttons = getFocusableButtons(container);
  buttons.forEach(b => b.classList.remove('gp-focused'));
  if (buttons.length > 0) buttons[0].classList.add('gp-focused');
}

function moveButtonFocus(container, delta) {
  const buttons = getFocusableButtons(container);
  if (buttons.length === 0) return;
  let idx = buttons.findIndex(b => b.classList.contains('gp-focused'));
  if (idx === -1) idx = 0;
  buttons[idx].classList.remove('gp-focused');
  idx = (idx + delta + buttons.length) % buttons.length;
  buttons[idx].classList.add('gp-focused');
  buttons[idx].scrollIntoView({ block: 'nearest' });
}

function activateFocusedButton(container) {
  const buttons = getFocusableButtons(container);
  const focused = buttons.find(b => b.classList.contains('gp-focused')) || buttons[0];
  if (focused) focused.click();
}

// --- マップ上のカーソル移動（既存のonTileClick等をそのまま呼び出す） ---

const GRID_DIRECTION = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

function moveCursorOnGrid(dir) {
  if (state.mode === 'attackTarget' || state.mode === 'healTarget') {
    const list = state.mode === 'attackTarget' ? state.attackTiles : state.healTiles;
    if (!list || list.length === 0) return;
    let idx = list.findIndex(t => t.x === state.cursor.x && t.y === state.cursor.y);
    if (idx === -1) idx = 0;
    const delta = (dir === 'down' || dir === 'right') ? 1 : -1;
    idx = (idx + delta + list.length) % list.length;
    state.cursor = { x: list[idx].x, y: list[idx].y };
    renderMap(state);
    return;
  }
  const d = GRID_DIRECTION[dir];
  const nx = Math.max(0, Math.min(state.map.width - 1, state.cursor.x + d[0]));
  const ny = Math.max(0, Math.min(state.map.height - 1, state.cursor.y + d[1]));
  state.cursor = { x: nx, y: ny };
  renderMap(state);
}

function confirmGrid() {
  window.onTileClick(state.cursor.x, state.cursor.y);
}

function cancelGrid() {
  if (state.mode === 'moveSelect') {
    clearSelection();
    renderAll(state);
  } else if (state.mode === 'attackTarget' || state.mode === 'healTarget') {
    showActionMenuFor(state.selectedUnit);
  }
}

// --- 画面状態に応じた振り分け ---

function isOverlayVisible() {
  const overlay = document.getElementById('overlay');
  return overlay && !overlay.classList.contains('hidden');
}

function isScreenActive(id) {
  const el = document.getElementById(id);
  return !!el && el.classList.contains('active');
}

function handleDirection(dir) {
  state.usingCursor = true;
  const delta = (dir === 'down' || dir === 'right') ? 1 : -1;

  if (isOverlayVisible()) {
    moveButtonFocus(document.getElementById('overlay-content'), delta);
    return;
  }
  if (isScreenActive('screen-dialogue')) {
    moveButtonFocus(document.getElementById('dialogue-box'), delta);
    return;
  }
  if (isScreenActive('screen-title')) {
    moveButtonFocus(document.getElementById('screen-title'), delta);
    return;
  }
  if (isScreenActive('screen-game')) {
    if (state.mode === 'actionMenu') {
      moveButtonFocus(document.getElementById('action-menu'), delta);
      return;
    }
    moveCursorOnGrid(dir);
  }
}

function handleConfirm() {
  state.usingCursor = true;

  if (isOverlayVisible()) {
    activateFocusedButton(document.getElementById('overlay-content'));
    return;
  }
  if (isScreenActive('screen-dialogue')) {
    activateFocusedButton(document.getElementById('dialogue-box'));
    return;
  }
  if (isScreenActive('screen-title')) {
    activateFocusedButton(document.getElementById('screen-title'));
    return;
  }
  if (isScreenActive('screen-game')) {
    if (state.mode === 'actionMenu') {
      activateFocusedButton(document.getElementById('action-menu'));
      return;
    }
    confirmGrid();
  }
}

function handleCancel() {
  state.usingCursor = true;
  if (isScreenActive('screen-game')) cancelGrid();
}

// --- キーボード入力（デスクトップでの動作確認・簡易操作用） ---

const KEY_DIRECTION = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

window.addEventListener('keydown', (e) => {
  if (KEY_DIRECTION[e.key]) {
    e.preventDefault();
    handleDirection(KEY_DIRECTION[e.key]);
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleConfirm();
  } else if (e.key === 'Escape' || e.key === 'Backspace') {
    e.preventDefault();
    handleCancel();
  }
});

// --- ゲームパッド入力（標準ゲームパッドマッピング前提） ---

const GAMEPAD_REPEAT_DELAY = 400; // 方向入力を押し続けた時、最初の連続入力までの待ち時間(ms)
const GAMEPAD_REPEAT_RATE = 150; // 連続入力の間隔(ms)

const gamepadDirActive = { up: false, down: false, left: false, right: false };
const gamepadDirNextTime = { up: 0, down: 0, left: 0, right: 0 };
let gamepadConfirmPrev = false;
let gamepadCancelPrev = false;

function readGamepadDirections(pad) {
  const threshold = 0.5;
  const axisX = pad.axes[0] || 0;
  const axisY = pad.axes[1] || 0;
  return {
    up: !!(pad.buttons[12] && pad.buttons[12].pressed) || axisY < -threshold,
    down: !!(pad.buttons[13] && pad.buttons[13].pressed) || axisY > threshold,
    left: !!(pad.buttons[14] && pad.buttons[14].pressed) || axisX < -threshold,
    right: !!(pad.buttons[15] && pad.buttons[15].pressed) || axisX > threshold,
  };
}

function pollGamepad(timestamp) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = pads && (pads[0] || pads[1] || pads[2] || pads[3]);

  if (pad) {
    const dirs = readGamepadDirections(pad);
    for (const dir of ['up', 'down', 'left', 'right']) {
      if (dirs[dir]) {
        if (!gamepadDirActive[dir]) {
          gamepadDirActive[dir] = true;
          gamepadDirNextTime[dir] = timestamp + GAMEPAD_REPEAT_DELAY;
          handleDirection(dir);
        } else if (timestamp >= gamepadDirNextTime[dir]) {
          gamepadDirNextTime[dir] = timestamp + GAMEPAD_REPEAT_RATE;
          handleDirection(dir);
        }
      } else {
        gamepadDirActive[dir] = false;
      }
    }

    const confirmPressed = !!(pad.buttons[0] && pad.buttons[0].pressed);
    if (confirmPressed && !gamepadConfirmPrev) handleConfirm();
    gamepadConfirmPrev = confirmPressed;

    const cancelPressed = !!(pad.buttons[1] && pad.buttons[1].pressed);
    if (cancelPressed && !gamepadCancelPrev) handleCancel();
    gamepadCancelPrev = cancelPressed;
  }

  requestAnimationFrame(pollGamepad);
}

requestAnimationFrame(pollGamepad);
