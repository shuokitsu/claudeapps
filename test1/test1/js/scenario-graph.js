// パース済みシナリオ（scenario-parser.jsの出力）を解析し、
// デバッグビューア（debug.html）で描画するためのグラフ構造・自動レイアウトを計算する。
window.ScenarioGraph = (function () {

  function analyze(scenario) {
    const sceneIds = Object.keys(scenario.scenes);
    const nodes = {};

    sceneIds.forEach((id) => {
      nodes[id] = {
        id,
        commands: scenario.scenes[id].commands,
        outgoing: [],
        isEnd: false,
        hasTerminal: false,
        reachable: false,
        depth: null
      };
    });

    const warnings = [];
    const missingTargetSet = new Set();
    const flagUsage = {};

    function touchFlag(name) {
      if (!flagUsage[name]) flagUsage[name] = { setters: new Set(), readers: new Set() };
      return flagUsage[name];
    }

    sceneIds.forEach((id) => {
      const node = nodes[id];
      node.commands.forEach((cmd) => {
        if (cmd.type === "choice") {
          node.hasTerminal = true;
          cmd.options.forEach((opt) => {
            const exists = !!scenario.scenes[opt.next];
            node.outgoing.push({
              to: opt.next, label: opt.text, kind: "choice", missing: !exists, condition: opt.condition
            });
            if (!exists) missingTargetSet.add(opt.next);
            if (opt.condition) touchFlag(extractFlagName(opt.condition)).readers.add(id);
          });
        } else if (cmd.type === "jump") {
          node.hasTerminal = true;
          const exists = !!scenario.scenes[cmd.next];
          node.outgoing.push({ to: cmd.next, label: "jump", kind: "jump", missing: !exists });
          if (!exists) missingTargetSet.add(cmd.next);
        } else if (cmd.type === "if") {
          // @if は条件を満たさない場合に次の行へ続行するため、これ単体では終端(hasTerminal)にはならない
          const exists = !!scenario.scenes[cmd.next];
          node.outgoing.push({
            to: cmd.next, label: cmd.condition, kind: "if", missing: !exists, condition: cmd.condition
          });
          if (!exists) missingTargetSet.add(cmd.next);
          touchFlag(extractFlagName(cmd.condition)).readers.add(id);
        } else if (cmd.type === "set" || cmd.type === "add") {
          touchFlag(cmd.flag).setters.add(id);
        } else if (cmd.type === "end") {
          node.hasTerminal = true;
          node.isEnd = true;
        }
      });

      if (!node.hasTerminal) {
        warnings.push({
          type: "no-terminal",
          sceneId: id,
          message: `シーン "${id}" に @choice / @jump / @end のいずれもありません（進行が途中で止まります）`
        });
      }
    });

    // 開始シーンからのBFSで到達可能性・階層(depth)を計算
    if (nodes[scenario.start]) {
      nodes[scenario.start].reachable = true;
      nodes[scenario.start].depth = 0;
      const queue = [scenario.start];
      let qi = 0;
      while (qi < queue.length) {
        const cur = queue[qi++];
        const node = nodes[cur];
        node.outgoing.forEach((edge) => {
          const target = nodes[edge.to];
          if (target && !target.reachable) {
            target.reachable = true;
            target.depth = node.depth + 1;
            queue.push(edge.to);
          }
        });
      }
    }

    sceneIds.forEach((id) => {
      if (!nodes[id].reachable) {
        warnings.push({
          type: "unreachable",
          sceneId: id,
          message: `シーン "${id}" は開始シーンから到達できません（孤立している可能性があります）`
        });
      }
    });

    const missingTargets = Array.from(missingTargetSet);
    missingTargets.forEach((id) => {
      warnings.push({
        type: "missing-target",
        sceneId: id,
        message: `未定義のシーン "${id}" が選択肢/jumpの遷移先として参照されています`
      });
    });

    const flags = Object.keys(flagUsage)
      .sort()
      .map((name) => ({
        name,
        setters: Array.from(flagUsage[name].setters),
        readers: Array.from(flagUsage[name].readers)
      }));

    return {
      title: scenario.title,
      start: scenario.start,
      nodes,
      missingTargets,
      warnings,
      flags
    };
  }

  // 条件式（"flag" / "!flag" / "flag op value"）からフラグ名部分だけを取り出す
  function extractFlagName(condition) {
    if (!condition) return "";
    const trimmed = condition.trim();
    if (trimmed.startsWith("!")) return trimmed.slice(1).trim();
    const m = trimmed.match(/^(\S+)\s*(==|!=|>=|<=|>|<)/);
    return m ? m[1] : trimmed;
  }

  function layout(graph) {
    const COL_W = 300;
    const ROW_H = 150;
    const PAD_X = 70;
    const PAD_Y = 60;

    const allNodes = Object.values(graph.nodes);
    let maxDepth = 0;
    allNodes.forEach((n) => {
      if (n.depth !== null && n.depth > maxDepth) maxDepth = n.depth;
    });
    const unreachableCol = maxDepth + 1;
    const missingCol = unreachableCol + 1;

    const byCol = {};
    allNodes.forEach((n) => {
      const col = n.depth === null ? unreachableCol : n.depth;
      if (!byCol[col]) byCol[col] = [];
      byCol[col].push(n);
    });

    const positions = {};
    Object.keys(byCol).forEach((col) => {
      byCol[col]
        .sort((a, b) => a.id.localeCompare(b.id))
        .forEach((n, i) => {
          positions[n.id] = {
            x: PAD_X + Number(col) * COL_W,
            y: PAD_Y + i * ROW_H,
            col: Number(col)
          };
        });
    });

    graph.missingTargets.forEach((id, i) => {
      positions[id] = { x: PAD_X + missingCol * COL_W, y: PAD_Y + i * ROW_H, col: missingCol, ghost: true };
    });

    const usedCols = Object.keys(byCol).map(Number);
    if (graph.missingTargets.length > 0) usedCols.push(missingCol);
    const maxCol = Math.max(0, ...usedCols);
    const maxRows = Math.max(
      1,
      ...Object.values(byCol).map((arr) => arr.length),
      graph.missingTargets.length
    );

    return {
      positions,
      nodeWidth: 240,
      nodeHeight: 108,
      width: PAD_X * 2 + (maxCol + 1) * COL_W,
      height: PAD_Y * 2 + maxRows * ROW_H
    };
  }

  return { analyze, layout };
})();
