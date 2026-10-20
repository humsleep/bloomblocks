// Reminder texts: short, calm, body only (no title), in every shipped language. Positive only:
// no "miss", "lose", "last chance", "hurry", "midnight", no emoji runs (BENCHMARK-UX (d)).
// The streak line is used only from 3 days on.
import type { Lang } from "../a11y/strings.ts";
import type { ResidentId } from "../village/catalog.ts";

export interface ReminderTexts {
  lines: readonly string[];
  /** {n} = the day the reminder invites to (current streak + 1) */
  streak: string;
}

export const REMINDER_TEXTS: Readonly<Record<Lang, ReminderTexts>> = {
  en: {
    lines: ["Tonight's lantern puzzle is ready.", "A new moon, a new puzzle.", "The street has one more lantern to light.", "A quiet puzzle is waiting for you."],
    streak: "Day {n}: one more lantern for the street?",
  },
  ko: {
    lines: ["오늘 밤의 등불 퍼즐이 기다려요.", "새 달, 새 퍼즐.", "거리에 켤 등불이 하나 더 있어요.", "조용한 퍼즐 하나가 준비됐어요."],
    streak: "{n}일째, 거리에 등불 하나 더 켜 볼까요?",
  },
  ja: {
    lines: ["今夜のランタンパズルが届きました。", "新しい月、新しいパズル。", "通りに灯すランタンがもうひとつ。", "静かなパズルがひとつ待っています。"],
    streak: "{n}日目、通りにもうひとつ灯しませんか？",
  },
  de: {
    lines: ["Das Laternenrätsel für heute Abend ist da.", "Ein neuer Mond, ein neues Rätsel.", "Die Gasse hat noch eine Laterne zum Anzünden.", "Ein ruhiges Rätsel wartet auf dich."],
    streak: "Tag {n}: noch eine Laterne für die Gasse?",
  },
  fr: {
    lines: ["L'énigme des lanternes de ce soir est prête.", "Une nouvelle lune, une nouvelle énigme.", "La rue a encore une lanterne à allumer.", "Une énigme tranquille vous attend."],
    streak: "Jour {n}\u00a0: une lanterne de plus pour la rue\u00a0?",
  },
  es: {
    lines: ["El acertijo de faroles de esta noche está listo.", "Una luna nueva, un acertijo nuevo.", "La calle tiene un farol más por encender.", "Un acertijo tranquilo te espera."],
    streak: "Día {n}: ¿un farol más para la calle?",
  },
  "pt-BR": {
    lines: ["O quebra-cabeça de lanternas de hoje está pronto.", "Uma lua nova, um quebra-cabeça novo.", "A rua tem mais uma lanterna para acender.", "Um quebra-cabeça tranquilo espera por você."],
    streak: "Dia {n}: mais uma lanterna para a rua?",
  },
  it: {
    lines: ["L'enigma delle lanterne di stasera è pronto.", "Una nuova sera, un nuovo enigma.", "Nel borgo c'è ancora una lanterna da accendere.", "Un enigma tranquillo ti aspetta."],
    streak: "Giorno {n}: un'altra lanterna per il borgo?",
  },
  "zh-Hans": {
    lines: ["今晚的灯笼谜题准备好了。", "又一个夜晚，又一道新谜题。", "街上还有一盏灯笼等你点亮。", "有一道谜题，正静静地等着你。"],
    streak: "第 {n} 天了，再给街上点亮一盏灯笼吧？",
  },
  "zh-Hant": {
    lines: ["今晚的燈籠謎題準備好了。", "又一個夜晚，又一道新謎題。", "街上還有一盞燈籠等你點亮。", "有一道謎題，正靜靜等著你。"],
    streak: "第 {n} 天了，要不要再為街上點亮一盞燈籠？",
  },
};

/** Words that must never appear (tests check every line). */
export const BANNED = /miss|lose|lost|last chance|hurry|midnight|놓|잃|마지막|서두|자정|逃|失|急|verpass|verlier|letzte|beeil|mitternacht|rater|perdre|dernière|dépêche|minuit|perder|última|prisa|medianoche|meia-noite|apresse|perdi|perso|ultima|sbrigati|affrettati|mezzanotte|错过|錯過|最后|最後|赶快|趕快|赶紧|趕緊|午夜|半夜/i;

/**
 * R4: a reminder in a village friend's own voice (only residents who already moved in), every third day.
 * Same rules as the lines above: calm, positive, no urgency words (BANNED).
 */
export const RESIDENT_LINES: Readonly<Record<Lang, Record<ResidentId, string>>> = {
  en: {
    wick: "Wick: The lanterns are waking up. Shall we light one together?",
    momo: "Momo: Um… I saved a puzzle for you. Only if you'd like.",
    sage: "Sage: Mm… today's puzzle has sprouted. Come and see.",
    luna: "Luna: The stars drew a new puzzle tonight.",
    pip: "Pip: HI! New puzzle! I already counted all the tiles!",
    kuri: "Kuri: The tea is warm, and so is today's puzzle.",
    yuki: "Yuki: Shh… a quiet puzzle is waiting for you.",
  },
  ko: {
    wick: "윅: 등불들이 깨어나고 있어요. 같이 하나 켜 볼까요?",
    momo: "모모: 저기… 퍼즐 하나 아껴 뒀어요. 괜찮으면요.",
    sage: "세이지: 음… 오늘 퍼즐에 싹이 텄어요. 보러 와요.",
    luna: "루나: 오늘 밤엔 별들이 새 퍼즐을 그렸어요.",
    pip: "핍: 안녕! 새 퍼즐이야! 칸 수도 벌써 다 세 봤어!",
    kuri: "쿠리: 차가 따뜻해요. 오늘 퍼즐도요.",
    yuki: "유키: 쉿… 조용한 퍼즐이 기다리고 있어요.",
  },
  ja: {
    wick: "ウィック：ランタンたちが目をさましています。いっしょにひとつ灯しませんか？",
    momo: "モモ：あの…パズルをひとつ、とっておきました。よかったら。",
    sage: "セージ：ん…今日のパズルが芽を出しました。見に来てください。",
    luna: "ルナ：今夜は、星たちが新しいパズルを描きました。",
    pip: "ピピ：やあ！新しいパズルだよ！マスの数もう数えたよ！",
    kuri: "クリ：お茶があたたかいわ。今日のパズルもね。",
    yuki: "ユキ：しーっ…しずかなパズルが待ってるよ。",
  },
  de: {
    wick: "Wick: Die Laternen wachen auf. Zünden wir zusammen eine an?",
    momo: "Momo: Ähm … ich habe dir ein Rätsel aufgehoben. Nur wenn du magst.",
    sage: "Sage: Mm … das Rätsel von heute ist aufgegangen. Schau doch vorbei.",
    luna: "Luna: Heute Nacht haben die Sterne ein neues Rätsel gezeichnet.",
    pip: "Pip: HALLO! Neues Rätsel! Ich hab schon alle Felder gezählt!",
    kuri: "Kuri: Der Tee ist warm, und das Rätsel von heute auch.",
    yuki: "Yuki: Pssst … ein ruhiges Rätsel wartet auf dich.",
  },
  fr: {
    wick: "Wick : Les lanternes se réveillent. On en allume une ensemble ?",
    momo: "Momo : Euh… je vous ai gardé une énigme. Seulement si ça vous dit.",
    sage: "Sage : Mm… l'énigme du jour a germé. Venez voir.",
    luna: "Luna : Ce soir, les étoiles ont dessiné une nouvelle énigme.",
    pip: "Pip : COUCOU ! Nouvelle énigme ! J'ai déjà compté toutes les cases !",
    kuri: "Kuri : Le thé est chaud, et l'énigme du jour aussi.",
    yuki: "Yuki : Chut… une énigme tranquille vous attend.",
  },
  es: {
    wick: "Wick: Los faroles se están despertando. ¿Encendemos uno juntos?",
    momo: "Momo: Esto… te guardé un acertijo. Solo si te apetece.",
    sage: "Sage: Mm… el acertijo de hoy ya brotó. Ven a verlo.",
    luna: "Luna: Esta noche las estrellas dibujaron un acertijo nuevo.",
    pip: "Pip: ¡HOLA! ¡Acertijo nuevo! ¡Ya conté todas las casillas!",
    kuri: "Kuri: El té está calentito, y el acertijo de hoy también.",
    yuki: "Yuki: Shh… un acertijo tranquilo te espera.",
  },
  "pt-BR": {
    wick: "Wick: As lanternas estão acordando. Vamos acender uma juntos?",
    momo: "Momo: Hum… guardei um quebra-cabeça para você. Só se quiser.",
    sage: "Sage: Mm… o quebra-cabeça de hoje brotou. Vem ver.",
    luna: "Luna: Hoje à noite as estrelas desenharam um quebra-cabeça novo.",
    pip: "Pip: OI! Quebra-cabeça novo! Já contei todas as casas!",
    kuri: "Kuri: O chá está quentinho, e o quebra-cabeça de hoje também.",
    yuki: "Yuki: Shh… um quebra-cabeça tranquilo espera por você.",
  },
  it: {
    wick: "Wick: Le lanterne si stanno svegliando. Ne accendiamo una insieme?",
    momo: "Momo: Ehm… ti ho tenuto da parte un enigma. Solo se ti va.",
    sage: "Sage: Mm… l'enigma di oggi è germogliato. Vieni a vedere.",
    luna: "Luna: Stanotte le stelle hanno disegnato un enigma nuovo.",
    pip: "Pip: CIAO! Enigma nuovo! Ho già contato tutte le caselle!",
    kuri: "Kuri: Il tè è caldo, e anche l'enigma di oggi.",
    yuki: "Yuki: Shh… un enigma tranquillo ti aspetta.",
  },
  "zh-Hans": {
    wick: "小烛：灯笼们正在醒来。一起点亮一盏吧？",
    momo: "桃桃：那个……我给你留了一道谜题。你想玩的话。",
    sage: "叶叶：嗯……今天的谜题发芽了。来看看吧。",
    luna: "月月：今晚，星星们画了一道新谜题。",
    pip: "皮皮：嗨！新谜题！格子我都数好啦！",
    kuri: "栗栗：茶是暖的，今天的谜题也是。",
    yuki: "雪雪：嘘……有一道安静的谜题在等你。",
  },
  "zh-Hant": {
    wick: "小燭：燈籠們正在醒來。一起點亮一盞吧？",
    momo: "桃桃：那個……我幫你留了一道謎題。你想玩的話。",
    sage: "葉葉：嗯……今天的謎題發芽了。來看看吧。",
    luna: "月月：今晚，星星們畫了一道新謎題。",
    pip: "皮皮：嗨！新謎題！格子我都數好啦！",
    kuri: "栗栗：茶是暖的，今天的謎題也是。",
    yuki: "雪雪：噓……有一道安靜的謎題在等你。",
  },
};

/**
 * The body of the reminder for a date (rotates by day; the streak line from 3 days on; R4: a moved-in
 * resident's own line every third day, residents taking turns).
 */
export function reminderBody(lang: Lang, dayIndex: number, streak: number, residents: readonly ResidentId[] = []): string {
  const t = REMINDER_TEXTS[lang] ?? REMINDER_TEXTS.en;
  if (streak >= 3 && dayIndex % 3 === 2) return t.streak.replace("{n}", String(streak + 1));
  const mod = (a: number, n: number): number => ((a % n) + n) % n;
  if (residents.length && mod(dayIndex, 3) === 1) return (RESIDENT_LINES[lang] ?? RESIDENT_LINES.en)[residents[mod(Math.floor(dayIndex / 3), residents.length)]!];
  return t.lines[mod(dayIndex, t.lines.length)]!;
}
