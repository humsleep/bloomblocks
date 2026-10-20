// R4 B — "Where the great lantern went" (docs/team/r4-village-story-rewards.md §1–§2): seven chapters, one per
// resident (Wick last), three pages each, read in the village storybook (printed in the UI face, so the letter
// fonts' subsets stay as they are). Pages open in order:
//   1  the resident has moved in            (Wick: 3 other chapters complete)
//   2  friendship 2 with the resident       (Wick: all 6 other chapters complete)
//   3  its furniture set was completed once (v.cz setBit — a page never closes again)
// Read pages = synced bits v.st (chapter × 3 + page). Pure: rules + text; the scene draws them.
// The 8 non-en/ko texts are AI drafts (owner 2026-10-18: back-translation QA instead of native review).
import type { Lang } from "../a11y/strings.ts";
import type { ResidentId } from "./catalog.ts";
import { FRIEND_LEVELS, type ResidentState } from "./model.ts";
import type { Bits } from "./vstate.ts";

export const CHAPTERS: readonly ResidentId[] = ["momo", "sage", "luna", "pip", "kuri", "yuki", "wick"];
/** v.st bit of a page */
export const pageBit = (chapter: number, page: number): number => chapter * 3 + page;
/** v.cz bit: this resident's set was completed at least once (R4 C → B) */
export const setBit = (residentIndex: number): number => 20 + residentIndex;

export type Hint = { kind: "moveIn" } | { kind: "friend"; n: number } | { kind: "set" } | { kind: "chapters"; n: number } | { kind: "later" };
export interface PageState {
  open: boolean;
  read: boolean;
  /** what opens it (locked pages only) */
  hint: Hint | null;
}

/** Every page's state, chapter by chapter (CHAPTERS order). */
export function storyState(rs: readonly ResidentState[], cz: Bits, st: Bits): PageState[][] {
  const czs = new Set(cz);
  const read = new Set(st);
  const byId = new Map(rs.map((r) => [r.r.id, r]));
  const out: PageState[][] = [];
  const page = (c: number, p: number, open: boolean, hint: Hint): PageState => ({ open, read: open && read.has(pageBit(c, p)), hint: open ? null : hint });
  CHAPTERS.slice(0, 6).forEach((id, c) => {
    const r = byId.get(id);
    const moved = !!r?.movedIn;
    const p1 = moved;
    const p2 = p1 && (r?.friendship ?? 0) >= 2;
    const p3 = p2 && !!r && czs.has(setBit(r.r.index));
    const left = Math.max(1, FRIEND_LEVELS[2] - (r?.points ?? 0));
    // only the next page to open says how; the ones after it just wait ("later")
    out.push([page(c, 0, p1, { kind: "moveIn" }), page(c, 1, p2, p1 ? { kind: "friend", n: left } : { kind: "later" }), page(c, 2, p3, p2 ? { kind: "set" } : { kind: "later" })]);
  });
  const done = out.filter((ch) => ch[2]!.open).length;
  const wick = byId.get("wick");
  const w1 = done >= 3;
  const w2 = done >= 6;
  const w3 = w2 && !!wick && czs.has(setBit(wick.r.index));
  out.push([page(6, 0, w1, { kind: "chapters", n: 3 - done }), page(6, 1, w2, w1 ? { kind: "chapters", n: 6 - done } : { kind: "later" }), page(6, 2, w3, w2 ? { kind: "set" } : { kind: "later" })]);
  return out;
}

/** Open pages not read yet (the storybook's amber dot). */
export const unreadPages = (s: readonly PageState[][]): number => s.flat().filter((p) => p.open && !p.read).length;

// ---------------------------------------------------------------- text

interface StoryText {
  ui: { book: string; question: string; chapter: string; pages: string; moveIn: string; friend: string; set: string; chapters: string; list: string; caption: string; dotNew: string };
  title: Record<ResidentId, string>;
  pages: Record<ResidentId, readonly [string, string, string]>;
}

const EN: StoryText = {
  ui: {
    book: "Storybook", question: "Why did the great lantern go dark?", chapter: "Chapter {n}", pages: "{read} of 3 pages",
    moveIn: "Opens when {name} moves in", friend: "Talk with {name} on {n} more days", set: "Complete {name}'s set: {items}",
    chapters: "Finish {n} more chapters", list: "All chapters", caption: "Story", dotNew: "Storybook: a new page",
  },
  title: { momo: "The Night the Bell Stopped", sage: "Seeds Under the Tower", luna: "A Map of Stars", pip: "The Smallest Spark", kuri: "Yarn for the Bell", yuki: "First Snow on the Tower", wick: "Where the Great Light Went" },
  pages: {
    momo: [
      "Long ago, the great lantern on the tower lit all of Duskwick. Then one winter night it went dark, and I hid behind a teapot until morning.",
      "I was scared, but I wasn't alone. Someone had left a small warm light by my door. I never found out who.",
      "Clue: that night, the tower bell stopped ringing. The silence was the loudest thing I ever heard.",
    ],
    sage: [
      "When the light went out, I stayed in the garden under the tower. Someone had to look after the seeds.",
      "The seeds slept all winter. So did I, mostly. But I kept one eye open for the light.",
      "Clue: the oil wasn't empty. I checked. The flame didn't die. It split into pieces and flew away, like dandelion fluff.",
    ],
    luna: [
      "I draw the sky every night. On my oldest star map, the tower is the brightest star of all.",
      "On the map from that winter, the tower star is gone. But dozens of tiny new stars appear all over the village.",
      "Clue: the great lantern can't be lit by one flame alone. The map says it needs many small lights, together.",
    ],
    pip: [
      "I'm the smallest! So when the sparks flew, I only caught a teeny one. It's still in my lantern!",
      "My spark is the same colour as Momo's, and Sage's, and everyone's. Funny, right? Like we're all cousins!",
      "Clue: every lantern in Duskwick holds a spark of the same colour. All the little lights came from one big light.",
    ],
    kuri: [
      "I'm knitting a very long rope. It's a secret for now. It's for the bell on the tower.",
      "The old rope wore out that winter. Without it the bell couldn't ring, and nobody could find their way home.",
      "Clue: when the bell rings again, every spark will know the way back to the tower. My rope is almost done.",
    ],
    yuki: [
      "I like the first snow. It makes everything quiet, as if the whole village is listening.",
      "On the first snow of that winter, I saw someone small on top of the tower, giving away light, one spark at a time.",
      "Clue: that someone's flame was exactly the colour of the great lantern. I think you know who it was.",
    ],
    wick: [
      "You've been listening to everyone's stories, haven't you? Then it's time I told you mine.",
      "That winter was so cold. The houses were dark and everyone was shivering. So I gave my light away, a spark for each home.",
      "I was the great lantern. Now the light lives in every house you lit. If we all give a little back, maybe the tower can shine again. Will you help?",
    ],
  },
};

const KO: StoryText = {
  ui: {
    book: "이야기책", question: "큰 등불은 왜 꺼졌을까?", chapter: "{n}장", pages: "3쪽 중 {read}쪽",
    moveIn: "{name}의 이사 후에 열려요", friend: "{name}에게 {n}일 더 말 걸기", set: "{name}의 세트 완성하기: {items}",
    chapters: "다른 이야기 {n}장 더 완성하기", list: "모든 장", caption: "이야기", dotNew: "이야기책: 새 쪽",
  },
  title: { momo: "종이 멈춘 밤", sage: "탑 아래의 씨앗", luna: "별 지도", pip: "가장 작은 불씨", kuri: "종을 위한 실", yuki: "탑 위의 첫눈", wick: "큰 등불이 간 곳" },
  pages: {
    momo: [
      "옛날에는 탑 꼭대기의 큰 등불이 더스크윅 전체를 밝혔어요. 그런데 어느 겨울밤 불이 꺼졌고, 저는 아침까지 찻주전자 뒤에 숨어 있었어요.",
      "무서웠지만 혼자는 아니었어요. 누군가 제 문 앞에 작고 따뜻한 불을 두고 갔거든요. 누군지는 끝내 몰랐어요.",
      "단서: 그날 밤, 탑의 종소리가 멈췄어요. 그 조용함이 제가 들어 본 소리 중에 가장 컸어요.",
    ],
    sage: [
      "불이 꺼졌을 때 저는 탑 아래 정원에 남았어요. 누군가는 씨앗을 돌봐야 했으니까요.",
      "씨앗들은 겨울 내내 잤어요. 저도 거의 잤고요. 그래도 한쪽 눈은 불빛을 기다리며 뜨고 있었어요.",
      "단서: 기름은 비지 않았어요. 제가 확인했어요. 불꽃은 꺼진 게 아니라 민들레 씨처럼 여러 조각으로 흩어져 날아갔어요.",
    ],
    luna: [
      "저는 밤마다 하늘을 그려요. 제일 오래된 별 지도에서는 탑이 가장 밝은 별이에요.",
      "그 겨울의 지도에는 탑 별이 없어요. 대신 마을 곳곳에 작은 새 별이 수십 개 생겼어요.",
      "단서: 큰 등불은 불꽃 하나로는 켜지지 않아요. 지도에 따르면 작은 불빛 여러 개가 함께 있어야 해요.",
    ],
    pip: [
      "저는 제일 작아요! 그래서 불씨가 날아올 때 아주 쪼끄만 거 하나만 잡았어요. 아직 제 등불 안에 있어요!",
      "제 불씨는 모모랑, 세이지랑, 모두랑 색이 똑같아요. 신기하죠? 우리 다 사촌인가 봐요!",
      "단서: 더스크윅의 모든 등불 안에는 같은 색 불씨가 있어요. 작은 불빛들은 모두 하나의 큰 불에서 왔어요.",
    ],
    kuri: [
      "저는 아주 긴 밧줄을 뜨고 있어요. 아직은 비밀이에요. 탑에 있는 종을 위한 거예요.",
      "그 겨울에 낡은 종 줄이 닳아 끊어졌어요. 종이 울리지 않으니 아무도 집 가는 길을 찾지 못했어요.",
      "단서: 종이 다시 울리면 모든 불씨가 탑으로 돌아가는 길을 알게 돼요. 제 밧줄도 거의 다 됐어요.",
    ],
    yuki: [
      "저는 첫눈이 좋아요. 첫눈이 오면 마을 전체가 귀를 기울이는 것처럼 조용해져요.",
      "그 겨울 첫눈이 오던 날, 탑 꼭대기에서 작은 누군가를 봤어요. 불씨를 하나씩 나눠 주고 있었어요.",
      "단서: 그 누군가의 불꽃은 큰 등불과 똑같은 색이었어요. 누구인지 알 것 같죠?",
    ],
    wick: [
      "모두의 이야기를 들어 줬군요. 그럼 이제 제 이야기를 할 차례예요.",
      "그 겨울은 정말 추웠어요. 집들은 어둡고 다들 떨고 있었죠. 그래서 제 불을 나눠 줬어요. 집마다 불씨 하나씩.",
      "제가 그 큰 등불이었어요. 이제 그 빛은 당신이 밝힌 집집마다 살아요. 모두가 조금씩 돌려준다면 탑이 다시 빛날지도 몰라요. 도와줄래요?",
    ],
  },
};

const JA: StoryText = {
  ui: {
    book: "おはなしの本", question: "大きなランタンは、なぜ消えたの？", chapter: "第{n}章", pages: "3ページ中{read}ページ",
    moveIn: "{name}が引っこしてくると開きます", friend: "あと{n}日、{name}とおしゃべりする", set: "{name}のセットをそろえる：{items}",
    chapters: "ほかのお話をあと{n}章読む", list: "すべての章", caption: "おはなし", dotNew: "おはなしの本：新しいページ",
  },
  title: { momo: "鐘が止まった夜", sage: "塔の下のたね", luna: "星の地図", pip: "いちばん小さな火の粉", kuri: "鐘のための糸", yuki: "塔の上の初雪", wick: "大きな光のゆくえ" },
  pages: {
    momo: [
      "むかし、塔の上の大きなランタンがDuskwickじゅうを照らしていました。ある冬の夜にその光が消えて、わたしは朝までティーポットのかげにかくれていました。",
      "こわかったけれど、ひとりじゃありませんでした。だれかが、わたしの戸口に小さくてあたたかい光を置いていってくれたんです。だれだったのかは、今もわかりません。",
      "手がかり：あの夜、塔の鐘の音が止まりました。あの静けさは、今まで聞いたどんな音より大きかったです。",
    ],
    sage: [
      "光が消えたとき、ぼくは塔の下の庭にのこりました。だれかがたねの世話をしなくちゃいけなかったから。",
      "たねは冬のあいだずっとねむっていました。ぼくもほとんどねていました。でも片目だけは、光を待ってあけていました。",
      "手がかり：油はからっぽじゃなかった。ぼく、たしかめたんです。炎は消えたんじゃなくて、たんぽぽの綿毛みたいにばらばらになって飛んでいきました。",
    ],
    luna: [
      "わたしは毎晩、空を描いています。いちばん古い星の地図では、塔がいちばん明るい星です。",
      "あの冬の地図には、塔の星がありません。そのかわり、村のあちこちに小さな新しい星が何十も現れています。",
      "手がかり：大きなランタンは、ひとつの炎だけでは灯りません。地図によると、小さな光がたくさん、いっしょに必要なんです。",
    ],
    pip: [
      "ピピはいちばん小さいの！だから火の粉が飛んできたとき、ちっちゃいのをひとつだけつかまえたんだ。今もピピのランタンの中にあるよ！",
      "ピピの火の粉はモモのとも、セージのとも、みんなのとも同じ色なの。ふしぎでしょ？みんな、いとこなのかも！",
      "手がかり：Duskwickのランタンには、みんな同じ色の火の粉が入っています。小さな光は、みんなひとつの大きな光から来たんです。",
    ],
    kuri: [
      "とっても長いロープを編んでいるの。まだないしょよ。塔の鐘のためのものなの。",
      "あの冬、古い鐘のロープがすり切れてしまったの。鐘が鳴らなくて、だれもおうちへの道がわからなくなったのよ。",
      "手がかり：鐘がもう一度鳴れば、火の粉たちはみんな塔へ帰る道がわかるはず。わたしのロープも、もうすぐできあがるわ。",
    ],
    yuki: [
      "初雪がすき。村じゅうが耳をすましているみたいに、しずかになるから。",
      "あの冬の初雪の日、塔のてっぺんに小さなだれかを見たの。火の粉をひとつずつ、くばっていた。",
      "手がかり：そのだれかの炎は、大きなランタンとまったく同じ色だった。だれだか、わかるよね？",
    ],
    wick: [
      "みんなのお話を聞いてくれたんですね。じゃあ、今度はぼくのお話をする番です。",
      "あの冬はほんとうに寒かった。家はまっ暗で、みんなふるえていました。だからぼくは、自分の光をくばったんです。家ごとに火の粉をひとつずつ。",
      "ぼくが、あの大きなランタンだったんです。今その光は、あなたが灯した家のひとつひとつに生きています。みんなが少しずつ返してくれたら、塔はまた輝けるかもしれません。手伝ってくれますか？",
    ],
  },
};

const DE: StoryText = {
  ui: {
    book: "Geschichtenbuch", question: "Warum ist die große Laterne erloschen?", chapter: "Kapitel {n}", pages: "{read} von 3 Seiten",
    moveIn: "Öffnet sich, wenn {name} einzieht", friend: "Noch an {n} Tagen mit {name} reden", set: "Vervollständige das Set von {name}: {items}",
    chapters: "Noch {n} Kapitel abschließen", list: "Alle Kapitel", caption: "Geschichte", dotNew: "Geschichtenbuch: eine neue Seite",
  },
  title: { momo: "Die Nacht, in der die Glocke schwieg", sage: "Samen unter dem Turm", luna: "Eine Sternenkarte", pip: "Der kleinste Funke", kuri: "Garn für die Glocke", yuki: "Erster Schnee auf dem Turm", wick: "Wohin das große Licht ging" },
  pages: {
    momo: [
      "Früher erhellte die große Laterne auf dem Turm ganz Duskwick. Dann erlosch sie in einer Winternacht, und ich versteckte mich bis zum Morgen hinter einer Teekanne.",
      "Ich hatte Angst, aber ich war nicht allein. Jemand hatte mir ein kleines, warmes Licht vor die Tür gestellt. Wer es war, habe ich nie erfahren.",
      "Hinweis: In jener Nacht hörte die Turmglocke auf zu läuten. Diese Stille war das Lauteste, was ich je gehört habe.",
    ],
    sage: [
      "Als das Licht ausging, blieb ich im Garten unter dem Turm. Irgendwer musste sich ja um die Samen kümmern.",
      "Die Samen schliefen den ganzen Winter. Ich meistens auch. Aber ein Auge hielt ich offen, für das Licht.",
      "Hinweis: Das Öl war nicht leer. Ich habe nachgesehen. Die Flamme ist nicht ausgegangen. Sie zerfiel in Stücke und flog davon, wie Pusteblumen.",
    ],
    luna: [
      "Ich zeichne jede Nacht den Himmel. Auf meiner ältesten Sternenkarte ist der Turm der hellste Stern von allen.",
      "Auf der Karte aus jenem Winter fehlt der Turmstern. Dafür tauchen überall im Dorf Dutzende winzige neue Sterne auf.",
      "Hinweis: Die große Laterne lässt sich nicht mit einer Flamme allein entzünden. Laut der Karte braucht sie viele kleine Lichter, gemeinsam.",
    ],
    pip: [
      "Ich bin der Kleinste! Als die Funken flogen, habe ich nur einen winzigen erwischt. Er ist immer noch in meiner Laterne!",
      "Mein Funke hat dieselbe Farbe wie der von Momo und von Sage und von allen. Lustig, oder? Als wären wir alle Cousins!",
      "Hinweis: Jede Laterne in Duskwick trägt einen Funken in derselben Farbe. Alle kleinen Lichter stammen von einem großen Licht.",
    ],
    kuri: [
      "Ich stricke ein sehr langes Seil. Noch ist es ein Geheimnis. Es ist für die Glocke auf dem Turm.",
      "In jenem Winter ist das alte Seil verschlissen. Ohne Seil konnte die Glocke nicht läuten, und niemand fand den Weg nach Hause.",
      "Hinweis: Wenn die Glocke wieder läutet, kennt jeder Funke den Weg zurück zum Turm. Mein Seil ist fast fertig.",
    ],
    yuki: [
      "Ich mag den ersten Schnee. Dann wird alles still, als würde das ganze Dorf lauschen.",
      "Beim ersten Schnee jenes Winters sah ich oben auf dem Turm jemand Kleinen, der Licht verschenkte, Funke für Funke.",
      "Hinweis: Die Flamme dieses Jemand hatte genau die Farbe der großen Laterne. Ich glaube, du weißt, wer es war.",
    ],
    wick: [
      "Du hast allen Geschichten zugehört, nicht wahr? Dann ist es Zeit, dass ich dir meine erzähle.",
      "Jener Winter war so kalt. Die Häuser waren dunkel und alle froren. Also habe ich mein Licht verschenkt, einen Funken für jedes Zuhause.",
      "Ich war die große Laterne. Jetzt lebt das Licht in jedem Haus, das du erhellt hast. Wenn alle ein wenig zurückgeben, kann der Turm vielleicht wieder leuchten. Hilfst du mit?",
    ],
  },
};

const FR: StoryText = {
  ui: {
    book: "Livre d'histoires", question: "Pourquoi la grande lanterne s'est-elle éteinte ?", chapter: "Chapitre {n}", pages: "{read} page(s) sur 3",
    moveIn: "S'ouvre quand {name} emménage", friend: "Parlez avec {name} encore {n} jour(s)", set: "Complétez l'ensemble de {name} : {items}",
    chapters: "Terminez encore {n} chapitre(s)", list: "Tous les chapitres", caption: "Histoire", dotNew: "Livre d'histoires : une nouvelle page",
  },
  title: { momo: "La nuit où la cloche s'est tue", sage: "Des graines sous la tour", luna: "Une carte des étoiles", pip: "La plus petite étincelle", kuri: "Du fil pour la cloche", yuki: "Première neige sur la tour", wick: "Où est partie la grande lumière" },
  pages: {
    momo: [
      "Autrefois, la grande lanterne de la tour éclairait tout Duskwick. Puis, une nuit d'hiver, elle s'est éteinte, et je me suis cachée derrière une théière jusqu'au matin.",
      "J'avais peur, mais je n'étais pas seule. Quelqu'un avait laissé une petite lumière chaude devant ma porte. Je n'ai jamais su qui.",
      "Indice : cette nuit-là, la cloche de la tour a cessé de sonner. Ce silence était le bruit le plus fort que j'aie jamais entendu.",
    ],
    sage: [
      "Quand la lumière s'est éteinte, je suis resté dans le jardin sous la tour. Il fallait bien que quelqu'un veille sur les graines.",
      "Les graines ont dormi tout l'hiver. Moi aussi, presque. Mais je gardais un œil ouvert, pour la lumière.",
      "Indice : l'huile n'était pas vide. J'ai vérifié. La flamme ne s'est pas éteinte. Elle s'est brisée en morceaux et s'est envolée, comme des aigrettes de pissenlit.",
    ],
    luna: [
      "Je dessine le ciel chaque nuit. Sur ma plus vieille carte des étoiles, la tour est la plus brillante de toutes.",
      "Sur la carte de cet hiver-là, l'étoile de la tour a disparu. Mais des dizaines de petites étoiles nouvelles apparaissent partout dans le village.",
      "Indice : la grande lanterne ne s'allume pas avec une seule flamme. D'après la carte, il lui faut beaucoup de petites lumières, ensemble.",
    ],
    pip: [
      "Je suis le plus petit ! Alors quand les étincelles ont volé, je n'en ai attrapé qu'une toute petite. Elle est encore dans ma lanterne !",
      "Mon étincelle a la même couleur que celle de Momo, et de Sage, et de tout le monde. Drôle, non ? Comme si on était tous cousins !",
      "Indice : chaque lanterne de Duskwick contient une étincelle de la même couleur. Toutes les petites lumières viennent d'une seule grande lumière.",
    ],
    kuri: [
      "Je tricote une très longue corde. C'est encore un secret. Elle est pour la cloche de la tour.",
      "Cet hiver-là, la vieille corde s'est usée. Sans elle, la cloche ne pouvait plus sonner, et personne ne retrouvait le chemin de la maison.",
      "Indice : quand la cloche sonnera de nouveau, chaque étincelle saura revenir à la tour. Ma corde est presque finie.",
    ],
    yuki: [
      "J'aime la première neige. Tout devient silencieux, comme si le village entier écoutait.",
      "À la première neige de cet hiver-là, j'ai vu quelqu'un de tout petit en haut de la tour, qui donnait sa lumière, une étincelle à la fois.",
      "Indice : la flamme de ce quelqu'un avait exactement la couleur de la grande lanterne. Je crois que vous savez qui c'était.",
    ],
    wick: [
      "Vous avez écouté l'histoire de chacun, n'est-ce pas ? Alors il est temps que je vous raconte la mienne.",
      "Cet hiver-là, il faisait si froid. Les maisons étaient sombres et tout le monde grelottait. Alors j'ai donné ma lumière, une étincelle pour chaque foyer.",
      "C'était moi, la grande lanterne. Maintenant, la lumière vit dans chaque maison que vous avez allumée. Si chacun en rend un peu, la tour pourra peut-être briller de nouveau. Vous m'aidez ?",
    ],
  },
};

const ES: StoryText = {
  ui: {
    book: "Libro de cuentos", question: "¿Por qué se apagó el gran farol?", chapter: "Capítulo {n}", pages: "{read} de 3 páginas",
    moveIn: "Se abre cuando {name} se mude", friend: "Habla con {name} {n} día(s) más", set: "Completa el conjunto de {name}: {items}",
    chapters: "Termina {n} capítulo(s) más", list: "Todos los capítulos", caption: "Historia", dotNew: "Libro de cuentos: una página nueva",
  },
  title: { momo: "La noche en que calló la campana", sage: "Semillas bajo la torre", luna: "Un mapa de estrellas", pip: "La chispa más pequeña", kuri: "Hilo para la campana", yuki: "Primera nevada en la torre", wick: "Adónde fue la gran luz" },
  pages: {
    momo: [
      "Hace mucho, el gran farol de la torre iluminaba todo Duskwick. Una noche de invierno se apagó, y me escondí detrás de una tetera hasta la mañana.",
      "Tenía miedo, pero no estaba sola. Alguien había dejado una lucecita cálida junto a mi puerta. Nunca supe quién fue.",
      "Pista: esa noche, la campana de la torre dejó de sonar. Aquel silencio fue lo más fuerte que he oído nunca.",
    ],
    sage: [
      "Cuando se apagó la luz, me quedé en el jardín bajo la torre. Alguien tenía que cuidar las semillas.",
      "Las semillas durmieron todo el invierno. Yo también, casi siempre. Pero dejé un ojo abierto, esperando la luz.",
      "Pista: el aceite no se había acabado. Lo comprobé. La llama no murió. Se partió en pedacitos y salió volando, como pelusa de diente de león.",
    ],
    luna: [
      "Dibujo el cielo cada noche. En mi mapa de estrellas más antiguo, la torre es la estrella más brillante de todas.",
      "En el mapa de aquel invierno, la estrella de la torre no está. Pero aparecen decenas de estrellitas nuevas por todo el pueblo.",
      "Pista: el gran farol no se enciende con una sola llama. Según el mapa, necesita muchas lucecitas, juntas.",
    ],
    pip: [
      "¡Soy el más pequeño! Así que cuando volaron las chispas, solo atrapé una chiquitita. ¡Todavía está en mi farol!",
      "Mi chispa es del mismo color que la de Momo, y la de Sage, y la de todos. ¿A que es gracioso? ¡Como si fuéramos primos!",
      "Pista: cada farol de Duskwick guarda una chispa del mismo color. Todas las lucecitas vinieron de una gran luz.",
    ],
    kuri: [
      "Estoy tejiendo una cuerda muy larga. Por ahora es un secreto. Es para la campana de la torre.",
      "Aquel invierno, la cuerda vieja se gastó. Sin ella la campana no podía sonar, y nadie encontraba el camino a casa.",
      "Pista: cuando la campana vuelva a sonar, cada chispa sabrá volver a la torre. Mi cuerda ya casi está.",
    ],
    yuki: [
      "Me gusta la primera nevada. Todo se queda en silencio, como si el pueblo entero escuchara.",
      "En la primera nevada de aquel invierno, vi a alguien pequeñito en lo alto de la torre, regalando luz, chispa a chispa.",
      "Pista: la llama de ese alguien era exactamente del color del gran farol. Creo que sabes quién era.",
    ],
    wick: [
      "Has escuchado las historias de todos, ¿verdad? Entonces me toca contarte la mía.",
      "Aquel invierno hacía tanto frío. Las casas estaban a oscuras y todos temblaban. Así que regalé mi luz, una chispa para cada hogar.",
      "Yo era el gran farol. Ahora la luz vive en cada casa que encendiste. Si todos devolvemos un poquito, quizá la torre vuelva a brillar. ¿Me ayudas?",
    ],
  },
};

const PT: StoryText = {
  ui: {
    book: "Livro de histórias", question: "Por que a grande lanterna se apagou?", chapter: "Capítulo {n}", pages: "{read} de 3 páginas",
    moveIn: "Abre quando {name} se mudar", friend: "Converse com {name} por mais {n} dia(s)", set: "Complete o conjunto de {name}: {items}",
    chapters: "Termine mais {n} capítulo(s)", list: "Todos os capítulos", caption: "História", dotNew: "Livro de histórias: uma página nova",
  },
  title: { momo: "A noite em que o sino parou", sage: "Sementes sob a torre", luna: "Um mapa das estrelas", pip: "A menor faísca", kuri: "Linha para o sino", yuki: "Primeira neve na torre", wick: "Para onde foi a grande luz" },
  pages: {
    momo: [
      "Há muito tempo, a grande lanterna da torre iluminava toda Duskwick. Numa noite de inverno ela se apagou, e eu me escondi atrás de um bule até de manhã.",
      "Eu estava com medo, mas não estava sozinha. Alguém tinha deixado uma luzinha quente na minha porta. Nunca descobri quem foi.",
      "Pista: naquela noite, o sino da torre parou de tocar. Aquele silêncio foi o som mais alto que já ouvi.",
    ],
    sage: [
      "Quando a luz se apagou, fiquei no jardim sob a torre. Alguém precisava cuidar das sementes.",
      "As sementes dormiram o inverno todo. Eu também, quase sempre. Mas fiquei com um olho aberto, esperando a luz.",
      "Pista: o óleo não tinha acabado. Eu conferi. A chama não morreu. Ela se partiu em pedaços e saiu voando, como penugem de dente-de-leão.",
    ],
    luna: [
      "Eu desenho o céu toda noite. No meu mapa de estrelas mais antigo, a torre é a estrela mais brilhante de todas.",
      "No mapa daquele inverno, a estrela da torre sumiu. Mas dezenas de estrelinhas novas aparecem por toda a vila.",
      "Pista: a grande lanterna não acende com uma chama só. Segundo o mapa, ela precisa de muitas luzinhas, juntas.",
    ],
    pip: [
      "Eu sou o menor! Então, quando as faíscas voaram, só peguei uma pequenininha. Ela ainda está na minha lanterna!",
      "Minha faísca tem a mesma cor da de Momo, da de Sage e da de todo mundo. Engraçado, né? Como se fôssemos todos primos!",
      "Pista: cada lanterna de Duskwick guarda uma faísca da mesma cor. Todas as luzinhas vieram de uma grande luz.",
    ],
    kuri: [
      "Estou tricotando uma corda bem comprida. Por enquanto é segredo. É para o sino da torre.",
      "Naquele inverno, a corda velha se desgastou. Sem ela o sino não tocava, e ninguém achava o caminho de casa.",
      "Pista: quando o sino tocar de novo, cada faísca vai saber voltar para a torre. Minha corda está quase pronta.",
    ],
    yuki: [
      "Eu gosto da primeira neve. Tudo fica quietinho, como se a vila inteira estivesse escutando.",
      "Na primeira neve daquele inverno, vi alguém pequenininho no alto da torre, dando sua luz, uma faísca de cada vez.",
      "Pista: a chama desse alguém tinha exatamente a cor da grande lanterna. Acho que você sabe quem era.",
    ],
    wick: [
      "Você ouviu a história de todo mundo, não é? Então chegou a hora de eu contar a minha.",
      "Aquele inverno foi tão frio. As casas estavam escuras e todos tremiam. Então eu dei a minha luz, uma faísca para cada lar.",
      "Eu era a grande lanterna. Agora a luz vive em cada casa que você acendeu. Se todos devolverem um pouquinho, talvez a torre volte a brilhar. Você me ajuda?",
    ],
  },
};

const IT: StoryText = {
  ui: {
    book: "Libro delle storie", question: "Perché la grande lanterna si è spenta?", chapter: "Capitolo {n}", pages: "{read} pagine su 3",
    moveIn: "Si apre quando {name} si trasferisce", friend: "Parla con {name} per altri {n} giorni", set: "Completa il set di {name}: {items}",
    chapters: "Finisci altri {n} capitoli", list: "Tutti i capitoli", caption: "Storia", dotNew: "Libro delle storie: una pagina nuova",
  },
  title: { momo: "La notte in cui tacque la campana", sage: "Semi sotto la torre", luna: "Una mappa di stelle", pip: "La scintilla più piccola", kuri: "Filo per la campana", yuki: "Prima neve sulla torre", wick: "Dove andò la grande luce" },
  pages: {
    momo: [
      "Tanto tempo fa, la grande lanterna sulla torre illuminava tutta Duskwick. Poi, una notte d'inverno, si spense, e io mi nascosi dietro una teiera fino al mattino.",
      "Avevo paura, ma non ero sola. Qualcuno aveva lasciato una piccola luce calda davanti alla mia porta. Non ho mai scoperto chi.",
      "Indizio: quella notte la campana della torre smise di suonare. Quel silenzio fu il suono più forte che abbia mai sentito.",
    ],
    sage: [
      "Quando la luce si spense, rimasi nel giardino sotto la torre. Qualcuno doveva badare ai semi.",
      "I semi dormirono tutto l'inverno. Anch'io, quasi sempre. Ma tenni un occhio aperto, per la luce.",
      "Indizio: l'olio non era finito. Ho controllato. La fiamma non morì. Si divise in tanti pezzi e volò via, come i soffioni.",
    ],
    luna: [
      "Disegno il cielo ogni notte. Sulla mia mappa stellare più antica, la torre è la stella più luminosa di tutte.",
      "Sulla mappa di quell'inverno, la stella della torre non c'è più. Ma compaiono decine di piccole stelle nuove in tutto il borgo.",
      "Indizio: la grande lanterna non si accende con una fiamma sola. Secondo la mappa, servono tante piccole luci, insieme.",
    ],
    pip: [
      "Sono il più piccolo! Così, quando le scintille volarono, ne presi solo una piccolina. È ancora nella mia lanterna!",
      "La mia scintilla è dello stesso colore di quella di Momo, di Sage e di tutti. Buffo, vero? Come se fossimo tutti cugini!",
      "Indizio: ogni lanterna di Duskwick custodisce una scintilla dello stesso colore. Tutte le piccole luci vengono da una grande luce.",
    ],
    kuri: [
      "Sto lavorando a maglia una corda lunghissima. Per ora è un segreto. È per la campana della torre.",
      "Quell'inverno la vecchia corda si consumò. Senza corda la campana non suonava, e nessuno trovava la strada di casa.",
      "Indizio: quando la campana suonerà di nuovo, ogni scintilla saprà tornare alla torre. La mia corda è quasi pronta.",
    ],
    yuki: [
      "Mi piace la prima neve. Tutto diventa silenzioso, come se l'intero borgo stesse ascoltando.",
      "Alla prima neve di quell'inverno vidi qualcuno di piccolo in cima alla torre, che regalava luce, una scintilla alla volta.",
      "Indizio: la fiamma di quel qualcuno aveva esattamente il colore della grande lanterna. Credo che tu sappia chi era.",
    ],
    wick: [
      "Hai ascoltato le storie di tutti, vero? Allora è il momento che ti racconti la mia.",
      "Quell'inverno faceva così freddo. Le case erano buie e tutti tremavano. Così ho regalato la mia luce, una scintilla per ogni casa.",
      "La grande lanterna ero io. Ora la luce vive in ogni casa che hai acceso. Se ognuno ne restituisce un po', forse la torre potrà brillare di nuovo. Mi aiuti?",
    ],
  },
};

const ZHS: StoryText = {
  ui: {
    book: "故事书", question: "大灯笼为什么熄灭了？", chapter: "第 {n} 章", pages: "3 页中的 {read} 页",
    moveIn: "{name}搬来后开启", friend: "再和{name}聊 {n} 天", set: "集齐{name}的套组：{items}",
    chapters: "再读完 {n} 章其他故事", list: "全部章节", caption: "故事", dotNew: "故事书：有新的一页",
  },
  title: { momo: "钟声停止的夜晚", sage: "塔下的种子", luna: "星星地图", pip: "最小的火花", kuri: "给钟的毛线", yuki: "塔上的初雪", wick: "大光去了哪里" },
  pages: {
    momo: [
      "很久以前，塔顶的大灯笼照亮着整个 Duskwick。可是一个冬夜，它熄灭了，我在茶壶后面躲到了天亮。",
      "我很害怕，但我并不孤单。有人在我门口放了一盏小小的暖光。我一直不知道是谁。",
      "线索：那天夜里，塔上的钟声停了。那份安静，是我听过最响的声音。",
    ],
    sage: [
      "灯熄的时候，我留在了塔下的花园。总得有人照看那些种子。",
      "种子睡了一整个冬天。我也差不多一直在睡。但我始终睁着一只眼睛，等那道光。",
      "线索：灯油并没有用完，我检查过了。火焰不是熄灭了，而是碎成许多片，像蒲公英的绒毛一样飞走了。",
    ],
    luna: [
      "我每晚都画星空。在我最旧的星星地图上，那座塔是最亮的一颗星。",
      "那个冬天的地图上，塔星不见了。可是小镇各处冒出了几十颗小小的新星。",
      "线索：大灯笼不能只靠一朵火焰点亮。地图上说，它需要许多小光，一起。",
    ],
    pip: [
      "我是最小的！所以火花飞来的时候，我只抓住了一颗小不点儿。它现在还在我的灯笼里！",
      "我的火花和桃桃的、叶叶的、大家的颜色都一样。很好玩吧？好像我们都是表亲！",
      "线索：Duskwick 的每一盏灯笼里，都有一颗同样颜色的火花。所有的小光，都来自同一道大光。",
    ],
    kuri: [
      "我在织一根很长很长的绳子。现在还是秘密哦。是给塔上的钟用的。",
      "那个冬天，旧的钟绳磨断了。钟响不了，谁也找不到回家的路。",
      "线索：等钟声再次响起，每一颗火花都会知道回塔的路。我的绳子也快织好了。",
    ],
    yuki: [
      "我喜欢初雪。初雪一来，一切都安静了，好像整个小镇都在倾听。",
      "那个冬天下初雪的时候，我看见塔顶上有个小小的身影，正把光一颗一颗地分出去。",
      "线索：那个身影的火焰，和大灯笼的颜色一模一样。你大概知道是谁了吧？",
    ],
    wick: [
      "你听完了大家的故事，对吧？那现在轮到我讲我的了。",
      "那个冬天真的好冷。家家户户一片漆黑，大家都在发抖。所以我把自己的光分了出去，每户一颗火花。",
      "我就是那盏大灯笼。现在，那道光住在你点亮的每一间屋子里。如果大家都还回一点点，也许塔会再次亮起来。你愿意帮忙吗？",
    ],
  },
};

const ZHT: StoryText = {
  ui: {
    book: "故事書", question: "大燈籠為什麼熄滅了？", chapter: "第 {n} 章", pages: "3 頁中的 {read} 頁",
    moveIn: "{name}搬來後開啟", friend: "再和{name}聊 {n} 天", set: "集齊{name}的套組：{items}",
    chapters: "再讀完 {n} 章其他故事", list: "全部章節", caption: "故事", dotNew: "故事書：有新的一頁",
  },
  title: { momo: "鐘聲停止的夜晚", sage: "塔下的種子", luna: "星星地圖", pip: "最小的火花", kuri: "給鐘的毛線", yuki: "塔上的初雪", wick: "大光去了哪裡" },
  pages: {
    momo: [
      "很久以前，塔頂的大燈籠照亮著整個 Duskwick。可是一個冬夜，它熄滅了，我在茶壺後面躲到了天亮。",
      "我很害怕，但我並不孤單。有人在我門口放了一盞小小的暖光。我一直不知道是誰。",
      "線索：那天夜裡，塔上的鐘聲停了。那份安靜，是我聽過最響的聲音。",
    ],
    sage: [
      "燈熄的時候，我留在了塔下的花園。總得有人照看那些種子。",
      "種子睡了一整個冬天。我也差不多一直在睡。但我始終睜著一隻眼睛，等那道光。",
      "線索：燈油並沒有用完，我檢查過了。火焰不是熄滅了，而是碎成許多片，像蒲公英的絨毛一樣飛走了。",
    ],
    luna: [
      "我每晚都畫星空。在我最舊的星星地圖上，那座塔是最亮的一顆星。",
      "那個冬天的地圖上，塔星不見了。可是小鎮各處冒出了幾十顆小小的新星。",
      "線索：大燈籠不能只靠一朵火焰點亮。地圖上說，它需要許多小光，一起。",
    ],
    pip: [
      "我是最小的！所以火花飛來的時候，我只抓住了一顆小不點兒。它現在還在我的燈籠裡！",
      "我的火花和桃桃的、葉葉的、大家的顏色都一樣。很好玩吧？好像我們都是表親！",
      "線索：Duskwick 的每一盞燈籠裡，都有一顆同樣顏色的火花。所有的小光，都來自同一道大光。",
    ],
    kuri: [
      "我在織一根很長很長的繩子。現在還是秘密喔。是給塔上的鐘用的。",
      "那個冬天，舊的鐘繩磨斷了。鐘響不了，誰也找不到回家的路。",
      "線索：等鐘聲再次響起，每一顆火花都會知道回塔的路。我的繩子也快織好了。",
    ],
    yuki: [
      "我喜歡初雪。初雪一來，一切都安靜了，好像整個小鎮都在傾聽。",
      "那個冬天下初雪的時候，我看見塔頂上有個小小的身影，正把光一顆一顆地分出去。",
      "線索：那個身影的火焰，和大燈籠的顏色一模一樣。你大概知道是誰了吧？",
    ],
    wick: [
      "你聽完了大家的故事，對吧？那現在輪到我講我的了。",
      "那個冬天真的好冷。家家戶戶一片漆黑，大家都在發抖。所以我把自己的光分了出去，每戶一顆火花。",
      "我就是那盞大燈籠。現在，那道光住在你點亮的每一間屋子裡。如果大家都還回一點點，也許塔會再次亮起來。你願意幫忙嗎？",
    ],
  },
};

export const STORY: Record<Lang, StoryText> = { en: EN, ko: KO, ja: JA, de: DE, fr: FR, es: ES, "pt-BR": PT, it: IT, "zh-Hans": ZHS, "zh-Hant": ZHT };

export function storyUi(lang: Lang, key: keyof StoryText["ui"], vars?: Record<string, string | number>): string {
  const s = STORY[lang].ui[key] ?? EN.ui[key];
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}
