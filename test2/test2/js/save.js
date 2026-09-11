// セーブ・ロード（localStorage）

const SAVE_KEY = 'srpg_save_v1';

function hasSaveData() {
  return localStorage.getItem(SAVE_KEY) !== null;
}

function saveGameState(state) {
  const data = {
    version: 1,
    mapIndex: state.mapIndex,
    turn: state.turn,
    units: state.units.map(serializeUnit),
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function loadGameState() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function deleteSaveData() {
  localStorage.removeItem(SAVE_KEY);
}
