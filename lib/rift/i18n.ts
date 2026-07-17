// ============================================================================
//  Rift — UI localisation (English + Persian).
//
//  The site-wide language toggle (components/lang-provider) drives which set of
//  strings the Rift menus, HUD and the new How-to-Play guide render in. Only
//  the interface chrome is translated here; data-driven names that live in
//  other modules (hero/weapon/enemy names) stay in their canonical form.
// ============================================================================

import type { Lang } from "@/lib/i18n";

export interface RiftStrings {
  // tabs
  play: string; heroes: string; weapons: string; codex: string; achievements: string; stats: string; settings: string; guide: string;
  // top bar / HUD
  practice: string; sector: string; wave: string; lv: string;
  hull: string; core: string; waveProgress: string; shielded: string; phase: string; dps: string; comboSuffix: string;
  // menu header
  menuSubA: string; menuSubCore: string; menuSubB: string; fieldTipPrefix: string;
  // play tab
  difficulty: string; abilitiesPick: string; loadoutPresets: string; saveHere: string; clear: string; presetPlaceholder: string;
  dailyChallenge: string; enable: string; challengeNote: string; cooldownSuffix: string; bannedByOneLife: string;
  prestige: string; prestigeDesc: string; practiceMode: string; practiceDesc: string; launch: string;
  flyingAs: (hero: string, weapon: string) => string;
  suggestedBuild: (hero: string) => string; applyBuild: string; unlockToUse: (weapon: string) => string;
  // heroes / weapons
  unlocksAt: (score: string) => string;
  // codex
  bestiary: string; bossManual: string;
  // stats
  bestScore: string; runsWon: string; winRate: string; avgScore: string; bestSector: string;
  lifetimeKills: string; bossKills: string; lifetimeGold: string; critKills: string; favoriteHero: string;
  recentRuns: string; noRuns: string; won: string;
  // settings
  controls: string; soundEffects: string; music: string; screenShake: string; colorblind: string; showDps: string;
  masterVolume: string; resetProgress: string; resetConfirm: string; bestByDifficulty: string;
  // pause
  paused: string; resume: string; restart: string; scoreKills: (score: string, kills: number) => string;
  // shop
  armory: string; upgrade: string; rerollLabel: (cost: number, left: number) => string; swapWeapon: string;
  featuredOffer: string; showAll: string; deployNext: string; max: string;
  // game over
  wonTitle: string; lostTitle: string; wonSub: string; lostSub: string;
  score: string; kills: string; sectorLabel: string; bestCombo: string;
  newAchievements: string; playAgain: string; copyResult: string; backToMenu: string; resultCopied: string;
  // controls legend
  cMove: string; cAim: string; cAbility1: string; cAbility2: string; cPause: string;
  // guide
  guideTitle: string; guideIntro: string;
  guideGoalT: string; guideGoal: string;
  guideControlsT: string; guideLoopT: string; guideLoop: string;
  guideHeroesT: string; guideHeroes: string;
  guideTipsT: string; guideTips: string[];
}

const en: RiftStrings = {
  play: "play", heroes: "heroes", weapons: "weapons", codex: "codex", achievements: "achievements", stats: "stats", settings: "settings", guide: "guide",
  practice: "PRACTICE", sector: "Sector", wave: "Wave", lv: "Lv",
  hull: "HULL", core: "CORE", waveProgress: "WAVE PROGRESS", shielded: "SHIELDED", phase: "Phase", dps: "DPS", comboSuffix: "combo",
  menuSubA: "Choose a hero, a weapon and up to two abilities, then defend the ", menuSubCore: "Core", menuSubB: " through five sectors of escalating threats — each capped by a unique boss.",
  fieldTipPrefix: "Tip",
  difficulty: "Difficulty", abilitiesPick: "Abilities — pick up to 2", loadoutPresets: "Loadout presets", saveHere: "+ save here", clear: "clear",
  presetPlaceholder: "Name a preset, then tap an empty slot…",
  dailyChallenge: "Daily challenge", enable: "Enable", challengeNote: "Same three modifiers for everyone today — a fair, comparable run.",
  cooldownSuffix: "s cd", bannedByOneLife: "Banned by One Life",
  prestige: "Prestige mode", prestigeDesc: "Sealing the Rift no longer ends the run — sector 6 onward is endless, guarded by Eclipse.",
  practiceMode: "Practice mode", practiceDesc: "The Core and hero can't actually die — learn a boss pattern risk-free. Doesn't save progress or achievements.",
  launch: "Launch ◈",
  flyingAs: (h, w) => `Flying as ${h} with the ${w}. Switch either from their tabs above.`,
  suggestedBuild: (h) => `Suggested build for ${h}`, applyBuild: "Apply this build →",
  unlockToUse: (w) => `Unlock ${w} to use this build.`,
  unlocksAt: (s) => `Unlocks at ${s} lifetime score`,
  bestiary: "Bestiary", bossManual: "Boss field manual",
  bestScore: "Best score", runsWon: "Runs won", winRate: "Win rate", avgScore: "Avg score", bestSector: "Best sector",
  lifetimeKills: "Lifetime kills", bossKills: "Boss kills", lifetimeGold: "Lifetime gold", critKills: "Crit kills", favoriteHero: "Favorite hero",
  recentRuns: "Recent runs", noRuns: "No runs logged yet — your history will build up here.", won: "WON",
  controls: "Controls", soundEffects: "Sound effects", music: "Music", screenShake: "Screen shake", colorblind: "Colorblind-friendly shapes", showDps: "Show DPS meter",
  masterVolume: "Master volume", resetProgress: "Reset all progress",
  resetConfirm: "Reset all Rift progress? This clears heroes, weapons, achievements and stats — it cannot be undone.",
  bestByDifficulty: "Best score by difficulty",
  paused: "Paused", resume: "Resume", restart: "Restart", scoreKills: (s, k) => `Score ${s} · ${k} kills`,
  armory: "Armory · between waves", upgrade: "Upgrade", rerollLabel: (c, l) => `↻ Reroll (◆${c}) · ${l} left`, swapWeapon: "Swap weapon",
  featuredOffer: "Featured offer — reroll for a fresh set", showAll: "Show all upgrades", deployNext: "Deploy — next wave →", max: "MAX",
  wonTitle: "Rift Sealed", lostTitle: "Core Breached",
  wonSub: "You cleared all five sectors. Legendary.", lostSub: "The arena fell — but the salvage remembers you.",
  score: "Score", kills: "Kills", sectorLabel: "Sector", bestCombo: "Best combo",
  newAchievements: "New achievements", playAgain: "Play again ◈", copyResult: "📋 Copy result", backToMenu: "Back to menu", resultCopied: "Result copied to clipboard",
  cMove: "Move", cAim: "Aim (auto-fire)", cAbility1: "Ability slot 1", cAbility2: "Ability slot 2", cPause: "Pause / resume",
  guideTitle: "How to play",
  guideIntro: "Rift is a twin-stick arena survival: you pilot a lone fighter defending a central Core against escalating waves of enemies across five sectors, each ending in a boss. Move, aim, upgrade and survive.",
  guideGoalT: "Your goal",
  guideGoal: "Keep both your hull AND the Core alive. Enemies rush the Core and attack you directly — if either bar hits zero, the run ends. Clear all six waves of a sector to face its boss; beat five bosses to seal the Rift.",
  guideControlsT: "Controls",
  guideLoopT: "The gameplay loop",
  guideLoop: "You fire automatically toward your aim. Focus on positioning: kite enemies, keep the Core behind you, and grab the gold (◆) and green health orbs they drop. Between waves the Armory opens — spend gold on upgrades or swap your weapon, then deploy the next wave.",
  guideHeroesT: "Heroes, weapons & abilities",
  guideHeroes: "Each hero has a unique passive; each weapon fires differently; and you equip up to two active abilities (keys 1 and 2) with cooldowns. Earn lifetime score to unlock more heroes and weapons. Try the 'Suggested build' on a hero's tab for a strong starting combo.",
  guideTipsT: "Tips",
  guideTips: [
    "Keep moving — standing still gets you surrounded.",
    "Never let enemies path freely to the Core; body-block or thin them first.",
    "Save an ability for when a wave spikes or a boss enrages.",
    "Reroll the shop (◆) if nothing fits your build.",
    "Crits build your combo; a high combo multiplies score and gold.",
    "Deploy sentries to cover angles you can't watch.",
  ],
};

const fa: RiftStrings = {
  play: "بازی", heroes: "قهرمان‌ها", weapons: "سلاح‌ها", codex: "دانشنامه", achievements: "دستاوردها", stats: "آمار", settings: "تنظیمات", guide: "راهنما",
  practice: "تمرین", sector: "بخش", wave: "موج", lv: "سطح",
  hull: "بدنه", core: "هسته", waveProgress: "پیشرفتِ موج", shielded: "سپردار", phase: "فاز", dps: "DPS", comboSuffix: "کمبو",
  menuSubA: "یک قهرمان، یک سلاح و تا دو توانایی انتخاب کن، بعد از ", menuSubCore: "هسته", menuSubB: " در برابر پنج بخشِ پرتهدیدِ فزاینده دفاع کن — هرکدام با یک باسِ یکتا تمام می‌شود.",
  fieldTipPrefix: "نکته",
  difficulty: "سختی", abilitiesPick: "توانایی‌ها — تا ۲ تا انتخاب کن", loadoutPresets: "پیش‌تنظیم‌های چیدمان", saveHere: "+ ذخیره اینجا", clear: "پاک کن",
  presetPlaceholder: "یک نام بگذار، بعد روی یک اسلاتِ خالی بزن…",
  dailyChallenge: "چالشِ روزانه", enable: "فعال", challengeNote: "امروز برای همه سه اصلاح‌گرِ یکسان — یک رانِ منصفانه و قابلِ مقایسه.",
  cooldownSuffix: "ث خنک‌شدن", bannedByOneLife: "با «یک جان» ممنوع است",
  prestige: "حالتِ پرستیژ", prestigeDesc: "مهروموم‌کردنِ ریفت دیگر رانْ را تمام نمی‌کند — از بخشِ ۶ به بعد بی‌پایان است، زیرِ نگاهِ اکلیپس.",
  practiceMode: "حالتِ تمرین", practiceDesc: "هسته و قهرمان واقعاً نمی‌میرند — الگوی باس را بی‌ریسک یاد بگیر. پیشرفت و دستاورد ذخیره نمی‌شود.",
  launch: "شروع ◈",
  flyingAs: (h, w) => `با ${h} و سلاحِ ${w}. هرکدام را از تبِ خودش بالا عوض کن.`,
  suggestedBuild: (h) => `بیلدِ پیشنهادی برای ${h}`, applyBuild: "این بیلد را اعمال کن →",
  unlockToUse: (w) => `برای این بیلد ${w} را باز کن.`,
  unlocksAt: (s) => `با امتیازِ کلِ ${s} باز می‌شود`,
  bestiary: "جانورنامه", bossManual: "راهنمای میدانیِ باس‌ها",
  bestScore: "بهترین امتیاز", runsWon: "بردها", winRate: "نرخِ برد", avgScore: "میانگینِ امتیاز", bestSector: "بهترین بخش",
  lifetimeKills: "کلِ کشته‌ها", bossKills: "کشتنِ باس", lifetimeGold: "کلِ طلا", critKills: "کشتنِ کریتیکال", favoriteHero: "قهرمانِ محبوب",
  recentRuns: "ران‌های اخیر", noRuns: "هنوز رانی ثبت نشده — تاریخچه‌ات اینجا ساخته می‌شود.", won: "برد",
  controls: "کنترل‌ها", soundEffects: "جلوه‌های صوتی", music: "موسیقی", screenShake: "لرزشِ صفحه", colorblind: "شکل‌های مناسبِ کوررنگی", showDps: "نمایشِ سنجه‌ی DPS",
  masterVolume: "صدای اصلی", resetProgress: "بازنشانیِ همه‌ی پیشرفت",
  resetConfirm: "همه‌ی پیشرفتِ ریفت بازنشانی شود؟ قهرمان‌ها، سلاح‌ها، دستاوردها و آمار پاک می‌شوند — بازگشت‌ناپذیر است.",
  bestByDifficulty: "بهترین امتیاز به تفکیکِ سختی",
  paused: "مکث", resume: "ادامه", restart: "شروعِ دوباره", scoreKills: (s, k) => `امتیاز ${s} · ${k} کشته`,
  armory: "زرادخانه · بینِ موج‌ها", upgrade: "ارتقا", rerollLabel: (c, l) => `↻ ری‌رول (◆${c}) · ${l} مانده`, swapWeapon: "تعویضِ سلاح",
  featuredOffer: "پیشنهادِ ویژه — برای مجموعه‌ی تازه ری‌رول کن", showAll: "نمایشِ همه‌ی ارتقاها", deployNext: "استقرار — موجِ بعد →", max: "بیشینه",
  wonTitle: "ریفت مهروموم شد", lostTitle: "هسته شکست",
  wonSub: "هر پنج بخش را پاک کردی. افسانه‌ای.", lostSub: "میدان سقوط کرد — اما اسقاط تو را به یاد می‌سپارد.",
  score: "امتیاز", kills: "کشته‌ها", sectorLabel: "بخش", bestCombo: "بهترین کمبو",
  newAchievements: "دستاوردهای جدید", playAgain: "بازیِ دوباره ◈", copyResult: "📋 کپیِ نتیجه", backToMenu: "بازگشت به منو", resultCopied: "نتیجه در کلیپ‌بورد کپی شد",
  cMove: "حرکت", cAim: "نشانه‌گیری (شلیکِ خودکار)", cAbility1: "توانایی ۱", cAbility2: "توانایی ۲", cPause: "مکث / ادامه",
  guideTitle: "راهنمای بازی",
  guideIntro: "ریفت یک بازیِ بقای دو-استیک است: یک جنگنده‌ی تنها را هدایت می‌کنی که از یک هسته‌ی مرکزی در برابرِ موج‌های فزاینده‌ی دشمن در پنج بخش دفاع می‌کند و هر بخش با یک باس تمام می‌شود. حرکت کن، نشانه بگیر، ارتقا بده و زنده بمان.",
  guideGoalT: "هدفِ تو",
  guideGoal: "هم بدنه‌ی خودت و هم هسته را زنده نگه دار. دشمن‌ها به هسته هجوم می‌آورند و به تو هم حمله می‌کنند — اگر هرکدام از این دو نوار صفر شود، رانْ تمام می‌شود. هر شش موجِ یک بخش را پاک کن تا با باسش روبه‌رو شوی؛ پنج باس را شکست بده تا ریفت مهروموم شود.",
  guideControlsT: "کنترل‌ها",
  guideLoopT: "چرخه‌ی بازی",
  guideLoop: "به‌صورتِ خودکار به سمتِ نشانه‌گیری‌ات شلیک می‌کنی. روی جای‌گیری تمرکز کن: دشمن‌ها را بکش‌وقلاب کن، هسته را پشتِ سرت نگه دار و طلا (◆) و گویِ سبزِ سلامتی‌ای که می‌ریزند را بردار. بینِ موج‌ها زرادخانه باز می‌شود — طلا را خرجِ ارتقا کن یا سلاح عوض کن، بعد موجِ بعدی را مستقر کن.",
  guideHeroesT: "قهرمان‌ها، سلاح‌ها و توانایی‌ها",
  guideHeroes: "هر قهرمان یک قابلیتِ منفعلِ یکتا دارد؛ هر سلاح جورِ دیگری شلیک می‌کند؛ و تا دو تواناییِ فعال (کلیدهای ۱ و ۲) با زمانِ خنک‌شدن می‌گذاری. با کسبِ امتیازِ کل، قهرمان‌ها و سلاح‌های بیشتری باز می‌شوند. «بیلدِ پیشنهادی» در تبِ هر قهرمان یک ترکیبِ قویِ شروع می‌دهد.",
  guideTipsT: "نکته‌ها",
  guideTips: [
    "مدام حرکت کن — ایستادن یعنی محاصره شدن.",
    "نگذار دشمن‌ها آزادانه به هسته برسند؛ سدِ راهشان شو یا اول کمشان کن.",
    "یک توانایی را برای وقتی که موج اوج می‌گیرد یا باس خشمگین می‌شود نگه دار.",
    "اگر چیزی به بیلدت نمی‌خورد، فروشگاه را ری‌رول کن (◆).",
    "کریتیکال‌ها کمبو می‌سازند؛ کمبوی بالا امتیاز و طلا را چند برابر می‌کند.",
    "برای پوششِ زاویه‌هایی که نمی‌بینی، سنتری مستقر کن.",
  ],
};

export const riftDict: Record<Lang, RiftStrings> = { en, fa };
