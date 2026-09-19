// 会話パート（データ + 再生エンジン）

const CHARACTER_INFO = {
  leon: { name: 'レオン', glyph: '王', side: 'self' },
  gareth: { name: 'ガレス', glyph: '重', side: 'other' },
  mirei: { name: 'ミレイ', glyph: '魔', side: 'other' },
  celia: { name: 'セリア', glyph: '僧', side: 'other' },
};

// 各マップの開始前(intro)・クリア後(outro)の会話。
// intro には難易度選択（choice）を付けられる。mod は敵ステータスへの加算補正。
const DIALOGUES = {
  1: {
    intro: {
      lines: [
        { speaker: 'gareth', text: '殿下！ グロム軍が城門を突破しました！' },
        { speaker: 'leon', text: 'くそ、こんなに早く……。父上は？' },
        { speaker: 'gareth', text: '西の塔に避難されております。我々で退路を切り開かねば' },
        { speaker: 'mirei', text: '相手の数はこちらの倍以上よ。真正面からやる気？' },
        { speaker: 'celia', text: '無理をなさらないでください、レオン様……' },
        { speaker: 'leon', text: 'みんなを死なせはしない。だが、道を切り開かなければ王都は終わりだ' },
      ],
      choice: {
        question: 'どう突破する？',
        options: [
          { label: '力で押し切る', mod: { atk: 1, def: 1 }, reply: { speaker: 'leon', text: '正面から行くぞ！ 心して付いてこい' } },
          { label: '隙を突いて進む', mod: { atk: 0, def: 0 }, reply: { speaker: 'leon', text: '音を立てず、隙を突いていく' } },
        ],
      },
    },
    outro: {
      lines: [
        { speaker: 'gareth', text: '殿下、突破成功です。城門の敵は排除しました' },
        { speaker: 'leon', text: 'みんな、よくやってくれた。だが父上と合流するまでは気を抜けない' },
        { speaker: 'mirei', text: '西の塔まではまだ谷を越えないといけないみたいね' },
        { speaker: 'celia', text: '谷間にはグロム軍の別部隊が展開している、と斥候の報告がありました' },
        { speaker: 'leon', text: '厄介だな……。急ぐぞ、父上を一人にはできない' },
      ],
    },
  },
  2: {
    intro: {
      lines: [
        { speaker: 'gareth', text: '谷の向こうに敵の陣が見えます。かなりの数ですな' },
        { speaker: 'mirei', text: '地形は森と山が多いわ。うまく使えば数の差は覆せる' },
        { speaker: 'celia', text: 'レオン様、ここは慎重に……' },
        { speaker: 'leon', text: 'わかっている。だが父上の元へ急がねば' },
      ],
      choice: {
        question: '谷での戦い方は？',
        options: [
          { label: '一気に押し通る', mod: { atk: 1, def: 1 }, reply: { speaker: 'leon', text: '時間が惜しい。一気に抜けるぞ！' } },
          { label: '地形を活かして迎え撃つ', mod: { atk: 0, def: 0 }, reply: { speaker: 'leon', text: '地の利を使わせてもらう' } },
        ],
      },
    },
    outro: {
      lines: [
        { speaker: 'mirei', text: '谷は突破したわね。思ったより手強かったけど' },
        { speaker: 'gareth', text: '殿下、この先が本丸——王都を落としたグロムの本隊です' },
        { speaker: 'celia', text: 'グロムは強力な魔道具を持っているという噂です……' },
        { speaker: 'leon', text: '父上を、そして王都を取り返す。ここで決める' },
      ],
    },
  },
  3: {
    intro: {
      lines: [
        { speaker: 'gareth', text: '殿下、グロムが前方に見えます。総力戦になりますぞ' },
        { speaker: 'mirei', text: '向こうも本気ってわけね。……怖くないと言ったら嘘になるけど' },
        { speaker: 'celia', text: '私たちなら、大丈夫です。ここまで一緒に来ましたから' },
        { speaker: 'leon', text: 'グロム、お前に王都は渡さない。……行くぞ、みんな！' },
      ],
      choice: {
        question: '最後の策は？',
        options: [
          { label: 'グロムを狙い、一気に決める', mod: { atk: 1, def: 1 }, reply: { speaker: 'leon', text: 'グロムだけを見る。決着をつけるぞ' } },
          { label: '陣を立て直し、確実に潰す', mod: { atk: 0, def: 0 }, reply: { speaker: 'leon', text: '一人も失わない。それが俺たちの流儀だ' } },
        ],
      },
    },
    outro: {
      lines: [
        { speaker: 'gareth', text: '殿下……グロム軍、壊滅です。我々の勝利です' },
        { speaker: 'mirei', text: 'はぁ……終わった、のよね？' },
        { speaker: 'celia', text: '陛下も西の塔でご無事とのご報告が届いています' },
        { speaker: 'leon', text: 'みんな、よくやってくれた。……王都に、帰ろう' },
        { speaker: 'gareth', text: 'はっ。王都へ、凱旋を' },
      ],
      ending: true,
    },
  },
};

// --- 再生エンジン ---
// phase: 'lines'（通常の会話行を送っている） -> 'choice'（選択肢待ち） -> 'reply'（選択後の一言） -> 完了

const dialogueState = {
  phase: 'lines',
  lines: null,
  index: 0,
  choice: null,
  selectedMod: { atk: 0, def: 0 },
  onComplete: null,
  leftChar: 'leon',
  rightChar: null,
};

function showDialogueScene(scene, onComplete) {
  dialogueState.phase = 'lines';
  dialogueState.lines = scene.lines;
  dialogueState.index = 0;
  dialogueState.choice = scene.choice || null;
  dialogueState.selectedMod = { atk: 0, def: 0 };
  dialogueState.onComplete = onComplete;
  dialogueState.leftChar = 'leon';
  dialogueState.rightChar = null;
  showScreen('screen-dialogue');
  renderDialogueLine();
}

function finishDialogue() {
  const mod = dialogueState.selectedMod;
  const cb = dialogueState.onComplete;
  dialogueState.onComplete = null;
  if (cb) cb(mod);
}

window.onDialogueNext = function () {
  if (dialogueState.phase === 'choice') return; // 選択肢待ち中は進めない

  dialogueState.index += 1;
  if (dialogueState.index < dialogueState.lines.length) {
    renderDialogueLine();
    return;
  }

  if (dialogueState.phase === 'lines' && dialogueState.choice) {
    dialogueState.phase = 'choice';
    renderDialogueChoices();
    return;
  }

  finishDialogue();
};

window.onDialogueChoiceSelect = function (optionIndex) {
  const option = dialogueState.choice.options[optionIndex];
  dialogueState.selectedMod = option.mod;
  dialogueState.phase = 'reply';
  dialogueState.lines = [option.reply];
  dialogueState.index = 0;
  hideDialogueChoices();
  renderDialogueLine();
};
