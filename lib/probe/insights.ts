/* ============================================================================
   Probe — exposure findings & connection-quality analysis.

   Turns the raw signals into a prioritised, human-readable list of exposure
   findings (each with severity + plain-language advice) and a connection
   quality read-out derived from the live latency history. Pure functions,
   fully local.
   ========================================================================== */

export type Severity = "high" | "medium" | "low" | "info";

export type Finding = {
  id: string;
  severity: Severity;
  title: string;
  faTitle: string;
  detail: string;
  faDetail: string;
};

export type FindingInput = {
  localLeak: boolean;
  publicLeak: boolean;
  masking: number; // 0..100
  connectionKind: string;
  geoCc?: string;
  trueCc?: string;
  jurisdictionConfidence: number;
  geolocationGranted: boolean;
  uniqueness: number; // 0..100
  timeSkewMs: number | null;
  httpProtocol: string;
  secureContext: boolean | null;
  gpc: boolean;
  dnt: boolean;
  camerasMics: number;
};

const SEV_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2, info: 3 };

export function deriveFindings(x: FindingInput): Finding[] {
  const out: Finding[] = [];

  if (x.localLeak) {
    out.push({
      id: "webrtc-leak",
      severity: "high",
      title: "WebRTC exposes your local IP",
      faTitle: "WebRTC آی‌پیِ محلی را افشا می‌کند",
      detail: "A private/LAN address leaked through ICE candidates. Sites can read it without permission — disable WebRTC or use an extension that masks it.",
      faDetail: "یک آدرسِ محلی از طریقِ کاندیداهای ICE فاش شد. سایت‌ها می‌توانند بدونِ اجازه آن را بخوانند — WebRTC را غیرفعال کن یا از افزونه‌ای برای پنهان‌کردنش استفاده کن.",
    });
  }

  if (x.masking >= 65) {
    out.push({
      id: "masked-strong",
      severity: "info",
      title: "Connection looks masked",
      faTitle: "اتصال پنهان‌شده به‌نظر می‌رسد",
      detail: "Strong indicators suggest traffic is routed through a tunnel or hosting network rather than a home line.",
      faDetail: "نشانه‌های قوی حاکی از آن است که ترافیک به‌جای خطِ خانگی از یک تونل یا شبکه‌ی میزبانی عبور می‌کند.",
    });
  } else if (x.masking >= 35) {
    out.push({
      id: "masked-maybe",
      severity: "low",
      title: "Possible path masking",
      faTitle: "احتمالِ پنهان‌سازیِ مسیر",
      detail: "Some geographic signals disagree with the IP location.",
      faDetail: "برخی سیگنال‌های جغرافیایی با موقعیتِ آی‌پی هم‌خوان نیستند.",
    });
  }

  if (x.geoCc && x.trueCc && x.geoCc.toUpperCase() !== x.trueCc.toUpperCase()) {
    out.push({
      id: "geo-mismatch",
      severity: "medium",
      title: "IP country differs from device signals",
      faTitle: "کشورِ آی‌پی با سیگنال‌های دستگاه فرق دارد",
      detail: `Your IP resolves to ${x.geoCc.toUpperCase()} but device signals point to ${x.trueCc.toUpperCase()} (${x.jurisdictionConfidence}% confidence).`,
      faDetail: `آی‌پیِ شما به ${x.geoCc.toUpperCase()} می‌رسد اما سیگنال‌های دستگاه به ${x.trueCc.toUpperCase()} اشاره دارند (قطعیت ${x.jurisdictionConfidence}٪).`,
    });
  }

  if (x.geolocationGranted) {
    out.push({
      id: "geo-granted",
      severity: "medium",
      title: "Precise location is permitted",
      faTitle: "موقعیتِ دقیق مجاز است",
      detail: "This origin can read GPS-grade coordinates. Revoke it in site settings if not needed.",
      faDetail: "این سایت می‌تواند مختصاتِ دقیق را بخواند. اگر لازم نیست، در تنظیماتِ سایت لغوش کن.",
    });
  }

  if (x.uniqueness >= 66) {
    out.push({
      id: "high-uniqueness",
      severity: "medium",
      title: "Highly identifiable fingerprint",
      faTitle: "اثرانگشتِ بسیار شناسایی‌پذیر",
      detail: "Your combination of capabilities is uncommon, making cookieless tracking easier.",
      faDetail: "ترکیبِ قابلیت‌های شما نادر است و ردیابیِ بدونِ کوکی را آسان‌تر می‌کند.",
    });
  }

  if (x.timeSkewMs != null && Math.abs(x.timeSkewMs) > 120_000) {
    out.push({
      id: "clock-skew",
      severity: "low",
      title: "System clock is off",
      faTitle: "ساعتِ سیستم دقیق نیست",
      detail: `Your clock differs from server time by ~${Math.round(Math.abs(x.timeSkewMs) / 1000)}s, which can break TLS and TOTP.`,
      faDetail: `ساعتِ شما حدودِ ${Math.round(Math.abs(x.timeSkewMs) / 1000)} ثانیه با زمانِ سرور اختلاف دارد که می‌تواند TLS و TOTP را مختل کند.`,
    });
  }

  if (x.httpProtocol && /^http\/1/i.test(x.httpProtocol)) {
    out.push({
      id: "http1",
      severity: "low",
      title: "Legacy HTTP/1.x in use",
      faTitle: "استفاده از HTTP/1.x قدیمی",
      detail: "This connection isn't using HTTP/2 or HTTP/3 — expect slower multiplexing.",
      faDetail: "این اتصال از HTTP/2 یا HTTP/3 استفاده نمی‌کند — مالتی‌پلکسِ کندتری خواهی داشت.",
    });
  }

  if (x.secureContext === false) {
    out.push({
      id: "insecure-context",
      severity: "high",
      title: "Not a secure context",
      faTitle: "زمینه‌ی ناامن",
      detail: "The page isn't running over HTTPS; sensitive APIs and encryption guarantees are weakened.",
      faDetail: "صفحه روی HTTPS اجرا نمی‌شود؛ APIهای حساس و تضمین‌های رمزنگاری تضعیف می‌شوند.",
    });
  }

  // positive / informational notes
  if (x.gpc || x.dnt) {
    out.push({
      id: "privacy-signals",
      severity: "info",
      title: "Privacy signals are on",
      faTitle: "سیگنال‌های حریمِ خصوصی روشن‌اند",
      detail: `You broadcast ${[x.gpc && "GPC", x.dnt && "DNT"].filter(Boolean).join(" + ")} — compliant sites should respect it.`,
      faDetail: `شما ${[x.gpc && "GPC", x.dnt && "DNT"].filter(Boolean).join(" + ")} می‌فرستی — سایت‌های سازگار باید رعایتش کنند.`,
    });
  }

  if (!x.localLeak && x.masking < 35 && x.uniqueness < 40 && !x.geolocationGranted) {
    out.push({
      id: "clean",
      severity: "info",
      title: "No major exposure detected",
      faTitle: "افشای مهمی شناسایی نشد",
      detail: "Your basic exposure surface looks reasonable for a normal browser session.",
      faDetail: "سطحِ افشای پایه‌ی شما برای یک نشستِ عادیِ مرورگر منطقی به‌نظر می‌رسد.",
    });
  }

  return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}

/* --------------------------------------------------------------------------
   Connection quality from latency history (avg, jitter, loss, 0..100 score)
   ------------------------------------------------------------------------ */

export type Quality = {
  score: number;
  avg: number;
  jitter: number;
  loss: number;
  label: string;
  faLabel: string;
};

export function connectionQuality(histories: number[][]): Quality {
  const samples: number[] = [];
  let total = 0;
  let lost = 0;
  for (const h of histories) {
    for (const v of h) {
      total++;
      if (v <= 0) lost++;
      else samples.push(v);
    }
  }
  if (samples.length === 0) {
    return { score: 0, avg: 0, jitter: 0, loss: 0, label: "no data", faLabel: "بدونِ داده" };
  }
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  // jitter = mean absolute consecutive difference
  let diffs = 0;
  for (let i = 1; i < samples.length; i++) diffs += Math.abs(samples[i] - samples[i - 1]);
  const jitter = samples.length > 1 ? diffs / (samples.length - 1) : 0;
  const loss = total > 0 ? (lost / total) * 100 : 0;

  let score = 100;
  score -= Math.min(45, (avg / 300) * 45); // latency penalty
  score -= Math.min(30, (jitter / 120) * 30); // jitter penalty
  score -= Math.min(25, loss); // loss penalty
  score = Math.max(0, Math.round(score));

  const label = score >= 80 ? "excellent" : score >= 60 ? "good" : score >= 40 ? "fair" : "poor";
  const faLabel = score >= 80 ? "عالی" : score >= 60 ? "خوب" : score >= 40 ? "متوسط" : "ضعیف";
  return { score, avg: Math.round(avg), jitter: Math.round(jitter), loss: Math.round(loss), label, faLabel };
}
