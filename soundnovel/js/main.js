(function () {
  // ---------- レスポンシブ対応 ----------
  // #stage は常に --stage-w x --stage-h（1280x720）の設計解像度で組み立てられている。
  // 実際の画面サイズに収まる最大倍率を計算し、transform: scale() で拡縮表示する。
  // アスペクト比の崩れを防ぐため、リサイズ・端末回転のたびに再計算する。
  (function setupResponsiveStage() {
    const stageViewport = document.getElementById("stage-viewport");
    const stageEl = document.getElementById("stage");
    const rootStyle = getComputedStyle(document.documentElement);
    const stageW = parseFloat(rootStyle.getPropertyValue("--stage-w"));
    const stageH = parseFloat(rootStyle.getPropertyValue("--stage-h"));

    function fitStage() {
      const scale = Math.min(
        stageViewport.clientWidth / stageW,
        stageViewport.clientHeight / stageH
      );
      stageEl.style.transform = `scale(${scale})`;
    }

    fitStage();
    window.addEventListener("resize", fitStage);
    window.addEventListener("orientationchange", fitStage);
  })();

  const scenario = window.ScenarioParser.parse(window.SampleScenarioText);

  const dom = {
    titleScreen: document.getElementById("title-screen"),
    gameScreen: document.getElementById("game-screen"),
    backlogScreen: document.getElementById("backlog-screen"),
    settingsScreen: document.getElementById("settings-screen"),
    saveloadScreen: document.getElementById("saveload-screen"),
    flowmapScreen: document.getElementById("flowmap-screen"),

    gameTitle: document.getElementById("game-title"),
    bgLayer: document.getElementById("bg-layer"),
    charSlots: {
      left: document.getElementById("char-left"),
      center: document.getElementById("char-center"),
      right: document.getElementById("char-right")
    },
    textBox: document.getElementById("text-box"),
    speakerName: document.getElementById("speaker-name"),
    textBody: document.getElementById("text-body"),
    choiceLayer: document.getElementById("choice-layer"),

    btnStart: document.getElementById("btn-start"),
    btnLoadTitle: document.getElementById("btn-load-title"),
    btnSettingsTitle: document.getElementById("btn-settings-title"),
    btnFlowmapTitle: document.getElementById("btn-flowmap-title"),

    btnAuto: document.getElementById("btn-auto"),
    btnBacklog: document.getElementById("btn-backlog"),
    btnFlowmap: document.getElementById("btn-flowmap"),
    btnSave: document.getElementById("btn-save"),
    btnLoad: document.getElementById("btn-load"),
    btnSettings: document.getElementById("btn-settings"),

    backlogList: document.getElementById("backlog-list"),
    saveloadTitle: document.getElementById("saveload-title"),
    saveSlotList: document.getElementById("save-slot-list"),

    flowmapCompletion: document.getElementById("flowmap-completion"),
    flowmapSvg: document.getElementById("flowmap-svg"),
    flowmapEmpty: document.getElementById("flowmap-empty"),
    btnFlowmapZoomIn: document.getElementById("btn-flowmap-zoom-in"),
    btnFlowmapZoomOut: document.getElementById("btn-flowmap-zoom-out"),

    btnResetProgress: document.getElementById("btn-reset-progress")
  };

  dom.gameTitle.textContent = scenario.title;

  const engine = new window.VNEngine(scenario, dom, {
    onBacklogUpdate: renderBacklog,
    onReturnTitle: showTitleScreen,
    onSceneEnter: (e) => window.FlowMap.recordVisit(e.from, e.to, e.view, e.flags)
  });

  const savedSettings = window.SaveManager.loadSettings();
  if (savedSettings.textSpeed) {
    engine.setTextSpeed(savedSettings.textSpeed);
  }

  // ---------- 画面切り替え ----------

  function showScreen(el) { el.classList.remove("hidden"); }
  function hideScreen(el) { el.classList.add("hidden"); }

  function showTitleScreen() {
    hideScreen(dom.gameScreen);
    showScreen(dom.titleScreen);
    engine.bgmAudio.pause();
  }

  function startNewGame() {
    hideScreen(dom.titleScreen);
    showScreen(dom.gameScreen);
    engine.view = { bg: null, chars: { left: null, center: null, right: null }, bgm: null };
    engine.start(scenario.start, 0);
  }

  dom.btnStart.addEventListener("click", startNewGame);
  dom.btnSettingsTitle.addEventListener("click", () => showScreen(dom.settingsScreen));
  dom.btnLoadTitle.addEventListener("click", () => openSaveLoad("load"));
  dom.btnFlowmapTitle.addEventListener("click", openFlowmap);

  // ---------- テキスト送り ----------

  // スマホでは狭いテキストボックスを正確にタップするのが難しいため、
  // HUD・選択肢の上以外は画面全体をタップしてもテキスト送りできるようにする
  // （テキストボックス自体は下記でも二重に処理されないよう除外）。
  dom.gameScreen.addEventListener("click", (e) => {
    if (e.target.closest("#hud, #choice-layer, #text-box")) return;
    engine.onConfirm();
  });

  dom.textBox.addEventListener("click", () => engine.onConfirm());

  // ---------- HUD ----------

  dom.btnAuto.addEventListener("click", () => {
    const active = engine.toggleAuto();
    dom.btnAuto.dataset.active = active ? "true" : "false";
  });

  dom.btnBacklog.addEventListener("click", () => {
    renderBacklog(engine.backlog);
    showScreen(dom.backlogScreen);
  });

  dom.btnFlowmap.addEventListener("click", openFlowmap);
  dom.btnSettings.addEventListener("click", () => showScreen(dom.settingsScreen));
  dom.btnSave.addEventListener("click", () => openSaveLoad("save"));
  dom.btnLoad.addEventListener("click", () => openSaveLoad("load"));

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => hideScreen(document.getElementById(btn.dataset.close)));
  });

  // ---------- バックログ ----------

  function renderBacklog(backlog) {
    dom.backlogList.innerHTML = "";
    backlog.forEach((line, idx) => {
      const div = document.createElement("div");
      div.className = "backlog-line";
      div.innerHTML = `<span class="speaker">${escapeHtml(line.speaker || "")}</span><span class="body">${escapeHtml(line.body)}</span>`;
      // 古いセーブデータ由来のバックログにはsceneId等が無い場合があるため、あるものだけクリック可能にする
      if (line.sceneId) {
        div.classList.add("backlog-line-jumpable");
        div.title = "クリックでこの場面に戻る";
        div.addEventListener("click", () => jumpToBacklogEntry(idx));
      }
      dom.backlogList.appendChild(div);
    });
    dom.backlogList.scrollTop = dom.backlogList.scrollHeight;
  }

  // バックログの行をクリックすると、その行が表示された瞬間の状態（シーン・view・flags）へ戻って再開する。
  // それより先の会話ログは、その時点ではまだ起きていなかったことになるため切り捨てる。
  function jumpToBacklogEntry(index) {
    const entry = engine.backlog[index];
    if (!entry || !entry.sceneId) return;
    clearInterval(engine.typingTimer);
    clearTimeout(engine.autoTimer);
    engine.autoPlay = false;
    dom.btnAuto.dataset.active = "false";
    dom.choiceLayer.classList.add("hidden");
    const truncatedBacklog = engine.backlog.slice(0, index + 1);
    hideScreen(dom.backlogScreen);
    engine.start(entry.sceneId, entry.commandIndex, entry.view, entry.flags, truncatedBacklog);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- 設定 ----------

  document.querySelectorAll('input[name="text-speed"]').forEach((radio) => {
    radio.checked = radio.value === engine.textSpeed;
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      engine.setTextSpeed(radio.value);
      const settings = window.SaveManager.loadSettings();
      settings.textSpeed = radio.value;
      window.SaveManager.saveSettings(settings);
    });
  });

  // 進捗状況のリセット（セーブスロット・分岐マップの記録をすべて削除）。
  // 誤操作防止のため、他の削除操作と同じ2回クリック方式（1回目で警告表示に切り替わり、3秒で自動キャンセル）。
  let resetArmed = false;
  let resetArmedTimer = null;

  function renderResetButton() {
    dom.btnResetProgress.textContent = resetArmed ? "本当に削除しますか？" : "セーブデータをすべて削除";
    dom.btnResetProgress.classList.toggle("armed", resetArmed);
  }

  dom.btnResetProgress.addEventListener("click", () => {
    if (!resetArmed) {
      resetArmed = true;
      clearTimeout(resetArmedTimer);
      resetArmedTimer = setTimeout(() => {
        resetArmed = false;
        renderResetButton();
      }, 3000);
      renderResetButton();
      return;
    }
    resetArmed = false;
    clearTimeout(resetArmedTimer);
    renderResetButton();
    window.SaveManager.resetProgress();
    hideScreen(dom.settingsScreen);
    showTitleScreen();
  });

  // ---------- セーブ/ロード ----------

  let saveLoadMode = "save";
  let armedDeleteIndex = null;
  let armedDeleteTimer = null;

  function openSaveLoad(mode) {
    saveLoadMode = mode;
    dom.saveloadTitle.textContent = mode === "save" ? "セーブ" : "ロード";
    disarmDelete();
    renderSaveSlots();
    showScreen(dom.saveloadScreen);
  }

  function disarmDelete() {
    armedDeleteIndex = null;
    clearTimeout(armedDeleteTimer);
  }

  function renderSaveSlots() {
    const slots = window.SaveManager.getSlots();
    dom.saveSlotList.innerHTML = "";
    slots.forEach((slot, idx) => {
      const div = document.createElement("div");
      div.className = "save-slot";

      const info = document.createElement("span");
      info.className = "slot-info";
      if (slot) {
        info.innerHTML = `<span>スロット ${idx + 1}</span><span>${escapeHtml(slot.savedAt || "")}</span>`;
      } else {
        info.innerHTML = `<span>スロット ${idx + 1}</span><span class="slot-empty">（空）</span>`;
      }
      info.addEventListener("click", () => onSlotClick(idx, slot));
      div.appendChild(info);

      if (slot) {
        const delBtn = document.createElement("button");
        const armed = armedDeleteIndex === idx;
        delBtn.className = "slot-delete" + (armed ? " armed" : "");
        delBtn.textContent = armed ? "本当に削除？" : "削除";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          onSlotDelete(idx);
        });
        div.appendChild(delBtn);
      }

      dom.saveSlotList.appendChild(div);
    });
  }

  function onSlotClick(idx, existing) {
    disarmDelete();
    if (saveLoadMode === "save") {
      window.SaveManager.save(idx, engine.getSnapshot());
      renderSaveSlots();
    } else {
      if (!existing) return;
      hideScreen(dom.saveloadScreen);
      hideScreen(dom.titleScreen);
      showScreen(dom.gameScreen);
      engine.restoreSnapshot(existing);
    }
  }

  function onSlotDelete(idx) {
    if (armedDeleteIndex !== idx) {
      // 1回目のクリック: 誤操作防止のため「本当に削除？」表示に切り替え、数秒で自動的に元に戻す
      armedDeleteIndex = idx;
      clearTimeout(armedDeleteTimer);
      armedDeleteTimer = setTimeout(() => {
        disarmDelete();
        renderSaveSlots();
      }, 3000);
      renderSaveSlots();
      return;
    }
    // 2回目のクリック（3秒以内の再クリック）で実際に削除する
    disarmDelete();
    window.SaveManager.remove(idx);
    renderSaveSlots();
  }

  // ---------- 分岐マップ ----------

  let flowmapScale = 1;

  function openFlowmap() {
    renderFlowmap();
    showScreen(dom.flowmapScreen);
  }

  function renderFlowmap() {
    const progress = window.SaveManager.loadProgress();
    const graph = window.FlowMap.buildVisibleGraph(scenario, progress);
    const completion = window.FlowMap.computeCompletion(scenario, progress);
    const percent = completion.total > 0 ? Math.round((completion.visited / completion.total) * 100) : 0;
    dom.flowmapCompletion.textContent = `達成率: ${completion.visited} / ${completion.total}（${percent}%）`;

    flowmapScale = 1;
    dom.flowmapSvg.style.transform = "scale(1)";
    dom.flowmapSvg.innerHTML = "";

    if (graph.nodes.length === 0) {
      dom.flowmapEmpty.classList.remove("hidden");
      dom.flowmapSvg.setAttribute("width", 0);
      dom.flowmapSvg.setAttribute("height", 0);
      return;
    }
    dom.flowmapEmpty.classList.add("hidden");

    const NS = "http://www.w3.org/2000/svg";
    const PAD = 24;
    const b = graph.bounds;
    const width = b.maxX - b.minX + PAD * 2;
    const height = b.maxY - b.minY + PAD * 2;
    const offsetX = PAD - b.minX;
    const offsetY = PAD - b.minY;

    dom.flowmapSvg.setAttribute("width", width);
    dom.flowmapSvg.setAttribute("height", height);
    dom.flowmapSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    // 現在たどっているルートの矢印（強調表示用）のマーカー定義
    const defs = document.createElementNS(NS, "defs");
    defs.innerHTML =
      '<marker id="fm-arrow-current" viewBox="0 0 10 10" refX="8" refY="5" ' +
      'markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M0,0 L10,5 L0,10 z" class="fm-arrow-current"></path></marker>';
    dom.flowmapSvg.appendChild(defs);

    const positions = {};
    graph.nodes.forEach((n) => {
      positions[n.id] = { x: n.pos.x + offsetX, y: n.pos.y + offsetY };
    });

    // 「現在たどっているルート」の強調用: 記録済みの from を現在地から逆にたどり、
    // 始点から現在地までの経路（ジャンプ前の履歴も含む）を求める。
    const progressPath = window.FlowMap.traceCurrentPath(progress, engine.sceneId);
    const currentNodeSet = new Set(progressPath.scenes);
    const currentEdgeSet = progressPath.edgeKeys;
    const hereSceneId = progressPath.here;

    function edgePathD(edge) {
      const from = positions[edge.from];
      const to = positions[edge.to];
      if (!from || !to) return null;
      const startX = from.x + graph.nodeWidth;
      const startY = from.y + graph.nodeHeight / 2;
      const endX = to.x;
      const endY = to.y + graph.nodeHeight / 2;
      const midX = (startX + endX) / 2;
      return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
    }

    // 通常の辺を先に描画し、現在ルートの辺は最後に描画して常に手前に重なるようにする
    const normalEdges = [];
    const currentEdges = [];
    graph.edges.forEach((edge) => {
      (currentEdgeSet.has(edge.from + "::" + edge.to) ? currentEdges : normalEdges).push(edge);
    });

    normalEdges.forEach((edge) => {
      const d = edgePathD(edge);
      if (!d) return;
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      let cls = "fm-edge";
      if (edge.kind === "jump" || edge.kind === "if") cls += " fm-edge-jump";
      if (edge.conditional) cls += " fm-edge-conditional";
      path.setAttribute("class", cls);
      dom.flowmapSvg.appendChild(path);
    });

    currentEdges.forEach((edge) => {
      const d = edgePathD(edge);
      if (!d) return;
      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d);
      path.setAttribute("class", "fm-edge fm-edge-current");
      path.setAttribute("marker-end", "url(#fm-arrow-current)");
      dom.flowmapSvg.appendChild(path);
    });

    graph.nodes.forEach((n) => {
      const pos = positions[n.id];
      let cls = "fm-node";
      if (n.isEnd) cls += " fm-node-end";
      if (currentNodeSet.has(n.id)) cls += " fm-node-current";
      if (n.id === hereSceneId) cls += " fm-node-here";
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", cls);
      g.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
      g.addEventListener("click", () => jumpToScene(n.id));

      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("width", graph.nodeWidth);
      rect.setAttribute("height", graph.nodeHeight);
      rect.setAttribute("class", "fm-node-rect");
      g.appendChild(rect);

      const text = document.createElementNS(NS, "text");
      text.setAttribute("x", 12);
      text.setAttribute("y", graph.nodeHeight / 2);
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("class", "fm-node-label");
      text.textContent = n.label;
      g.appendChild(text);

      if (n.id === hereSceneId) {
        const hereTag = document.createElementNS(NS, "text");
        hereTag.setAttribute("x", 12);
        hereTag.setAttribute("y", 16);
        hereTag.setAttribute("class", "fm-node-here-label");
        hereTag.textContent = "現在地";
        g.appendChild(hereTag);
      }

      dom.flowmapSvg.appendChild(g);
    });
  }

  function jumpToScene(sceneId) {
    const progress = window.SaveManager.loadProgress();
    const entry = progress.scenes[sceneId];
    if (!entry) return;
    // restoreSnapshotと同じ後始末（タイマー類を止め、選択肢表示中だった場合はそれも隠してからstartする。
    // ここを忘れると、選択肢が出ている状態でマップからジャンプした際に古い選択肢が消えずに残ってしまう）
    clearInterval(engine.typingTimer);
    clearTimeout(engine.autoTimer);
    engine.autoPlay = false;
    dom.btnAuto.dataset.active = "false";
    dom.choiceLayer.classList.add("hidden");
    hideScreen(dom.flowmapScreen);
    hideScreen(dom.titleScreen);
    showScreen(dom.gameScreen);
    engine.start(sceneId, 0, entry.view, entry.flags);
  }

  function adjustFlowmapZoom(delta) {
    flowmapScale = Math.min(2, Math.max(0.4, flowmapScale + delta));
    dom.flowmapSvg.style.transform = `scale(${flowmapScale})`;
  }

  dom.btnFlowmapZoomIn.addEventListener("click", () => adjustFlowmapZoom(0.15));
  dom.btnFlowmapZoomOut.addEventListener("click", () => adjustFlowmapZoom(-0.15));

  // ---------- キーボード ----------

  document.addEventListener("keydown", (e) => {
    if (dom.gameScreen.classList.contains("hidden")) return;
    switch (e.code) {
      case "Enter":
      case "Space":
        e.preventDefault();
        engine.onConfirm();
        break;
      case "ArrowUp":
        engine.moveChoiceSelection(-1);
        break;
      case "ArrowDown":
        engine.moveChoiceSelection(1);
        break;
      case "Escape":
        dom.settingsScreen.classList.toggle("hidden");
        break;
    }
  });

  // ---------- ゲームパッド ----------

  window.GamepadManager.init();
  window.GamepadManager.setHandlers({
    onConfirm: () => { if (!dom.gameScreen.classList.contains("hidden")) engine.onConfirm(); },
    onUp: () => engine.moveChoiceSelection(-1),
    onDown: () => engine.moveChoiceSelection(1),
    onBack: () => {
      if (!dom.backlogScreen.classList.contains("hidden")) {
        hideScreen(dom.backlogScreen);
      } else if (!dom.gameScreen.classList.contains("hidden")) {
        renderBacklog(engine.backlog);
        showScreen(dom.backlogScreen);
      }
    },
    onMenu: () => dom.settingsScreen.classList.toggle("hidden")
  });
})();
