// 分岐マップ（プレイヤー向けフローチャート）のデータ処理。
// scenario-graph.js の解析結果を流用し、プレイヤーが実際にたどった
// シーン・遷移だけを抽出する（scenario-graph.js自体は無改修）。
// DOM描画は持たず、js/main.js 側でこのモジュールの戻り値を使ってSVGを組み立てる。
window.FlowMap = (function () {
  const EDGE_SEP = "::";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // シーンに新規入場するたびに engine.js の onSceneEnter から呼ばれる。
  // 同じシーンへ再訪した場合は最新のview/flagsで上書きする
  // （＝「過去にさかのぼって選び直すまで最後に選択した状態を保持する」を実現）。
  //
  // from（直前シーン）も一緒に記録しておくことで、後から「このシーンにはどこから来たか」を
  // たどって現在地までの経路を逆算できるようにする（マップ/バックログジャンプで
  // 履歴の無いfrom=nullが来た場合は、既存のfromを消さずに残す＝ジャンプ後も
  // それより前の本当の経路を辿れるようにするため）。
  function recordVisit(from, to, view, flags) {
    const progress = window.SaveManager.loadProgress();
    const existing = progress.scenes[to];
    progress.scenes[to] = {
      view: clone(view),
      flags: clone(flags),
      from: from !== null ? from : (existing ? existing.from : null)
    };
    if (from) {
      progress.edges[from + EDGE_SEP + to] = true;
    }
    window.SaveManager.saveProgress(progress);
  }

  // progress.scenes[id].from の連鎖を現在地から逆にたどり、
  // 「これまでに記録されている最新の経路」を始点側から並べて返す。
  function traceCurrentPath(progress, hereSceneId) {
    const scenes = [];
    const edgeKeys = new Set();
    const seen = new Set();
    let cur = hereSceneId;
    while (cur && progress.scenes[cur] && !seen.has(cur)) {
      seen.add(cur);
      scenes.push(cur);
      const from = progress.scenes[cur].from;
      if (from) edgeKeys.add(from + EDGE_SEP + cur);
      cur = from;
    }
    scenes.reverse();
    return { scenes, edgeKeys, here: hereSceneId };
  }

  // そのシーンの最初のセリフを短く切り出してノードのラベルにする（無ければシーンID）
  function sceneLabel(node) {
    const textCmd = node.commands.find((cmd) => cmd.type === "text");
    if (!textCmd) return node.id;
    const label = (textCmd.speaker ? textCmd.speaker + "：" : "") + textCmd.body;
    return label.length > 18 ? label.slice(0, 18) + "…" : label;
  }

  // 訪問済みノード・実際にたどった辺だけを抽出したグラフを返す
  function buildVisibleGraph(scenario, progress) {
    const graph = window.ScenarioGraph.analyze(scenario);
    const layout = window.ScenarioGraph.layout(graph);

    const nodes = Object.keys(progress.scenes)
      .filter((id) => graph.nodes[id] && layout.positions[id])
      .map((id) => ({
        id,
        label: sceneLabel(graph.nodes[id]),
        isEnd: graph.nodes[id].isEnd,
        pos: layout.positions[id]
      }));

    const edges = [];
    nodes.forEach(({ id }) => {
      graph.nodes[id].outgoing.forEach((edge) => {
        const key = id + EDGE_SEP + edge.to;
        if (progress.edges[key] && progress.scenes[edge.to] && layout.positions[edge.to]) {
          edges.push({ from: id, to: edge.to, kind: edge.kind, conditional: !!edge.condition });
        }
      });
    });

    let bounds = null;
    if (nodes.length > 0) {
      bounds = {
        minX: Math.min(...nodes.map((n) => n.pos.x)),
        minY: Math.min(...nodes.map((n) => n.pos.y)),
        maxX: Math.max(...nodes.map((n) => n.pos.x)) + layout.nodeWidth,
        maxY: Math.max(...nodes.map((n) => n.pos.y)) + layout.nodeHeight
      };
    }

    return { nodes, edges, nodeWidth: layout.nodeWidth, nodeHeight: layout.nodeHeight, bounds };
  }

  // 到達可能な全シーンのうち、実際に訪問した割合
  function computeCompletion(scenario, progress) {
    const graph = window.ScenarioGraph.analyze(scenario);
    const reachableIds = Object.keys(graph.nodes).filter((id) => graph.nodes[id].reachable);
    const visited = reachableIds.filter((id) => !!progress.scenes[id]).length;
    return { visited, total: reachableIds.length };
  }

  return { recordVisit, buildVisibleGraph, computeCompletion, traceCurrentPath };
})();
