/* ============================================================================
   Lumen — technical-analysis engine.

   Pure, dependency-free implementations of the indicators a real markets
   dashboard uses: moving averages, RSI, MACD, Bollinger Bands, realised
   volatility, momentum/ROC, linear-regression trend, drawdown, a Sharpe-style
   ratio, Pearson correlation and a composite bull/bear signal. Everything is
   computed locally from the live price series Lumen already fetches.
   ========================================================================== */

export type MacdResult = { macd: number[]; signal: number[]; histogram: number[] };
export type Bollinger = { mid: number[]; upper: number[]; lower: number[] };
export type Trend = { slope: number; r2: number; direction: "up" | "down" | "flat" };
export type Signal = {
  score: number; // -100..100
  label: "strong-sell" | "sell" | "neutral" | "buy" | "strong-buy";
  rsi: number;
  macdHist: number;
  trend: Trend["direction"];
};

export type SeriesAnalysis = {
  last: number;
  changePct: number;
  sma20: number | null;
  sma50: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi: number;
  macd: { macd: number; signal: number; hist: number };
  bollinger: { upper: number; mid: number; lower: number; percentB: number };
  volatility: number; // annualised %, rough
  momentum: number; // % over lookback
  trend: Trend;
  drawdown: number; // max drawdown %
  sharpe: number;
  support: number;
  resistance: number;
  pivot: number;
  signal: Signal;
};

/* -------------------------------------------------------------------------- */

export function sma(data: number[], period: number): number[] {
  if (period <= 0 || data.length < period) return [];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    if (i >= period - 1) out.push(sum / period);
  }
  return out;
}

export function ema(data: number[], period: number): number[] {
  if (period <= 0 || data.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = data[0];
  out.push(prev);
  for (let i = 1; i < data.length; i++) {
    prev = data[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function rsi(data: number[], period = 14): number {
  if (data.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

export function macd(data: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  if (data.length < slow) return { macd: [], signal: [], histogram: [] };
  const emaFast = ema(data, fast);
  const emaSlow = ema(data, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = ema(macdLine, signalPeriod);
  const histogram = macdLine.map((v, i) => v - (signalLine[i] ?? 0));
  return { macd: macdLine, signal: signalLine, histogram };
}

export function stdev(data: number[]): number {
  if (data.length < 2) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((a, b) => a + (b - mean) ** 2, 0) / data.length;
  return Math.sqrt(variance);
}

export function bollinger(data: number[], period = 20, mult = 2): Bollinger {
  const mids = sma(data, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < mids.length; i++) {
    const window = data.slice(i, i + period);
    const sd = stdev(window);
    upper.push(mids[i] + mult * sd);
    lower.push(mids[i] - mult * sd);
  }
  return { mid: mids, upper, lower };
}

/** Daily returns as fractions. */
export function returns(data: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i - 1] !== 0) out.push((data[i] - data[i - 1]) / data[i - 1]);
  }
  return out;
}

/** Rough annualised volatility (%) from the return series. */
export function volatility(data: number[], periodsPerYear = 365): number {
  const r = returns(data);
  if (r.length < 2) return 0;
  return Math.round(stdev(r) * Math.sqrt(periodsPerYear) * 100 * 10) / 10;
}

/** Rate of change over the full lookback (%). */
export function momentum(data: number[]): number {
  if (data.length < 2 || data[0] === 0) return 0;
  return Math.round(((data[data.length - 1] - data[0]) / data[0]) * 100 * 10) / 10;
}

/** Least-squares slope + R² over an index axis. */
export function linreg(data: number[]): Trend {
  const n = data.length;
  if (n < 2) return { slope: 0, r2: 0, direction: "flat" };
  let sx = 0, sy = 0, sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += data[i];
    sxy += i * data[i];
    sxx += i * i;
    syy += data[i] * data[i];
  }
  const denom = n * sxx - sx * sx;
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const rNum = n * sxy - sx * sy;
  const rDen = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy)) || 1;
  const r = rNum / rDen;
  const mean = sy / n;
  const normSlope = mean !== 0 ? slope / mean : 0;
  const direction: Trend["direction"] = normSlope > 0.0008 ? "up" : normSlope < -0.0008 ? "down" : "flat";
  return { slope: normSlope, r2: Math.round(r * r * 100) / 100, direction };
}

export function maxDrawdown(data: number[]): number {
  let peak = data[0] ?? 0;
  let maxDd = 0;
  for (const v of data) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (peak - v) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return Math.round(maxDd * 100 * 10) / 10;
}

/** Sharpe-style ratio (risk-free = 0) on the return series. */
export function sharpe(data: number[]): number {
  const r = returns(data);
  if (r.length < 2) return 0;
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = stdev(r) || 1e-9;
  return Math.round((mean / sd) * Math.sqrt(365) * 100) / 100;
}

/** Pearson correlation between two equal-length series (auto-trims). */
export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ra = returns(a.slice(-n));
  const rb = returns(b.slice(-n));
  const m = Math.min(ra.length, rb.length);
  if (m < 3) return 0;
  const x = ra.slice(-m);
  const y = rb.slice(-m);
  const mx = x.reduce((s, v) => s + v, 0) / m;
  const my = y.reduce((s, v) => s + v, 0) / m;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < m; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy) || 1e-9;
  return Math.round((num / den) * 100) / 100;
}

/** Classic floor-trader pivot points from a window's high/low/close. */
export function pivots(data: number[]): { support: number; resistance: number; pivot: number } {
  if (data.length === 0) return { support: 0, resistance: 0, pivot: 0 };
  const high = Math.max(...data);
  const low = Math.min(...data);
  const close = data[data.length - 1];
  const pivot = (high + low + close) / 3;
  return {
    pivot: round(pivot),
    resistance: round(2 * pivot - low),
    support: round(2 * pivot - high),
  };
}

function round(n: number): number {
  if (n >= 100) return Math.round(n * 100) / 100;
  if (n >= 1) return Math.round(n * 10000) / 10000;
  return Math.round(n * 1e6) / 1e6;
}

/* -------------------------------------------------------------------------- */

export function compositeSignal(data: number[]): Signal {
  const r = rsi(data);
  const m = macd(data);
  const hist = m.histogram[m.histogram.length - 1] ?? 0;
  const t = linreg(data);

  let score = 0;
  // RSI contribution
  if (r < 30) score += 35;
  else if (r < 45) score += 15;
  else if (r > 70) score -= 35;
  else if (r > 55) score -= 15;
  // MACD histogram
  score += Math.max(-30, Math.min(30, hist * 40));
  // Trend
  if (t.direction === "up") score += 30 * (0.4 + t.r2 * 0.6);
  else if (t.direction === "down") score -= 30 * (0.4 + t.r2 * 0.6);

  score = Math.max(-100, Math.min(100, Math.round(score)));
  const label: Signal["label"] =
    score >= 50 ? "strong-buy" : score >= 18 ? "buy" : score <= -50 ? "strong-sell" : score <= -18 ? "sell" : "neutral";

  return { score, label, rsi: r, macdHist: Math.round(hist * 1e4) / 1e4, trend: t.direction };
}

export function analyzeSeries(data: number[]): SeriesAnalysis | null {
  if (!data || data.length < 5) return null;
  const last = data[data.length - 1];
  const first = data[0];
  const changePct = first !== 0 ? ((last - first) / first) * 100 : 0;

  const sma20arr = sma(data, 20);
  const sma50arr = sma(data, 50);
  const ema12arr = ema(data, 12);
  const ema26arr = ema(data, 26);
  const m = macd(data);
  const boll = bollinger(data, 20, 2);
  const bUpper = boll.upper[boll.upper.length - 1] ?? last;
  const bLower = boll.lower[boll.lower.length - 1] ?? last;
  const bMid = boll.mid[boll.mid.length - 1] ?? last;
  const percentB = bUpper !== bLower ? ((last - bLower) / (bUpper - bLower)) * 100 : 50;
  const piv = pivots(data);

  return {
    last,
    changePct: Math.round(changePct * 100) / 100,
    sma20: sma20arr[sma20arr.length - 1] ?? null,
    sma50: sma50arr[sma50arr.length - 1] ?? null,
    ema12: ema12arr[ema12arr.length - 1] ?? null,
    ema26: ema26arr[ema26arr.length - 1] ?? null,
    rsi: rsi(data),
    macd: {
      macd: Math.round((m.macd[m.macd.length - 1] ?? 0) * 1e4) / 1e4,
      signal: Math.round((m.signal[m.signal.length - 1] ?? 0) * 1e4) / 1e4,
      hist: Math.round((m.histogram[m.histogram.length - 1] ?? 0) * 1e4) / 1e4,
    },
    bollinger: { upper: bUpper, mid: bMid, lower: bLower, percentB: Math.round(percentB) },
    volatility: volatility(data),
    momentum: momentum(data),
    trend: linreg(data),
    drawdown: maxDrawdown(data),
    sharpe: sharpe(data),
    support: piv.support,
    resistance: piv.resistance,
    pivot: piv.pivot,
    signal: compositeSignal(data),
  };
}

/* --------------------------------------------------------------------------
   Market-wide breadth from a list of {change24h}
   ------------------------------------------------------------------------ */

export type Breadth = {
  advancers: number;
  decliners: number;
  flat: number;
  breadthPct: number; // % advancing
  avgChange: number;
  strongest: number;
  weakest: number;
};

export function marketBreadth(changes: number[]): Breadth {
  let up = 0, down = 0, flat = 0;
  for (const c of changes) {
    if (c > 0.05) up++;
    else if (c < -0.05) down++;
    else flat++;
  }
  const total = changes.length || 1;
  return {
    advancers: up,
    decliners: down,
    flat,
    breadthPct: Math.round((up / total) * 100),
    avgChange: Math.round((changes.reduce((a, b) => a + b, 0) / total) * 100) / 100,
    strongest: changes.length ? Math.max(...changes) : 0,
    weakest: changes.length ? Math.min(...changes) : 0,
  };
}

export function signalColor(label: Signal["label"]): string {
  switch (label) {
    case "strong-buy": return "#16a34a";
    case "buy": return "#22c55e";
    case "sell": return "#f97316";
    case "strong-sell": return "#ef4444";
    default: return "#eab308";
  }
}

export function signalLabelText(label: Signal["label"], fa: boolean): string {
  const map: Record<Signal["label"], [string, string]> = {
    "strong-buy": ["Strong buy", "خریدِ قوی"],
    buy: ["Buy", "خرید"],
    neutral: ["Neutral", "خنثی"],
    sell: ["Sell", "فروش"],
    "strong-sell": ["Strong sell", "فروشِ قوی"],
  };
  return fa ? map[label][1] : map[label][0];
}
