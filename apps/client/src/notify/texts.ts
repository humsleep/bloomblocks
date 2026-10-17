// Reminder texts: short, calm, body only (no title), in every shipped language. Positive only:
// no "miss", "lose", "last chance", "hurry", "midnight", no emoji runs (BENCHMARK-UX (d)).
// The streak line is used only from 3 days on.
import type { Lang } from "../a11y/strings.ts";

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
    streak: "{n}日目、通りにもうひとつ灯しませんか?",
  },
  de: {
    lines: ["Das Laternenrätsel für heute Abend ist da.", "Ein neuer Mond, ein neues Rätsel.", "Die Gasse hat noch eine Laterne zum Anzünden.", "Ein ruhiges Rätsel wartet auf dich."],
    streak: "Tag {n}: noch eine Laterne für die Gasse?",
  },
  fr: {
    lines: ["L'énigme des lanternes de ce soir est prête.", "Une nouvelle lune, une nouvelle énigme.", "La rue a encore une lanterne à allumer.", "Une énigme tranquille vous attend."],
    streak: "Jour {n} : une lanterne de plus pour la rue ?",
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

/** The body of the reminder for a date (rotates by day; the streak line from 3 days on). */
export function reminderBody(lang: Lang, dayIndex: number, streak: number): string {
  const t = REMINDER_TEXTS[lang] ?? REMINDER_TEXTS.en;
  if (streak >= 3 && dayIndex % 3 === 2) return t.streak.replace("{n}", String(streak + 1));
  return t.lines[((dayIndex % t.lines.length) + t.lines.length) % t.lines.length]!;
}
