// サンプルシナリオ「目覚めの部屋」 第1章: 目覚め〜信頼度フラグの最初の分岐
//
// シナリオは複数のJSファイルに分割できる。各ファイルは window.SampleScenarioText に
// テキストを追記(+=)していくだけでよい。最初のファイルだけ「=」で初期化し、
// 以降のファイルは必ず「+=」で追記すること（初期化してしまうと前の章が消える）。
// 読み込み順は index.html / debug.html の <script> タグの並び順で決まるので、
// 章を追加・並び替えた場合は両方のHTMLを更新すること。
//
// この章で使うフラグ: trust（数値） … scene2a を選ぶと @add trust 1
window.SampleScenarioText = `
@title 目覚めの部屋

@scene scene1
@bg room.png
@bgm theme1.mp3
@char center girl_normal.png
謎の声：……やっと目を覚ましたのね。
主人公：ここは……どこだ？
謎の声：質問に答える前に、まずあなたが何者か知りたいわ。

@choice
「誰だ？」と尋ねる => scene2a
黙って様子を見る => scene2b

@scene scene2a
@se select1.mp3
@add trust 1
主人公：……お前は誰だ？
謎の声：警戒するのね。賢い選択だわ。
@jump scene2_common

@scene scene2b
@se select2.mp3
主人公：……。
謎の声：無言、か。それもまた一つの答えね。
@jump scene2_common

@scene scene2_common
謎の声：ここがどこか、あなたが誰なのか……今はまだ、うまく話せないの。ごめんなさい。
主人公：じゃあ、何ができる？
謎の声：一緒に歩いてくれるなら、少しずつ思い出させてあげられるかもしれない。
謎の声：……手を、貸してくれる？

@choice
手を差し出す => scene2c_hand
少し距離を置いて様子を見る => scene2c_distance
`;
