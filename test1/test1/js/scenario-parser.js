// テキスト形式のシナリオスクリプトを、engine.js が扱うシーン/コマンド構造にパースする。
//
// 書式:
//   # コメント
//   @title タイトル名
//   @scene シーンID          … シーンの開始（ファイル内で最初に登場したシーンが開始シーンになる）
//   @bg ファイル名            … 背景切り替え
//   @bgm ファイル名           … BGM再生・切り替え
//   @se ファイル名            … 効果音再生
//   @char 位置 ファイル名      … 立ち絵表示（位置: left/center/right。ファイル名を省略/"-"で非表示）
//   @set フラグ名 値           … フラグに値を設定（true/false/数値/文字列）
//   @add フラグ名 数値          … フラグ（数値）に加算。未設定時は0として扱う
//   @if 条件 => シーンID       … 条件を満たす場合のみ指定シーンへ遷移。満たさない場合は次の行へ続行
//   @choice                  … 選択肢ブロック開始。以降「文言 => 次シーンID」を空行まで列挙
//                                条件付き選択肢: 「文言 => 次シーンID [if 条件]」（条件を満たさない場合は選択肢自体が表示されない）
//   @jump シーンID            … 指定シーンへ遷移
//   @end                     … シナリオ終了
//   話者：本文                … セリフ（"：" または ":" の前が話者名。省略時はナレーション扱い）
//
// 条件式の書式（@if / 選択肢の [if ...]）:
//   フラグ名                 … フラグが truthy かどうか
//   !フラグ名                … フラグが falsy かどうか
//   フラグ名 == 値 / != / >= / <= / > / <  … 値との比較（数値比較は >= <= > < のみ、==/!=は文字列/真偽値もそのまま比較）
window.ScenarioParser = (function () {

  function parse(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    const scenario = { title: "", start: null, scenes: {} };

    let currentSceneId = null;
    let currentCommands = null;
    let inChoice = false;
    let choiceOptions = null;

    function requireScene(lineNo) {
      if (!currentSceneId) {
        throw new Error(`シナリオ解析エラー: @scene より前にコマンドが記述されています (行 ${lineNo + 1})`);
      }
    }

    function finishChoiceIfNeeded() {
      if (inChoice) {
        currentCommands.push({ type: "choice", options: choiceOptions });
        inChoice = false;
        choiceOptions = null;
      }
    }

    function finishSceneIfNeeded() {
      finishChoiceIfNeeded();
      if (currentSceneId) {
        scenario.scenes[currentSceneId] = { commands: currentCommands };
      }
    }

    lines.forEach((rawLine, lineNo) => {
      const line = rawLine.trim();

      if (line === "") {
        finishChoiceIfNeeded();
        return;
      }
      if (line.startsWith("#")) {
        return;
      }

      if (line.startsWith("@")) {
        finishChoiceIfNeeded();
        const spaceIdx = line.indexOf(" ");
        const directive = spaceIdx === -1 ? line.slice(1) : line.slice(1, spaceIdx);
        const rest = spaceIdx === -1 ? "" : line.slice(spaceIdx + 1).trim();

        switch (directive) {
          case "title":
            scenario.title = rest;
            return;
          case "scene":
            finishSceneIfNeeded();
            currentSceneId = rest;
            currentCommands = [];
            if (scenario.start === null) scenario.start = currentSceneId;
            return;
          case "bg":
            requireScene(lineNo);
            currentCommands.push({ type: "bg", file: normalizeFile(rest) });
            return;
          case "bgm":
            requireScene(lineNo);
            currentCommands.push({ type: "bgm", file: normalizeFile(rest) });
            return;
          case "se":
            requireScene(lineNo);
            currentCommands.push({ type: "se", file: normalizeFile(rest) });
            return;
          case "char": {
            requireScene(lineNo);
            const parts = rest.split(/\s+/);
            const pos = parts[0];
            const file = normalizeFile(parts.slice(1).join(" "));
            currentCommands.push({ type: "char", pos, file });
            return;
          }
          case "set": {
            requireScene(lineNo);
            const spIdx = rest.indexOf(" ");
            const flag = spIdx === -1 ? rest : rest.slice(0, spIdx);
            const valueRaw = spIdx === -1 ? "" : rest.slice(spIdx + 1).trim();
            currentCommands.push({ type: "set", flag, value: normalizeValue(valueRaw) });
            return;
          }
          case "add": {
            requireScene(lineNo);
            const spIdx = rest.indexOf(" ");
            const flag = spIdx === -1 ? rest : rest.slice(0, spIdx);
            const valueRaw = spIdx === -1 ? "1" : rest.slice(spIdx + 1).trim();
            const amount = Number(valueRaw);
            if (isNaN(amount)) {
              console.warn(`シナリオ解析: @add の値が数値ではありません (行 ${lineNo + 1}): ${valueRaw}`);
            }
            currentCommands.push({ type: "add", flag, value: isNaN(amount) ? 0 : amount });
            return;
          }
          case "if": {
            requireScene(lineNo);
            const sepIdx = rest.indexOf("=>");
            if (sepIdx === -1) {
              console.warn(`シナリオ解析: @if の書式が不正です「@if 条件 => シーンID」(行 ${lineNo + 1})`);
              return;
            }
            currentCommands.push({
              type: "if",
              condition: rest.slice(0, sepIdx).trim(),
              next: rest.slice(sepIdx + 2).trim()
            });
            return;
          }
          case "jump":
            requireScene(lineNo);
            currentCommands.push({ type: "jump", next: rest });
            return;
          case "end":
            requireScene(lineNo);
            currentCommands.push({ type: "end" });
            return;
          case "choice":
            requireScene(lineNo);
            inChoice = true;
            choiceOptions = [];
            return;
          default:
            console.warn(`シナリオ解析: 未知のディレクティブ "@${directive}" (行 ${lineNo + 1})`);
            return;
        }
      }

      requireScene(lineNo);

      if (inChoice) {
        const sepIdx = line.indexOf("=>");
        if (sepIdx === -1) {
          console.warn(`シナリオ解析: 選択肢の書式が不正です「文言 => 次シーンID」(行 ${lineNo + 1}): ${line}`);
          return;
        }
        const text = line.slice(0, sepIdx).trim();
        const rightRaw = line.slice(sepIdx + 2).trim();
        const condMatch = rightRaw.match(/^(.+?)\s*\[if\s+(.+)\]$/);
        choiceOptions.push(
          condMatch
            ? { text, next: condMatch[1].trim(), condition: condMatch[2].trim() }
            : { text, next: rightRaw, condition: null }
        );
        return;
      }

      const delimIdx = findSpeakerDelimiter(line);
      if (delimIdx === -1) {
        currentCommands.push({ type: "text", speaker: "", body: line });
      } else {
        currentCommands.push({
          type: "text",
          speaker: line.slice(0, delimIdx).trim(),
          body: line.slice(delimIdx + 1).trim()
        });
      }
    });

    finishSceneIfNeeded();

    if (!scenario.start) {
      throw new Error("シナリオ解析エラー: @scene が1つも定義されていません");
    }
    return scenario;
  }

  function normalizeFile(value) {
    if (!value || value === "-" || value === "none") return null;
    return value;
  }

  // "true"/"false"/数値らしき文字列/引用符付き文字列 をそれぞれ適切な型に変換する（@set の値、条件式の右辺で共用）
  function normalizeValue(raw) {
    const trimmed = String(raw).trim();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed !== "" && !isNaN(Number(trimmed))) return Number(trimmed);
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
    ) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }

  function findSpeakerDelimiter(line) {
    const full = line.indexOf("：");
    const half = line.indexOf(":");
    if (full === -1) return half;
    if (half === -1) return full;
    return Math.min(full, half);
  }

  return { parse, normalizeValue };
})();
