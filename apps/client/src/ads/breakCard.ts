// Confirm card for the rewarded "30-min ad break" (docs/ads-plan.md §3: AdMob requires a clear,
// opt-in disclosure of the action and the reward — the one allowed exception to the wordless rule).
// U renders it: chip tap → card [title / body / watch / notNow] → watch = ads.watchBreak(),
// notNow (or tap outside) = ads.declineBreak(). If watchBreak() resolves false, show `unavailable`
// briefly (or simply close). Keep the copy short; no "free", no urgency, no click-bait.
// Also re-exported by src/game/adsHooks.ts (~2 KB of strings; fine on the cold-start path).

export interface BreakCardText {
  title: string;
  body: string;
  watch: string;
  notNow: string;
  /** the ad could not be shown (no fill / closed early) — nothing was granted */
  unavailable: string;
}

import { LANGS, type Lang, pickLang } from "../a11y/strings.ts";

/** Every shipped UI language (the same list as a11y/strings.ts). */
export const BREAK_CARD_LANGS = LANGS;
export type BreakCardLang = Lang;

export const BREAK_CARD: Readonly<Record<BreakCardLang, BreakCardText>> = {
  en: {
    title: "30-minute ad break",
    body: "Watch one short ad, then play 30 minutes with no ads.",
    watch: "Watch ad",
    notNow: "Not now",
    unavailable: "No ad right now. Nothing changed.",
  },
  ko: {
    title: "30분 광고 쉬기",
    body: "짧은 광고 하나를 보면 30분 동안 광고 없이 플레이해요.",
    watch: "광고 보기",
    notNow: "다음에",
    unavailable: "지금은 광고가 없어요. 바뀐 건 없어요.",
  },
  ja: {
    title: "30分 広告おやすみ",
    body: "短い広告を1本見ると、30分間 広告なしで遊べます。",
    watch: "広告を見る",
    notNow: "今はしない",
    unavailable: "いまは広告がありません。変更はありません。",
  },
  de: {
    title: "30 Minuten werbefrei",
    body: "Sieh dir eine kurze Werbung an und spiel dann 30 Minuten ohne Werbung.",
    watch: "Ansehen",
    notNow: "Nicht jetzt",
    unavailable: "Gerade keine Werbung verfügbar. Nichts hat sich geändert.",
  },
  fr: {
    title: "30 minutes sans pub",
    body: "Regardez une courte pub, puis jouez 30 minutes sans publicité.",
    watch: "Voir la pub",
    notNow: "Plus tard",
    unavailable: "Pas de pub pour le moment. Rien n’a changé.",
  },
  es: {
    title: "30 minutos sin anuncios",
    body: "Mira un anuncio corto y juega 30 minutos sin anuncios.",
    watch: "Ver anuncio",
    notNow: "Ahora no",
    unavailable: "No hay anuncios por ahora. Todo sigue igual.",
  },
  "pt-BR": {
    title: "30 minutos sem anúncios",
    body: "Assista a um anúncio curto e jogue 30 minutos sem anúncios.",
    watch: "Ver anúncio",
    notNow: "Agora não",
    unavailable: "Nenhum anúncio agora. Nada mudou.",
  },
  it: {
    title: "30 minuti senza pubblicità",
    body: "Guarda un breve annuncio: poi 30 minuti senza pubblicità.",
    watch: "Guarda",
    notNow: "Non ora",
    unavailable: "Nessun annuncio al momento. Non è cambiato nulla.",
  },
  "zh-Hans": {
    title: "30 分钟无广告",
    body: "看完一则短广告，接下来 30 分钟都不会出现广告。",
    watch: "观看广告",
    notNow: "以后再说",
    unavailable: "暂时没有广告可看，一切照旧。",
  },
  "zh-Hant": {
    title: "30 分鐘無廣告",
    body: "看完一則短廣告，接下來 30 分鐘都不會出現廣告。",
    watch: "觀看廣告",
    notNow: "以後再說",
    unavailable: "目前沒有廣告可以觀看，一切照舊。",
  },
};

/** Card text for a BCP-47 tag (or a list, first match wins; e.g. the a11y layer's language). English fallback. */
export function breakCardText(tags: string | readonly (string | null | undefined)[] = globalThis.navigator?.languages ?? []): BreakCardText {
  return BREAK_CARD[pickLang(typeof tags === "string" ? [tags] : tags)];
}
