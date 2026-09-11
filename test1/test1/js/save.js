// localStorage を用いたセーブ/ロード管理。スロット数はシステム設定から取得する。
window.SaveManager = (function () {
  const KEY_PREFIX = "vn_save_slot_";
  const SETTINGS_KEY = "vn_settings";
  const PROGRESS_KEY = "vn_flowchart_progress";

  function slotCount() {
    return (window.SystemConfig && window.SystemConfig.saveSlotCount) || 3;
  }

  function slotKey(index) {
    return KEY_PREFIX + index;
  }

  function getSlots() {
    const slots = [];
    for (let i = 0; i < slotCount(); i++) {
      const raw = localStorage.getItem(slotKey(i));
      slots.push(raw ? JSON.parse(raw) : null);
    }
    return slots;
  }

  function save(index, state) {
    const payload = Object.assign({}, state, { savedAt: new Date().toISOString() });
    localStorage.setItem(slotKey(index), JSON.stringify(payload));
  }

  function load(index) {
    const raw = localStorage.getItem(slotKey(index));
    return raw ? JSON.parse(raw) : null;
  }

  function remove(index) {
    localStorage.removeItem(slotKey(index));
  }

  function loadSettings() {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  // 分岐マップ用の進捗（訪問済みシーン・遷移）。セーブスロットとは独立したグローバルな記録で、
  // 新規ゲーム開始やロードでリセットされない（プレイ全体を通じた「集めていく」記録のため）。
  function loadProgress() {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : { scenes: {}, edges: {} };
  }

  function saveProgress(progress) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }

  // 設定画面の「進捗状況のリセット」用。セーブスロット全部と分岐マップの記録を削除する。
  // テキスト表示設定（vn_settings）は「進捗」ではないためここでは消さない。
  function resetProgress() {
    for (let i = 0; i < slotCount(); i++) {
      localStorage.removeItem(slotKey(i));
    }
    localStorage.removeItem(PROGRESS_KEY);
  }

  return { getSlots, save, load, remove, loadSettings, saveSettings, loadProgress, saveProgress, resetProgress };
})();
