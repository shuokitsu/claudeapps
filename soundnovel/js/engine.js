// シナリオJSON（コマンド配列形式）を順番に実行するADVエンジン本体。
// 画像/音声アセットが存在しない場合はプレースホルダー表示にフォールバックする。
window.VNEngine = (function () {

  function VNEngine(scenario, dom, options) {
    this.scenario = scenario;
    this.dom = dom;
    this.options = options || {};
    this.config = window.SystemConfig || {};

    this.sceneId = null;
    this.commandIndex = 0;
    this.mode = "idle"; // 'text' | 'choice' | 'idle'
    this.isTyping = false;
    this.typingTimer = null;
    this.autoPlay = false;
    this.autoTimer = null;
    this.textSpeed = this.config.textSpeedDefault || "typewriter";

    this.view = { bg: null, chars: { left: null, center: null, right: null }, bgm: null };
    this.flags = {};
    this.backlog = [];
    this.choiceOptions = [];
    this.choiceSelected = 0;
    this._lastScene = null; // 分岐マップ用: 直前に「入場」したシーンID（onSceneEnterのfromに使う）

    this.bgmAudio = new Audio();
    this.bgmAudio.loop = true;
  }

  VNEngine.prototype.setTextSpeed = function (speed) {
    this.textSpeed = speed;
  };

  VNEngine.prototype.start = function (sceneId, commandIndex, view, flags, backlog) {
    this.sceneId = sceneId;
    this.commandIndex = commandIndex || 0;
    if (view) {
      this.view = view;
      this.applyView();
    }
    this.flags = flags || {};
    // 新規ゲーム開始・分岐マップからのジャンプではそこまでの会話ログを持たないため空にする。
    // ロード時は restoreSnapshot がセーブデータ自体のバックログを渡してくるので、
    // それを引き継ぐ（＝ロード地点までの実際の会話ログがそのまま表示される）。
    this.backlog = backlog ? backlog.slice() : [];
    // セーブ/バックログジャンプは「表示中の行」の直後に行われる（=その行は引き継いだバックログの
    // 最後に既に入っている）。これから runFrom で再開すると同じ行がもう一度 showText() されて重複するため、
    // 再開位置が showText() を呼ぶコマンド（text / end）なら重複分を1つ取り除いておく。
    const resumeCmd = this.scenario.scenes[sceneId] && this.scenario.scenes[sceneId].commands[this.commandIndex];
    if (this.backlog.length > 0 && resumeCmd && (resumeCmd.type === "text" || resumeCmd.type === "end")) {
      this.backlog.pop();
    }
    this.options.onBacklogUpdate && this.options.onBacklogUpdate(this.backlog);
    // 新規開始・ロード・分岐マップ/バックログからのジャンプはいずれも「実際にプレイでたどった遷移」
    // ではないため、直前シーンからの辺としては記録されないようリセットする。
    // ただし commandIndex>0（シーン途中への再開）の場合は runFrom(0) が呼ばれず
    // onSceneEnter が発火しないため、_lastScene をここで直接「このシーン」にしておかないと、
    // 再開後に最初に起きる本当の遷移の遷移元(from)が失われてしまう（commandIndex===0の場合は
    // このあとの runFrom(0) 内の onSceneEnter が正しく from=null で発火し、_lastSceneも設定される）。
    this._lastScene = this.commandIndex === 0 ? null : sceneId;
    this.runFrom(this.commandIndex);
  };

  VNEngine.prototype.currentScene = function () {
    return this.scenario.scenes[this.sceneId];
  };

  VNEngine.prototype.runFrom = function (index) {
    this.commandIndex = index;
    if (index === 0) {
      // シーンの先頭から実行される＝そのシーンに新規入場した瞬間。
      // if/jump/選択肢確定はすべてsceneIdを書き換えた直後にrunFrom(0)を呼ぶ既存パターンなので、
      // ここ1箇所のフックだけで分岐マップ用の「訪問ノード」「遷移エッジ」を過不足なく記録できる。
      this.options.onSceneEnter && this.options.onSceneEnter({
        from: this._lastScene,
        to: this.sceneId,
        view: this.view,
        flags: this.flags
      });
      this._lastScene = this.sceneId;
    }
    const scene = this.currentScene();
    if (!scene) return;

    while (this.commandIndex < scene.commands.length) {
      const cmd = scene.commands[this.commandIndex];
      const shouldPause = this.executeCommand(cmd);
      if (shouldPause) return; // text/choice/end はユーザー操作待ちで一旦停止
      this.commandIndex++;
    }
  };

  VNEngine.prototype.executeCommand = function (cmd) {
    switch (cmd.type) {
      case "bg":
        this.view.bg = cmd.file;
        this.renderBg();
        return false;
      case "bgm":
        this.view.bgm = cmd.file;
        this.playBgm(cmd.file);
        return false;
      case "se":
        this.playSe(cmd.file);
        return false;
      case "char":
        this.view.chars[cmd.pos] = cmd.file || null;
        this.renderChar(cmd.pos);
        return false;
      case "text":
        this.showText(cmd.speaker, cmd.body);
        return true;
      case "choice":
        this.showChoices(cmd.options);
        return true;
      case "set":
        this.flags[cmd.flag] = cmd.value;
        return false;
      case "add":
        this.flags[cmd.flag] = (Number(this.flags[cmd.flag]) || 0) + cmd.value;
        return false;
      case "if":
        if (this.evaluateCondition(cmd.condition)) {
          this.sceneId = cmd.next;
          this.runFrom(0); // シーンが変わるため呼び出し元のwhileループは継続させず再帰で実行
          return true;
        }
        return false;
      case "jump":
        this.sceneId = cmd.next;
        this.runFrom(0); // シーンが変わるため呼び出し元のwhileループは継続させず再帰で実行
        return true;
      case "end":
        this.showEnding();
        return true;
      default:
        console.warn("未知のコマンド type:", cmd.type);
        return false;
    }
  };

  // ---------- フラグ・条件式 ----------

  // 条件式を評価する。書式: "フラグ名" (truthy判定) / "!フラグ名" (falsy判定) / "フラグ名 op 値"
  VNEngine.prototype.evaluateCondition = function (condition) {
    if (!condition) return true;
    const trimmed = condition.trim();

    if (trimmed.startsWith("!")) {
      return !this.flags[trimmed.slice(1).trim()];
    }

    const m = trimmed.match(/^(\S+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (m) {
      const [, name, op, rawValue] = m;
      const left = this.flags[name];
      const right = window.ScenarioParser.normalizeValue(rawValue);
      switch (op) {
        case "==": return left === right;
        case "!=": return left !== right;
        case ">=": return Number(left) >= Number(right);
        case "<=": return Number(left) <= Number(right);
        case ">": return Number(left) > Number(right);
        case "<": return Number(left) < Number(right);
      }
    }

    return !!this.flags[trimmed];
  };

  // ---------- 表示系 ----------

  VNEngine.prototype.applyView = function () {
    this.renderBg();
    ["left", "center", "right"].forEach((pos) => this.renderChar(pos));
    this.playBgm(this.view.bgm);
  };

  VNEngine.prototype.renderBg = function () {
    const el = this.dom.bgLayer;
    const file = this.view.bg;
    el.textContent = "";
    el.style.backgroundImage = "";
    if (!file) return;

    const path = "assets/images/bg/" + file;
    const img = new Image();
    img.onload = () => { el.style.backgroundImage = `url("${path}")`; };
    img.onerror = () => { el.textContent = "[背景: " + file + "]"; };
    img.src = path;
  };

  VNEngine.prototype.renderChar = function (pos) {
    const el = this.dom.charSlots[pos];
    const file = this.view.chars[pos];
    el.innerHTML = "";
    el.style.backgroundImage = "";

    if (!file) {
      el.classList.remove("visible");
      return;
    }
    el.classList.add("visible");

    const path = "assets/images/characters/" + file;
    const img = new Image();
    img.onload = () => { el.style.backgroundImage = `url("${path}")`; };
    img.onerror = () => {
      const box = document.createElement("div");
      box.className = "placeholder-box";
      box.textContent = file;
      el.appendChild(box);
    };
    img.src = path;
  };

  VNEngine.prototype.playBgm = function (file) {
    if (!file) {
      this.bgmAudio.pause();
      return;
    }
    const path = "assets/bgm/" + file;
    if (this.bgmAudio.src.endsWith(path)) return;
    this.bgmAudio.src = path;
    this.bgmAudio.play().catch(() => {
      console.warn("BGM再生不可（ファイル未配置の可能性）:", file);
    });
  };

  VNEngine.prototype.playSe = function (file) {
    if (!file) return;
    const audio = new Audio("assets/se/" + file);
    audio.play().catch(() => {
      console.warn("SE再生不可（ファイル未配置の可能性）:", file);
    });
  };

  VNEngine.prototype.showText = function (speaker, body) {
    this.mode = "text";
    this.dom.speakerName.textContent = speaker || "";
    this.dom.textBody.textContent = "";
    // sceneId/commandIndex/view/flags を持たせておくことで、バックログのその行をクリックした際に
    // 「その行が表示された瞬間」へジャンプして再開できるようにする（jumpToBacklogEntryが利用）。
    this.backlog.push({
      speaker,
      body,
      sceneId: this.sceneId,
      commandIndex: this.commandIndex,
      view: JSON.parse(JSON.stringify(this.view)),
      flags: JSON.parse(JSON.stringify(this.flags))
    });
    this.options.onBacklogUpdate && this.options.onBacklogUpdate(this.backlog);

    if (this.textSpeed === "instant") {
      this.dom.textBody.textContent = body;
      this.isTyping = false;
      this.onTextFullyShown();
      return;
    }

    this.isTyping = true;
    let i = 0;
    const interval = this.config.typewriterIntervalMs || 30;
    clearInterval(this.typingTimer);
    this.typingTimer = setInterval(() => {
      i++;
      this.dom.textBody.textContent = body.slice(0, i);
      if (i >= body.length) {
        clearInterval(this.typingTimer);
        this.isTyping = false;
        this.onTextFullyShown();
      }
    }, interval);
  };

  VNEngine.prototype.finishTyping = function () {
    clearInterval(this.typingTimer);
    const entry = this.backlog[this.backlog.length - 1];
    this.dom.textBody.textContent = entry ? entry.body : this.dom.textBody.textContent;
    this.isTyping = false;
    this.onTextFullyShown();
  };

  VNEngine.prototype.onTextFullyShown = function () {
    this.waitingAdvance = true;
    if (this.autoPlay) {
      clearTimeout(this.autoTimer);
      this.autoTimer = setTimeout(() => this.proceed(), this.config.autoPlayIntervalMs || 1500);
    }
  };

  VNEngine.prototype.showChoices = function (options) {
    this.mode = "choice";
    this.choiceOptions = options.filter((opt) => this.evaluateCondition(opt.condition));
    if (this.choiceOptions.length === 0) {
      console.warn("すべての選択肢が条件を満たさず非表示になりました。シナリオを確認してください。", options);
    }
    this.choiceSelected = 0;
    clearTimeout(this.autoTimer);
    this.renderChoices();
    this.dom.choiceLayer.classList.remove("hidden");
  };

  VNEngine.prototype.renderChoices = function () {
    const layer = this.dom.choiceLayer;
    layer.innerHTML = "";
    this.choiceOptions.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn" + (idx === this.choiceSelected ? " selected" : "");
      btn.textContent = opt.text;
      btn.addEventListener("click", () => {
        this.choiceSelected = idx;
        this.confirmChoice();
      });
      layer.appendChild(btn);
    });
  };

  VNEngine.prototype.moveChoiceSelection = function (delta) {
    if (this.mode !== "choice") return;
    const len = this.choiceOptions.length;
    this.choiceSelected = (this.choiceSelected + delta + len) % len;
    this.renderChoices();
  };

  VNEngine.prototype.confirmChoice = function () {
    if (this.mode !== "choice") return;
    const opt = this.choiceOptions[this.choiceSelected];
    this.dom.choiceLayer.classList.add("hidden");
    this.mode = "idle";

    if (opt.action === "returnTitle") {
      this.options.onReturnTitle && this.options.onReturnTitle();
      return;
    }
    this.sceneId = opt.next;
    this.runFrom(0);
  };

  VNEngine.prototype.showEnding = function () {
    this.showText("", "－ おわり －");
    // text表示後、ユーザーがconfirmすると下のproceedではなく
    // 専用の選択肢（タイトルへ戻る）を出す
    this._pendingEnding = true;
  };

  VNEngine.prototype.proceed = function () {
    if (this._pendingEnding) {
      this._pendingEnding = false;
      this.showChoices([{ text: "タイトルへ戻る", action: "returnTitle" }]);
      return;
    }
    this.waitingAdvance = false;
    this.commandIndex++;
    this.runFrom(this.commandIndex);
  };

  // ---------- 入力ハンドラ ----------

  VNEngine.prototype.onConfirm = function () {
    if (this.mode === "choice") {
      this.confirmChoice();
      return;
    }
    if (this.isTyping) {
      this.finishTyping();
      return;
    }
    if (this.waitingAdvance) {
      this.proceed();
    }
  };

  VNEngine.prototype.toggleAuto = function () {
    this.autoPlay = !this.autoPlay;
    if (this.autoPlay && this.waitingAdvance && this.mode !== "choice") {
      clearTimeout(this.autoTimer);
      this.autoTimer = setTimeout(() => this.proceed(), this.config.autoPlayIntervalMs || 1500);
    } else {
      clearTimeout(this.autoTimer);
    }
    return this.autoPlay;
  };

  // ---------- セーブ/ロード ----------

  VNEngine.prototype.getSnapshot = function () {
    return {
      sceneId: this.sceneId,
      commandIndex: this.commandIndex,
      view: JSON.parse(JSON.stringify(this.view)),
      flags: JSON.parse(JSON.stringify(this.flags)),
      backlog: JSON.parse(JSON.stringify(this.backlog)),
      textSpeed: this.textSpeed
    };
  };

  VNEngine.prototype.restoreSnapshot = function (snap) {
    clearInterval(this.typingTimer);
    clearTimeout(this.autoTimer);
    this.autoPlay = false;
    this.textSpeed = snap.textSpeed || this.textSpeed;
    this.dom.choiceLayer.classList.add("hidden");
    this.start(snap.sceneId, snap.commandIndex, snap.view, snap.flags, snap.backlog);
  };

  return VNEngine;
})();
