(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";

  let scenario, graph, layoutInfo, reverseEdges;
  let scale = 1, panX = 0, panY = 0;
  let selectedId = null;

  const svg = document.getElementById("graph-svg");
  const viewport = document.createElementNS(SVG_NS, "g");
  viewport.setAttribute("id", "viewport");
  svg.appendChild(viewport);

  function loadScenario() {
    scenario = window.ScenarioParser.parse(window.SampleScenarioText);
    graph = window.ScenarioGraph.analyze(scenario);
    layoutInfo = window.ScenarioGraph.layout(graph);

    reverseEdges = {};
    Object.values(graph.nodes).forEach((node) => {
      node.outgoing.forEach((edge) => {
        if (!reverseEdges[edge.to]) reverseEdges[edge.to] = [];
        reverseEdges[edge.to].push({ from: node.id, label: edge.label, kind: edge.kind });
      });
    });
  }

  function el(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    if (parent) parent.appendChild(node);
    return node;
  }

  function truncate(str, n) {
    if (!str) return "";
    return str.length > n ? str.slice(0, n) + "…" : str;
  }

  function sceneSummary(node) {
    const bg = node.commands.find((c) => c.type === "bg" && c.file);
    const firstText = node.commands.find((c) => c.type === "text");
    const choiceCmd = node.commands.find((c) => c.type === "choice");
    const lines = [];
    if (bg) lines.push(`背景: ${bg.file}`);
    if (firstText) {
      const label = firstText.speaker ? `${firstText.speaker}：` : "";
      lines.push(truncate(label + firstText.body, 22));
    }
    if (choiceCmd) lines.push(`選択肢 ${choiceCmd.options.length}件`);
    return lines;
  }

  function setupDefs() {
    const defs = el("defs", {}, svg);
    const marker = el("marker", {
      id: "arrow", viewBox: "0 0 10 10", refX: "9", refY: "5",
      markerWidth: "8", markerHeight: "8", orient: "auto-start-reverse"
    }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--edge-color)" }, marker);

    const markerMissing = el("marker", {
      id: "arrow-missing", viewBox: "0 0 10 10", refX: "9", refY: "5",
      markerWidth: "8", markerHeight: "8", orient: "auto-start-reverse"
    }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--danger-color)" }, markerMissing);

    const markerCond = el("marker", {
      id: "arrow-conditional", viewBox: "0 0 10 10", refX: "9", refY: "5",
      markerWidth: "8", markerHeight: "8", orient: "auto-start-reverse"
    }, defs);
    el("path", { d: "M0,0 L10,5 L0,10 z", fill: "var(--warning-color)" }, markerCond);
  }

  function bezierPath(sx, sy, tx, ty) {
    const dx = Math.max(60, Math.abs(tx - sx) / 2);
    return `M ${sx},${sy} C ${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`;
  }

  function bezierMidpoint(sx, sy, tx, ty) {
    const dx = Math.max(60, Math.abs(tx - sx) / 2);
    const p1x = sx + dx, p1y = sy;
    const p2x = tx - dx, p2y = ty;
    const t = 0.5;
    const x = Math.pow(1 - t, 3) * sx + 3 * Math.pow(1 - t, 2) * t * p1x + 3 * (1 - t) * t * t * p2x + Math.pow(t, 3) * tx;
    const y = Math.pow(1 - t, 3) * sy + 3 * Math.pow(1 - t, 2) * t * p1y + 3 * (1 - t) * t * t * p2y + Math.pow(t, 3) * ty;
    return { x, y };
  }

  function renderGraph() {
    viewport.innerHTML = "";
    setupDefs();

    const { positions, nodeWidth, nodeHeight } = layoutInfo;

    // edges (先に描いてノードの下に配置)
    Object.values(graph.nodes).forEach((node) => {
      const from = positions[node.id];
      if (!from) return;
      node.outgoing.forEach((edge) => {
        const to = positions[edge.to];
        if (!to) return;
        const sx = from.x + nodeWidth, sy = from.y + nodeHeight / 2;
        const tx = to.x, ty = to.y + nodeHeight / 2;
        let cls = edge.missing ? "edge edge-missing" : `edge edge-${edge.kind}`;
        if (edge.condition && edge.kind === "choice") cls += " edge-conditional";
        const isWarningColored = !edge.missing && (edge.kind === "if" || (edge.condition && edge.kind === "choice"));
        const markerEnd = edge.missing ? "url(#arrow-missing)" : isWarningColored ? "url(#arrow-conditional)" : "url(#arrow)";
        const path = el("path", {
          d: bezierPath(sx, sy, tx, ty),
          class: cls,
          "marker-end": markerEnd,
          "data-from": node.id,
          "data-to": edge.to
        }, viewport);

        if (edge.label) {
          const mid = bezierMidpoint(sx, sy, tx, ty);
          const rawLabel = edge.condition && edge.kind === "choice" ? `${edge.label} [条件]` : edge.label;
          const label = truncate(rawLabel, 18);
          const textWidth = approxTextWidth(label);
          el("rect", {
            x: mid.x - textWidth / 2 - 4, y: mid.y - 8, width: textWidth + 8, height: 16,
            class: "edge-label-bg"
          }, viewport);
          const textEl = el("text", {
            x: mid.x, y: mid.y + 4, class: "edge-label", "text-anchor": "middle"
          }, viewport);
          textEl.textContent = label;
        }
      });
    });

    // missing (未定義) ゴーストノード
    graph.missingTargets.forEach((id) => {
      const pos = positions[id];
      if (!pos) return;
      const g = el("g", { class: "node node-missing", transform: `translate(${pos.x},${pos.y})`, "data-id": id }, viewport);
      el("rect", { width: nodeWidth, height: nodeHeight, rx: 10, class: "node-rect" }, g);
      el("text", { x: 12, y: 24, class: "node-title" }, g).textContent = id;
      el("text", { x: 12, y: 46, class: "node-sub" }, g).textContent = "未定義のシーン";
      g.addEventListener("click", () => selectMissing(id));
    });

    // 通常ノード
    Object.values(graph.nodes).forEach((node) => {
      const pos = positions[node.id];
      if (!pos) return;
      const classes = ["node"];
      if (node.id === graph.start) classes.push("node-start");
      if (node.isEnd) classes.push("node-end");
      if (!node.reachable) classes.push("node-unreachable");
      if (!node.hasTerminal) classes.push("node-warning");
      if (node.id === selectedId) classes.push("node-selected");

      const g = el("g", {
        class: classes.join(" "),
        transform: `translate(${pos.x},${pos.y})`,
        "data-id": node.id
      }, viewport);

      el("rect", { width: nodeWidth, height: nodeHeight, rx: 10, class: "node-rect" }, g);
      el("text", { x: 12, y: 24, class: "node-title" }, g).textContent = node.id;

      const summary = sceneSummary(node);
      summary.slice(0, 3).forEach((line, i) => {
        el("text", { x: 12, y: 44 + i * 18, class: "node-sub" }, g).textContent = line;
      });

      let badgeX = nodeWidth - 12;
      if (node.id === graph.start) {
        badgeX = addBadge(g, badgeX, "開始", "badge-start");
      }
      if (node.isEnd) {
        badgeX = addBadge(g, badgeX, "END", "badge-end");
      }
      if (!node.reachable) {
        badgeX = addBadge(g, badgeX, "未到達", "badge-warning");
      }

      g.addEventListener("click", () => selectNode(node.id));
    });
  }

  function addBadge(g, rightX, label, cls) {
    const w = approxTextWidth(label) + 12;
    el("rect", { x: rightX - w, y: 6, width: w, height: 18, rx: 4, class: `badge ${cls}` }, g);
    el("text", { x: rightX - w / 2, y: 19, class: "badge-text", "text-anchor": "middle" }, g).textContent = label;
    return rightX - w - 6;
  }

  function approxTextWidth(str) {
    // 等幅換算の概算（日本語混在テキストの簡易幅計算）
    let w = 0;
    for (const ch of str) w += /[\x00-\xff]/.test(ch) ? 7 : 14;
    return w;
  }

  // ---------- 選択・詳細パネル ----------

  function selectNode(id) {
    selectedId = id;
    renderGraph();
    renderDetail(id);
  }

  function selectMissing(id) {
    selectedId = null;
    renderGraph();
    const box = document.getElementById("detail-content");
    box.innerHTML = "";
    const p = document.createElement("p");
    p.className = "detail-warning";
    p.textContent = `シーン "${id}" は選択肢/jumpの遷移先として参照されていますが、シナリオ内に定義されていません。`;
    box.appendChild(p);
  }

  function renderDetail(id) {
    const node = graph.nodes[id];
    const box = document.getElementById("detail-content");
    box.innerHTML = "";
    if (!node) return;

    const title = document.createElement("h3");
    title.textContent = id;
    box.appendChild(title);

    const incoming = reverseEdges[id] || [];
    const incomingP = document.createElement("p");
    incomingP.className = "detail-meta";
    incomingP.textContent = incoming.length
      ? "遷移元: " + incoming.map((e) => `${e.from}${e.label ? `(${e.label})` : ""}`).join(" / ")
      : (id === graph.start ? "（開始シーン）" : "遷移元なし");
    box.appendChild(incomingP);

    const list = document.createElement("ul");
    list.className = "command-list";
    node.commands.forEach((cmd) => {
      const li = document.createElement("li");
      li.className = `command-item command-${cmd.type}`;
      li.textContent = formatCommand(cmd);
      list.appendChild(li);
    });
    box.appendChild(list);
  }

  function formatCommand(cmd) {
    switch (cmd.type) {
      case "bg": return `[背景] ${cmd.file || "(なし)"}`;
      case "bgm": return `[BGM] ${cmd.file || "(停止)"}`;
      case "se": return `[効果音] ${cmd.file}`;
      case "char": return `[立ち絵:${cmd.pos}] ${cmd.file || "(非表示)"}`;
      case "text": return (cmd.speaker ? `${cmd.speaker}：` : "（ナレーション）") + cmd.body;
      case "choice": return "[選択肢] " + cmd.options.map((o) =>
        `「${o.text}」→${o.next}${o.condition ? ` (条件: ${o.condition})` : ""}`
      ).join(" / ");
      case "jump": return `[jump] → ${cmd.next}`;
      case "set": return `[set] ${cmd.flag} = ${JSON.stringify(cmd.value)}`;
      case "add": return `[add] ${cmd.flag} += ${cmd.value}`;
      case "if": return `[if] ${cmd.condition} → ${cmd.next}`;
      case "end": return "[end] シナリオ終了";
      default: return `[${cmd.type}]`;
    }
  }

  // ---------- 警告パネル ----------

  function renderWarnings() {
    const list = document.getElementById("warnings-list");
    const countEl = document.getElementById("warnings-count");
    list.innerHTML = "";
    countEl.textContent = graph.warnings.length ? `(${graph.warnings.length})` : "(0)";

    if (graph.warnings.length === 0) {
      const li = document.createElement("li");
      li.className = "warning-none";
      li.textContent = "警告はありません";
      list.appendChild(li);
      return;
    }

    graph.warnings.forEach((w) => {
      const li = document.createElement("li");
      li.className = `warning-item warning-${w.type}`;
      li.textContent = w.message;
      li.addEventListener("click", () => {
        if (graph.nodes[w.sceneId]) {
          selectNode(w.sceneId);
          focusOn(w.sceneId);
        } else {
          selectMissing(w.sceneId);
          focusOn(w.sceneId);
        }
      });
      list.appendChild(li);
    });
  }

  // ---------- フラグパネル ----------

  function renderFlags() {
    const list = document.getElementById("flags-list");
    const countEl = document.getElementById("flags-count");
    list.innerHTML = "";
    countEl.textContent = `(${graph.flags.length})`;

    if (graph.flags.length === 0) {
      const li = document.createElement("li");
      li.className = "flag-none";
      li.textContent = "このシナリオはフラグを使用していません";
      list.appendChild(li);
      return;
    }

    graph.flags.forEach((flag) => {
      const li = document.createElement("li");
      li.className = "flag-item";
      const name = document.createElement("div");
      name.className = "flag-name";
      name.textContent = flag.name;
      li.appendChild(name);

      const setters = document.createElement("div");
      setters.className = "flag-meta";
      setters.textContent = "設定: " + (flag.setters.length ? flag.setters.join(", ") : "なし");
      li.appendChild(setters);

      const readers = document.createElement("div");
      readers.className = "flag-meta";
      readers.textContent = "参照: " + (flag.readers.length ? flag.readers.join(", ") : "なし");
      li.appendChild(readers);

      list.appendChild(li);
    });
  }

  // ---------- パン・ズーム ----------

  function applyTransform() {
    viewport.setAttribute("transform", `translate(${panX},${panY}) scale(${scale})`);
  }

  function fitView() {
    const pane = document.getElementById("graph-pane");
    const w = pane.clientWidth, h = pane.clientHeight;
    const gw = layoutInfo.width, gh = layoutInfo.height;
    scale = Math.min(w / gw, h / gh, 1.1);
    scale = Math.max(scale, 0.15);
    panX = (w - gw * scale) / 2;
    panY = (h - gh * scale) / 2;
    applyTransform();
  }

  function focusOn(id) {
    const pos = layoutInfo.positions[id];
    if (!pos) return;
    const pane = document.getElementById("graph-pane");
    const w = pane.clientWidth, h = pane.clientHeight;
    panX = w / 2 - (pos.x + layoutInfo.nodeWidth / 2) * scale;
    panY = h / 2 - (pos.y + layoutInfo.nodeHeight / 2) * scale;
    applyTransform();
  }

  function setupPanZoom() {
    let panning = false, startX = 0, startY = 0, startPanX = 0, startPanY = 0;

    svg.addEventListener("mousedown", (e) => {
      if (e.target.closest(".node")) return;
      panning = true;
      startX = e.clientX; startY = e.clientY;
      startPanX = panX; startPanY = panY;
      svg.classList.add("panning");
    });
    window.addEventListener("mousemove", (e) => {
      if (!panning) return;
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      applyTransform();
    });
    window.addEventListener("mouseup", () => {
      panning = false;
      svg.classList.remove("panning");
    });

    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newScale = Math.min(3, Math.max(0.1, scale * factor));
      panX = cx - ((cx - panX) / scale) * newScale;
      panY = cy - ((cy - panY) / scale) * newScale;
      scale = newScale;
      applyTransform();
    }, { passive: false });

    document.getElementById("btn-fit").addEventListener("click", fitView);
    document.getElementById("btn-zoom-in").addEventListener("click", () => {
      scale = Math.min(3, scale * 1.2);
      applyTransform();
    });
    document.getElementById("btn-zoom-out").addEventListener("click", () => {
      scale = Math.max(0.1, scale / 1.2);
      applyTransform();
    });
  }

  // ---------- 初期化 ----------

  function renderStats() {
    document.getElementById("scenario-title").textContent = graph.title || "(タイトル未設定)";
    const sceneCount = Object.keys(graph.nodes).length;
    const endCount = Object.values(graph.nodes).filter((n) => n.isEnd).length;
    document.getElementById("stats").textContent =
      `シーン数: ${sceneCount} / エンディング数: ${endCount} / 警告: ${graph.warnings.length}件`;
  }

  loadScenario();
  renderStats();
  renderGraph();
  renderWarnings();
  renderFlags();
  setupPanZoom();

  window.addEventListener("resize", fitView);
  requestAnimationFrame(fitView);
})();
