// サンプルシナリオ「目覚めの部屋」 第4章: エンディング（3種 × curiosityフラグでの台詞違い = 6パターン）
window.SampleScenarioText += `
@scene ending_true
@bgm theme2.mp3
@char left -
@char center girl_smile.png
@if curiosity => ending_true_curious
謎の声：……そう。なら、案内するわ。ついてきて。
主人公：ああ。
ナレーション：二人は並んで歩き出した。長い物語の、始まりだった。
@end

@scene ending_true_curious
謎の声：……そう。なら、案内するわ。ついてきて。
主人公：さっきの写真……いつか、ちゃんと聞かせてくれ。
謎の声：……ふふ、気が早いのね。でも、いいわ。少しずつ話していきましょう。
ナレーション：二人は並んで歩き出した。積み重なった小さな好奇心が、これからの物語を彩っていく。
@end

@scene ending_special
@bgm theme2.mp3
@char left -
@char center girl_smile.png
@if curiosity => ending_special_curious
謎の声：……あなたがそう言うなら、ずっと一緒にいましょう。
主人公：ああ、約束する。
ナレーション：信頼で結ばれた二人は、離れることなく歩き出した。
@end

@scene ending_special_curious
謎の声：……あなたがそう言うなら、ずっと一緒にいましょう。
主人公：ああ、約束する。それに……あの写真のことも、いつか教えてくれ。
謎の声：……ええ、約束するわ。全部、少しずつね。
ナレーション：信頼と好奇心で結ばれた二人は、離れることなく歩き出した。
@end

@scene ending_normal
@if curiosity => ending_normal_curious
謎の声：……そう。気をつけて。
ナレーション：主人公は一人、見知らぬ道を歩き出した。
@end

@scene ending_normal_curious
謎の声：……そう。気をつけて。
ナレーション：主人公は一人、見知らぬ道を歩き出した。手の中には、あの写真の記憶だけが残っていた。
@end
`;
