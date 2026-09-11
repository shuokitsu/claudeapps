// Gamepad API を用いたコントローラー入力の管理。
// 標準マッピング前提: 0=A(決定), 1=B(戻る), 9=Start(メニュー), 12=上, 13=下
window.GamepadManager = (function () {
  const BUTTON = { CONFIRM: 0, BACK: 1, START: 9, UP: 12, DOWN: 13 };

  let handlers = { onConfirm: null, onBack: null, onMenu: null, onUp: null, onDown: null };
  let prevPressed = {};
  let pollHandle = null;
  let connectedIndex = null;
  let statusEl = null;

  function setHandlers(h) {
    handlers = Object.assign(handlers, h);
  }

  function isPressed(gamepad, buttonIndex) {
    const btn = gamepad.buttons[buttonIndex];
    return !!btn && btn.pressed;
  }

  function poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = connectedIndex !== null ? pads[connectedIndex] : null;

    if (pad) {
      Object.entries(BUTTON).forEach(([name, index]) => {
        const pressed = isPressed(pad, index);
        const wasPressed = !!prevPressed[name];
        if (pressed && !wasPressed) {
          fireAction(name);
        }
        prevPressed[name] = pressed;
      });
    }

    pollHandle = requestAnimationFrame(poll);
  }

  function fireAction(name) {
    switch (name) {
      case "CONFIRM": handlers.onConfirm && handlers.onConfirm(); break;
      case "BACK": handlers.onBack && handlers.onBack(); break;
      case "START": handlers.onMenu && handlers.onMenu(); break;
      case "UP": handlers.onUp && handlers.onUp(); break;
      case "DOWN": handlers.onDown && handlers.onDown(); break;
    }
  }

  function updateStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function init() {
    statusEl = document.getElementById("gamepad-status");
    updateStatus("コントローラー: 未接続");

    window.addEventListener("gamepadconnected", (e) => {
      connectedIndex = e.gamepad.index;
      prevPressed = {};
      updateStatus("コントローラー: 接続中 (" + e.gamepad.id + ")");
      if (pollHandle === null) poll();
    });

    window.addEventListener("gamepaddisconnected", (e) => {
      if (e.gamepad.index === connectedIndex) {
        connectedIndex = null;
        updateStatus("コントローラー: 未接続");
      }
    });
  }

  return { init, setHandlers };
})();
