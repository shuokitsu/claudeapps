// サンプルシナリオ「目覚めの部屋」 第2章: 手を取るかどうか〜部屋の探索
//
// この章で使うフラグ: trust（数値、scene2c_hand で更に +1） / curiosity（真偽値、写真を見ると true）
window.SampleScenarioText += `
@scene scene2c_hand
@se select1.mp3
@add trust 1
主人公：……ああ、いいだろう。
謎の声：ありがとう。その温もり、忘れないわ。
@jump scene_room_explore

@scene scene2c_distance
@se select2.mp3
主人公：まだ、お前を信じきれない。
謎の声：……そう。それでも構わないわ。焦らず行きましょう。
@jump scene_room_explore

@scene scene_room_explore
主人公：この部屋、他には何もないのか？
謎の声：机の上に、古い写真が一枚だけ置いてあるはずよ。
主人公：写真……？

@choice
写真をよく見る => scene_room_curious
そのままにしておく => scene_room_incurious

@scene scene_room_curious
@set curiosity true
主人公：……これは、誰だ？
謎の声：さあ、誰かしらね。でも、あなたがそれを気にかけてくれたこと……ちょっと嬉しいわ。
@jump scene3

@scene scene_room_incurious
主人公：今は、それどころじゃない。
謎の声：……そうね。今は、外に出ることを考えましょう。
@jump scene3
`;
