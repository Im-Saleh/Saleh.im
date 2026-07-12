export type Lang = "en" | "fa";

export const LANGS: Lang[] = ["en", "fa"];
export const DEFAULT_LANG: Lang = "en";
export const LANG_KEY = "saleh-lang";

/** Runs before paint so the correct lang/dir/theme is set with no flash. */
export const NO_FLASH_LANG = `(function(){try{var l=localStorage.getItem('${LANG_KEY}');if(l!=='fa'&&l!=='en'){l='${DEFAULT_LANG}';}document.documentElement.setAttribute('lang',l);document.documentElement.setAttribute('dir',l==='fa'?'rtl':'ltr');}catch(e){document.documentElement.setAttribute('lang','${DEFAULT_LANG}');document.documentElement.setAttribute('dir','ltr');}})();`;

type Dict = {
  nav: { about: string; skills: string; journey: string; work: string; shell: string; contact: string; menu: string };
  hero: {
    available: string;
    build: string;
    rotating: string[];
    bio: string;
    seeWork: string;
    sayHello: string;
    est: string;
    stats: { years: string; repos: string; langs: string; curiosity: string };
    ipLabel: string;
    ipResolving: string;
  };
  about: {
    eyebrow: string;
    lead1: string; leadAccent: string; lead2: string; lead3: string;
    p1: string; p2: string;
    since: string;
    glance: { role: string; focus: string; since: string; based: string; status: string; open: string; focusVal: string };
  };
  skills: { eyebrow: string; heading1: string; heading2: string; sub: string };
  journey: { eyebrow: string; heading: string; range: string };
  projects: { eyebrow: string; heading1: string; heading2: string; all: string; live: string; repoBadge: string };
  shell: { eyebrow: string; heading1: string; heading2: string; sub: string; typeHelp: string; orOpen: string };
  contact: { eyebrow: string; heading1: string; heading2: string; sub: string; cta: string; email: string; telegram: string; github: string; write: string; message: string; follow: string };
  footer: { built: string; top: string };
  theme: { pick: string; dark: string; light: string };
};

const en: Dict = {
  nav: { about: "About", skills: "Skills", journey: "Journey", work: "Work", shell: "Shell", contact: "Contact", menu: "Menu" },
  hero: {
    available: "Available for freelance",
    build: "I build fast things",
    rotating: ["for the web.", "over WebRTC.", "in the browser.", "with real-time.", "with obsession."],
    bio: "Self-taught software engineer crafting fast, elegant products for the web — from real-time collaboration tools to end-to-end encrypted messengers. Shipping in public since 2022.",
    seeWork: "See the work",
    sayHello: "Say hello",
    est: "EST. 2022",
    stats: { years: "Years shipping", repos: "Projects built", langs: "Languages", curiosity: "Curiosity" },
    ipLabel: "your connection",
    ipResolving: "resolving…",
  },
  about: {
    eyebrow: "01 / Who",
    lead1: "I'm a software engineer who learned to code by ",
    leadAccent: "breaking things",
    lead2: ", reading source, and shipping in public — not by following ",
    lead3: "tutorials.",
    p1: "I love turning hard problems into fast, reliable products — and wrapping them in interfaces that feel effortless. Performance, resilience and craft matter to me on every screen.",
    p2: "I move across the whole stack — polished React front-ends, real-time back-ends, and end-to-end encrypted apps — and I sweat the details: speed, accessibility, and design that has an actual point of view.",
    since: "building since 2022",
    glance: { role: "Role", focus: "Focus", since: "Since", based: "Based", status: "Status", open: "Open to work", focusVal: "Web · Real-time · Security" },
  },
  skills: {
    eyebrow: "02 / Capabilities",
    heading1: "What I actually",
    heading2: "know how to do.",
    sub: "Not a wall of logos. Three domains I've shipped real, running software in — tap any skill to read the story behind it.",
  },
  journey: { eyebrow: "03 / Journey", heading: "The road so far", range: "2022 → now" },
  projects: {
    eyebrow: "04 / Selected work",
    heading1: "Things I've",
    heading2: "built.",
    all: "More on GitHub",
    live: "Live · in-browser",
    repoBadge: "Project",
  },
  shell: {
    eyebrow: "05 / Shell",
    heading1: "Prefer a",
    heading2: "terminal?",
    sub: "A real, interactive shell. It boots on its own — then it's yours.",
    typeHelp: "help",
    orOpen: "open messenger",
  },
  contact: {
    eyebrow: "06 / Contact",
    heading1: "Let's build something",
    heading2: "fast and beautiful.",
    sub: "Open to freelance and collaboration. Telegram or email is the quickest way to reach me — I usually reply within a day.",
    cta: "Start a conversation",
    email: "Email", telegram: "Telegram", github: "GitHub",
    write: "Write", message: "Message", follow: "Follow",
  },
  footer: { built: "Built with Next.js · deployed on the edge.", top: "Top" },
  theme: { pick: "Theme", dark: "Dark", light: "Light" },
};

const fa: Dict = {
  nav: { about: "درباره", skills: "مهارت‌ها", journey: "مسیر", work: "کارها", shell: "ترمینال", contact: "تماس", menu: "منو" },
  hero: {
    available: "آماده‌ی همکاری",
    build: "چیزهای سریع می‌سازم",
    rotating: ["برای وب.", "با WebRTC.", "در مرورگر.", "به‌صورت زنده.", "با وسواس."],
    bio: "مهندس نرم‌افزار خودآموخته؛ سازنده‌ی محصولات سریع و خوش‌ساخت برای وب — از ابزارهای همکاری زنده تا پیام‌رسان‌های رمزنگاری‌شده‌ی سرتاسری. از سال ۲۰۲۲ در حال ساختن و انتشار عمومی.",
    seeWork: "دیدن کارها",
    sayHello: "سلام کن",
    est: "از ۲۰۲۲",
    stats: { years: "سال تجربه", repos: "پروژه‌ی ساخته‌شده", langs: "زبان برنامه‌نویسی", curiosity: "کنجکاوی" },
    ipLabel: "اتصال شما",
    ipResolving: "در حال دریافت…",
  },
  about: {
    eyebrow: "۰۱ / درباره",
    lead1: "مهندس نرم‌افزاری‌ام که برنامه‌نویسی را با ",
    leadAccent: "خراب‌کردن چیزها",
    lead2: "، خواندن سورس و انتشار عمومی یاد گرفت — نه با دنبال‌کردن ",
    lead3: "آموزش‌های آماده.",
    p1: "عاشق این‌ام که مسائل سخت را به محصولاتی سریع و قابل‌اعتماد تبدیل کنم و در رابط‌هایی بپیچم که استفاده از آن‌ها بی‌دردسر باشد. کارایی، پایداری و ظرافت در هر صفحه برایم مهم است.",
    p2: "در تمام لایه‌های استک کار می‌کنم — رابط‌های تروتمیز با React، بک‌اندهای زنده، و اپ‌های رمزنگاری‌شده‌ی سرتاسری — و روی جزئیات وسواس دارم: سرعت، دسترس‌پذیری، و طراحی‌ای که دیدگاه دارد.",
    since: "در حال ساختن از ۲۰۲۲",
    glance: { role: "نقش", focus: "تمرکز", since: "از سال", based: "مقیم", status: "وضعیت", open: "آماده‌ی همکاری", focusVal: "وب · زنده · امنیت" },
  },
  skills: {
    eyebrow: "۰۲ / توانمندی‌ها",
    heading1: "کاری که واقعاً",
    heading2: "بلدم انجام بدهم.",
    sub: "دیوارِ لوگو نیست. سه حوزه‌ای که در آن‌ها نرم‌افزار واقعی و در حال اجرا ساخته‌ام — روی هر مهارت بزن تا داستانش را بخوانی.",
  },
  journey: { eyebrow: "۰۳ / مسیر", heading: "راهی که تا اینجا آمده‌ام", range: "۲۰۲۲ ← اکنون" },
  projects: {
    eyebrow: "۰۴ / کارهای منتخب",
    heading1: "چیزهایی که",
    heading2: "ساخته‌ام.",
    all: "بیشتر در گیت‌هاب",
    live: "زنده · داخل مرورگر",
    repoBadge: "پروژه",
  },
  shell: {
    eyebrow: "۰۵ / ترمینال",
    heading1: "ترمینال را",
    heading2: "ترجیح می‌دهی؟",
    sub: "یک شل واقعی و تعاملی. خودش بالا می‌آید — بعد در اختیار توست.",
    typeHelp: "help",
    orOpen: "open messenger",
  },
  contact: {
    eyebrow: "۰۶ / تماس",
    heading1: "بیا چیزی بسازیم که",
    heading2: "سریع و زیبا باشد.",
    sub: "آماده‌ی همکاری آزاد و پروژه‌های مشترک. سریع‌ترین راه ارتباط، تلگرام یا ایمیل است — معمولاً ظرف یک روز پاسخ می‌دهم.",
    cta: "شروع گفتگو",
    email: "ایمیل", telegram: "تلگرام", github: "گیت‌هاب",
    write: "بنویس", message: "پیام بده", follow: "دنبال کن",
  },
  footer: { built: "ساخته‌شده با Next.js · مستقر روی لبه.", top: "بالا" },
  theme: { pick: "پوسته", dark: "تیره", light: "روشن" },
};

export const dict: Record<Lang, Dict> = { en, fa };
