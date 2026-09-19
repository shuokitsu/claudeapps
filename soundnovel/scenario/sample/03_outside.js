// サンプルシナリオ「目覚めの部屋」 第3章: 外へ〜最終選択
//
// scene3 冒頭の @if trust >= 1 で、これまでの信頼度に応じて分岐する。
window.SampleScenarioText += `
@scene scene3
@bg outside.png
@char center -
@char left girl_normal.png
@if trust >= 1 => scene3_trusted
@jump scene3_normal

@scene scene3_trusted
謎の声：あなたのこと、少しだけ信じてみようかしら。
@jump scene3_common

@scene scene3_normal
謎の声：外の空気を吸いましょう。少しは頭もはっきりするはずよ。
@jump scene3_common

@scene scene3_common
主人公：……ここが、外か。
謎の声：ええ。これから先は、もっと長い道のりになるわ。
謎の声：さあ、あなたはこれからどうする？

@choice
彼女についていく => ending_true
そばにいることを申し出る => ending_special [if trust >= 2]
一人で歩き出す => ending_normal
`;
