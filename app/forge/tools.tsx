"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import * as F from "@/lib/forge/logic";
import { Btn, CopyBtn, ErrorNote, Field, Input, Output, Panel, Segmented, Stat, TextArea, Toggle, ToolShell } from "./ui";

/* ================================================================== *
 * JSON
 * ================================================================== */
function JsonTool() {
  const [input, setInput] = useState('{\n  "name": "Saleh",\n  "stack": ["React", "Next.js"],\n  "shipping": true\n}');
  const [indent, setIndent] = useState<"2" | "4" | "tab">("2");
  const [mode, setMode] = useState<"pretty" | "min" | "sort">("pretty");

  const result = useMemo(() => {
    const ind = indent === "tab" ? "\t" : Number(indent);
    if (mode === "min") return F.minifyJson(input);
    if (mode === "sort") return F.sortJsonKeys(input, ind as number);
    return F.formatJson(input, ind as number);
  }, [input, indent, mode]);
  const stats = useMemo(() => F.jsonStats(input), [input]);

  return (
    <ToolShell title="JSON Formatter" subtitle="Pretty-print, minify, sort keys and validate — with precise error locations.">
      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Segmented value={mode} onChange={setMode} options={[{ value: "pretty", label: "Pretty" }, { value: "min", label: "Minify" }, { value: "sort", label: "Sort keys" }]} />
          <Segmented value={indent} onChange={setIndent} options={[{ value: "2", label: "2 spaces" }, { value: "4", label: "4 spaces" }, { value: "tab", label: "Tabs" }]} />
        </div>
        <Field label="Input JSON">
          <TextArea value={input} onChange={setInput} rows={9} placeholder="Paste JSON here…" />
        </Field>
        {stats && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat value={stats.nodes} label="Nodes" />
            <Stat value={stats.keys} label="Keys" />
            <Stat value={stats.depth} label="Max depth" />
          </div>
        )}
      </Panel>
      <Panel>
        <ErrorNote message={result.error} />
        {result.ok && <Output value={result.output} label="Result" />}
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Base64
 * ================================================================== */
function Base64Tool() {
  const [input, setInput] = useState("Hello, Saleh 👋");
  const [dir, setDir] = useState<"enc" | "dec">("enc");
  const [urlSafe, setUrlSafe] = useState(false);

  const result = useMemo(() => {
    if (dir === "enc") return { ok: true, output: F.encodeBase64(input, urlSafe) };
    return F.decodeBase64(input);
  }, [input, dir, urlSafe]);

  return (
    <ToolShell title="Base64" subtitle="Encode or decode text to Base64, with URL-safe support.">
      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <Segmented value={dir} onChange={setDir} options={[{ value: "enc", label: "Encode" }, { value: "dec", label: "Decode" }]} />
          {dir === "enc" && <Toggle checked={urlSafe} onChange={setUrlSafe} label="URL-safe" />}
        </div>
        <Field label={dir === "enc" ? "Plain text" : "Base64"}>
          <TextArea value={input} onChange={setInput} rows={6} />
        </Field>
      </Panel>
      <Panel>
        <ErrorNote message={result.ok ? undefined : (result as F.JsonResult).error} />
        <Output value={result.output} />
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * URL
 * ================================================================== */
function UrlTool() {
  const [input, setInput] = useState("https://saleh.im/probe?ref=hero&lang=fa#top");
  const [dir, setDir] = useState<"enc" | "dec">("dec");
  const result = useMemo(() => (dir === "enc" ? { ok: true, output: F.encodeUrl(input) } : F.decodeUrl(input)), [input, dir]);
  const query = useMemo(() => F.parseQuery(input), [input]);

  return (
    <ToolShell title="URL Encoder" subtitle="Encode / decode URI components and break a URL into its query parameters.">
      <Panel>
        <div className="mb-3">
          <Segmented value={dir} onChange={setDir} options={[{ value: "enc", label: "Encode" }, { value: "dec", label: "Decode" }]} />
        </div>
        <Field label="URL / text">
          <TextArea value={input} onChange={setInput} rows={4} />
        </Field>
      </Panel>
      <Panel>
        <Output value={result.output} />
      </Panel>
      {query.length > 0 && (
        <Panel>
          <span className="label">Query parameters</span>
          <div className="mt-2 overflow-hidden rounded-xl border" style={{ borderColor: "var(--line)" }}>
            {query.map((q, i) => (
              <div key={i} className="grid grid-cols-[1fr_2fr] gap-2 border-b px-3 py-2 text-sm last:border-0" style={{ borderColor: "var(--line)" }}>
                <span className="mono font-medium accent-text break-words">{q.key}</span>
                <span className="mono break-words text-[var(--fg-2)]">{q.value || "—"}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </ToolShell>
  );
}

/* ================================================================== *
 * JWT
 * ================================================================== */
function JwtTool() {
  const [token, setToken] = useState(
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0IiwibmFtZSI6IlNhbGVoIiwiaWF0IjoxNzAwMDAwMDAwfQ.sig"
  );
  const parts = useMemo(() => F.decodeJwt(token), [token]);
  const expiry = useMemo(() => F.jwtExpiry(parts.payload), [parts]);

  return (
    <ToolShell title="JWT Decoder" subtitle="Inspect a JSON Web Token's header, payload and standard claims. Nothing is verified or sent anywhere.">
      <Panel>
        <Field label="Token">
          <TextArea value={token} onChange={setToken} rows={4} />
        </Field>
      </Panel>
      <ErrorNote message={parts.error} />
      {parts.ok && (
        <>
          {expiry && (
            <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: expiry.expired ? "rgba(239,68,68,.4)" : "rgba(34,197,94,.4)", color: expiry.expired ? "#ef4444" : "#22c55e", background: expiry.expired ? "rgba(239,68,68,.08)" : "rgba(34,197,94,.08)" }}>
              {expiry.expired ? "⚠ " : "✓ "}
              {expiry.label}
            </div>
          )}
          {parts.claims && parts.claims.length > 0 && (
            <Panel>
              <span className="label">Claims</span>
              <div className="mt-2 grid gap-1.5">
                {parts.claims.map((c) => (
                  <div key={c.key} className="grid grid-cols-[110px_1fr] gap-2 text-sm">
                    <span className="text-[var(--fg-2)]">{c.label}</span>
                    <span className="mono break-words">{c.value}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Panel><Output value={JSON.stringify(parts.header, null, 2)} label="Header" /></Panel>
            <Panel><Output value={JSON.stringify(parts.payload, null, 2)} label="Payload" /></Panel>
          </div>
        </>
      )}
    </ToolShell>
  );
}

/* ================================================================== *
 * Hash
 * ================================================================== */
function HashTool() {
  const [input, setInput] = useState("The quick brown fox");
  const [hashes, setHashes] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const algos = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
      const out: Record<string, string> = {};
      for (const a of algos) out[a] = await F.hashHex(a, input);
      if (alive) setHashes(out);
    })();
    return () => {
      alive = false;
    };
  }, [input]);

  return (
    <ToolShell title="Hash Generator" subtitle="SHA-1 / SHA-256 / SHA-384 / SHA-512 via the Web Crypto API — computed entirely in your browser.">
      <Panel>
        <Field label="Input">
          <TextArea value={input} onChange={setInput} rows={4} mono={false} />
        </Field>
      </Panel>
      {Object.entries(hashes).map(([algo, hex]) => (
        <Panel key={algo}>
          <Output value={hex} label={algo} />
        </Panel>
      ))}
    </ToolShell>
  );
}

/* ================================================================== *
 * ID generator
 * ================================================================== */
function IdTool() {
  const [kind, setKind] = useState<"uuid" | "ulid" | "nano">("uuid");
  const [count, setCount] = useState(5);
  const [ids, setIds] = useState<string[]>([]);
  const gen = () => {
    const n = F.clamp(count, 1, 200);
    const make = kind === "uuid" ? F.uuidv4 : kind === "ulid" ? F.ulid : () => F.nanoid();
    setIds(Array.from({ length: n }, make));
  };
  useEffect(gen, [kind, count]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ToolShell title="ID Generator" subtitle="Bulk-generate UUID v4, sortable ULID or compact Nano IDs.">
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={kind} onChange={setKind} options={[{ value: "uuid", label: "UUID v4" }, { value: "ulid", label: "ULID" }, { value: "nano", label: "Nano ID" }]} />
          <div className="flex items-center gap-2">
            <span className="label">Count</span>
            <input type="number" min={1} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-20 rounded-xl border bg-[var(--bg-3)] px-2 py-1.5 text-sm mono" style={{ borderColor: "var(--line-2)" }} />
          </div>
          <Btn accent onClick={gen}>↻ Regenerate</Btn>
        </div>
      </Panel>
      <Panel>
        <Output value={ids.join("\n")} label={`${ids.length} IDs`} />
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Colour
 * ================================================================== */
function ColorTool() {
  const [color, setColor] = useState("#b9ff3a");
  const [bg, setBg] = useState("#0b0c0e");
  const rgb = useMemo(() => F.parseColor(color), [color]);
  const bgRgb = useMemo(() => F.parseColor(bg), [bg]);
  const hsl = rgb ? F.rgbToHsl(rgb) : null;
  const ratio = rgb && bgRgb ? F.contrastRatio(rgb, bgRgb) : null;
  const rating = ratio ? F.wcagRating(ratio) : null;
  const palette = rgb ? F.shades(rgb) : [];

  return (
    <ToolShell title="Colour Studio" subtitle="Convert between HEX / RGB / HSL, generate a shade ramp and check WCAG contrast.">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Colour">
            <div className="flex gap-2">
              <input type="color" value={rgb ? F.rgbToHex(rgb) : "#000000"} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border" style={{ borderColor: "var(--line-2)" }} />
              <Input value={color} onChange={setColor} />
            </div>
          </Field>
          <Field label="Background (for contrast)">
            <div className="flex gap-2">
              <input type="color" value={bgRgb ? F.rgbToHex(bgRgb) : "#000000"} onChange={(e) => setBg(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border" style={{ borderColor: "var(--line-2)" }} />
              <Input value={bg} onChange={setBg} />
            </div>
          </Field>
        </div>
      </Panel>
      {rgb && hsl && (
        <Panel>
          <div className="grid grid-cols-3 gap-2">
            <Stat value={F.rgbToHex(rgb).toUpperCase()} label="HEX" />
            <Stat value={`${rgb.r}, ${rgb.g}, ${rgb.b}`} label="RGB" />
            <Stat value={`${hsl.h}° ${hsl.s}% ${hsl.l}%`} label="HSL" />
          </div>
        </Panel>
      )}
      {rating && ratio && (
        <Panel>
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-24 place-items-center rounded-xl text-sm font-semibold" style={{ background: bg, color }}>
              Aa
            </div>
            <div>
              <div className="font-display text-2xl font-semibold">{ratio.toFixed(2)}:1</div>
              <div className="mt-1 flex gap-1.5">
                {(["aa", "aaa", "aaLarge"] as const).map((k) => (
                  <span key={k} className="chip" style={rating[k] ? { color: "#22c55e", borderColor: "rgba(34,197,94,.4)" } : { color: "#ef4444", borderColor: "rgba(239,68,68,.4)" }}>
                    {k === "aaLarge" ? "AA Large" : k.toUpperCase()} {rating[k] ? "✓" : "✕"}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      )}
      {palette.length > 0 && (
        <Panel>
          <span className="label">Shade ramp</span>
          <div className="mt-2 flex overflow-hidden rounded-xl">
            {palette.map((c) => (
              <button key={c} onClick={() => setColor(c)} className="group relative h-16 flex-1 transition-transform hover:z-10 hover:scale-105" style={{ background: c }} title={c}>
                <span className="mono absolute inset-x-0 bottom-1 text-center text-[9px] opacity-0 transition-opacity group-hover:opacity-100" style={{ color: F.rgbToHsl(F.parseColor(c)!).l > 55 ? "#000" : "#fff" }}>{c}</span>
              </button>
            ))}
          </div>
        </Panel>
      )}
    </ToolShell>
  );
}

/* ================================================================== *
 * Timestamp
 * ================================================================== */
function TimeTool() {
  const [input, setInput] = useState(String(Math.floor(Date.now() / 1000)));
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const parts = useMemo(() => F.epochToParts(input), [input]);

  return (
    <ToolShell title="Timestamp Converter" subtitle="Convert Unix epoch (seconds or ms) or any date string into ISO / UTC / local / relative time.">
      <Panel>
        <div className="mb-3 flex flex-wrap gap-2">
          <Btn onClick={() => setInput(String(Math.floor(now / 1000)))}>Now (s)</Btn>
          <Btn onClick={() => setInput(String(now))}>Now (ms)</Btn>
        </div>
        <Field label="Timestamp or date" hint={`live: ${Math.floor(now / 1000)}`}>
          <Input value={input} onChange={setInput} />
        </Field>
      </Panel>
      <ErrorNote message={parts.error} />
      {parts.ok && (
        <Panel>
          <div className="grid gap-2 text-sm">
            {[
              ["ISO 8601", parts.iso!],
              ["UTC", parts.utc!],
              ["Local", parts.local!],
              ["Unix (ms)", String(parts.ms)],
              ["Relative", parts.relative!],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0" style={{ borderColor: "var(--line)" }}>
                <span className="text-[var(--fg-2)]">{k}</span>
                <span className="mono text-right break-all">{v}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </ToolShell>
  );
}

/* ================================================================== *
 * Cron
 * ================================================================== */
function CronTool() {
  const [expr, setExpr] = useState("*/15 9-17 * * 1-5");
  const parsed = useMemo(() => F.explainCron(expr), [expr]);
  const presets = [
    ["* * * * *", "Every minute"],
    ["0 * * * *", "Hourly"],
    ["0 0 * * *", "Daily at midnight"],
    ["0 9 * * 1-5", "Weekdays 9am"],
    ["*/15 * * * *", "Every 15 min"],
    ["0 0 1 * *", "Monthly"],
  ];
  return (
    <ToolShell title="Cron Explainer" subtitle="Translate a 5-field cron expression into plain English.">
      <Panel>
        <Field label="Cron expression" hint="minute hour day month weekday">
          <Input value={expr} onChange={setExpr} />
        </Field>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {presets.map(([p, l]) => (
            <button key={p} onClick={() => setExpr(p)} className="chip transition-transform hover:-translate-y-0.5">{l}</button>
          ))}
        </div>
      </Panel>
      <Panel>
        <ErrorNote message={parsed.error} />
        {parsed.ok && (
          <div className="flex items-center gap-3">
            <span className="text-2xl">🗓</span>
            <p className="text-lg">
              Runs <span className="accent-text font-medium">{parsed.text}</span>.
            </p>
          </div>
        )}
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Regex
 * ================================================================== */
function RegexTool() {
  const [pattern, setPattern] = useState("(\\w+)@(\\w+\\.\\w+)");
  const [flags, setFlags] = useState("gi");
  const [text, setText] = useState("Contact: salehcodez@gmail.com or hello@saleh.im");
  const res = useMemo(() => F.runRegex(pattern, flags, text), [pattern, flags, text]);

  const highlighted: ReactNode[] = useMemo(() => {
    if (!res.ok || res.matches.length === 0) return [text];
    const out: ReactNode[] = [];
    let last = 0;
    res.matches.forEach((m, i) => {
      if (m.index > last) out.push(text.slice(last, m.index));
      out.push(
        <mark key={i} style={{ background: "var(--accent)", color: "var(--on-accent)", borderRadius: 4, padding: "0 2px" }}>
          {m.match}
        </mark>
      );
      last = m.index + m.match.length;
    });
    if (last < text.length) out.push(text.slice(last));
    return out;
  }, [res, text]);

  return (
    <ToolShell title="Regex Tester" subtitle="Test a pattern against sample text, with live match highlighting and capture groups.">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="Pattern"><Input value={pattern} onChange={setPattern} /></Field>
          <Field label="Flags"><Input value={flags} onChange={setFlags} /></Field>
        </div>
        <div className="mt-3">
          <Field label="Test string"><TextArea value={text} onChange={setText} rows={5} mono={false} /></Field>
        </div>
      </Panel>
      <ErrorNote message={res.error} />
      {res.ok && (
        <>
          <Panel>
            <span className="label">Preview · {res.matches.length} match{res.matches.length !== 1 ? "es" : ""}</span>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{highlighted}</p>
          </Panel>
          {res.matches.length > 0 && (
            <Panel>
              <span className="label">Matches</span>
              <div className="mt-2 grid gap-1.5">
                {res.matches.slice(0, 100).map((m, i) => (
                  <div key={i} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--line)" }}>
                    <span className="mono accent-text">{m.match}</span>
                    <span className="mono ml-2 text-[10px] text-[var(--fg-2)]">@{m.index}</span>
                    {m.groups.length > 0 && (
                      <span className="mono ml-2 text-xs text-[var(--fg-2)]">[{m.groups.map((g) => g ?? "∅").join(", ")}]</span>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </ToolShell>
  );
}

/* ================================================================== *
 * Text tools
 * ================================================================== */
function TextTool() {
  const [text, setText] = useState("The Quick Brown Fox\njumps over\nthe lazy dog");
  const stats = useMemo(() => F.textStats(text), [text]);
  const transforms: [string, (s: string) => string][] = [
    ["UPPERCASE", (s) => s.toUpperCase()],
    ["lowercase", (s) => s.toLowerCase()],
    ["Title Case", F.toTitleCase],
    ["camelCase", F.toCamelCase],
    ["snake_case", F.toSnakeCase],
    ["kebab-case", F.toKebabCase],
    ["slug", F.slugify],
  ];
  return (
    <ToolShell title="Text Toolkit" subtitle="Case conversion, live counts and line operations (sort, dedupe, shuffle).">
      <Panel>
        <Field label="Text"><TextArea value={text} onChange={setText} rows={7} mono={false} /></Field>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Stat value={stats.words} label="Words" />
          <Stat value={stats.chars} label="Chars" />
          <Stat value={stats.charsNoSpace} label="No space" />
          <Stat value={stats.lines} label="Lines" />
          <Stat value={stats.sentences} label="Sentences" />
          <Stat value={stats.paragraphs} label="Paragraphs" />
        </div>
        <p className="mt-2 text-xs text-[var(--fg-2)]">{stats.readingTime}</p>
      </Panel>
      <Panel>
        <span className="label">Transform</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {transforms.map(([l, fn]) => (
            <button key={l} onClick={() => setText(fn(text))} className="chip mono transition-transform hover:-translate-y-0.5">{l}</button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button onClick={() => setText(F.sortLines(text, "asc", false))} className="chip">Sort A→Z</button>
          <button onClick={() => setText(F.sortLines(text, "desc", false))} className="chip">Sort Z→A</button>
          <button onClick={() => setText(F.sortLines(text, "asc", true))} className="chip">Sort + dedupe</button>
          <button onClick={() => setText(F.sortLines(text, "shuffle", false))} className="chip">Shuffle</button>
          <button onClick={() => setText(text.split("\n").reverse().join("\n"))} className="chip">Reverse lines</button>
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Number base
 * ================================================================== */
function BaseTool() {
  const [value, setValue] = useState("255");
  const [from, setFrom] = useState<"10" | "2" | "8" | "16">("10");
  const res = useMemo(() => F.convertBase(value, Number(from)), [value, from]);
  return (
    <ToolShell title="Number Base" subtitle="Convert between binary, octal, decimal and hexadecimal.">
      <Panel>
        <div className="mb-3">
          <Segmented value={from} onChange={setFrom} options={[{ value: "10", label: "DEC" }, { value: "2", label: "BIN" }, { value: "8", label: "OCT" }, { value: "16", label: "HEX" }]} />
        </div>
        <Field label={`Value (base ${from})`}><Input value={value} onChange={setValue} /></Field>
      </Panel>
      {res && (
        <Panel>
          <div className="grid gap-2">
            {[["Decimal", res.dec], ["Binary", res.bin], ["Octal", res.oct], ["Hex", res.hex]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="text-[var(--fg-2)]">{k}</span>
                <div className="flex items-center gap-2">
                  <span className="mono break-all">{v}</span>
                  <CopyBtn text={v} label="" />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </ToolShell>
  );
}

/* ================================================================== *
 * Markdown preview
 * ================================================================== */
function MarkdownTool() {
  const [md, setMd] = useState("# Hello, Forge\n\nA **markdown** preview with `code`, [links](https://saleh.im) and lists:\n\n- fast\n- private\n- *elegant*\n\n> Built by Saleh.");
  const html = useMemo(() => F.markdownToHtml(md), [md]);
  return (
    <ToolShell title="Markdown Preview" subtitle="A compact, live Markdown → HTML renderer.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel><Field label="Markdown"><TextArea value={md} onChange={setMd} rows={16} /></Field></Panel>
        <Panel>
          <span className="label">Preview</span>
          <div className="prose-forge mt-2 max-h-[440px] overflow-auto" dangerouslySetInnerHTML={{ __html: html }} />
        </Panel>
      </div>
    </ToolShell>
  );
}

/* ================================================================== *
 * HTML entities
 * ================================================================== */
function HtmlTool() {
  const [input, setInput] = useState('<a href="x">Tom & "Jerry"</a>');
  const [dir, setDir] = useState<"enc" | "dec">("enc");
  const out = dir === "enc" ? F.encodeHtml(input) : F.decodeHtml(input);
  return (
    <ToolShell title="HTML Entities" subtitle="Escape or unescape HTML special characters.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "enc", label: "Escape" }, { value: "dec", label: "Unescape" }]} /></div>
        <Field label="Input"><TextArea value={input} onChange={setInput} rows={5} /></Field>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Lorem ipsum
 * ================================================================== */
function LoremTool() {
  const [paras, setParas] = useState(3);
  const [text, setText] = useState(() => F.loremIpsum(3));
  return (
    <ToolShell title="Lorem Ipsum" subtitle="Generate placeholder paragraphs for mock-ups.">
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="label">Paragraphs</span>
            <input type="number" min={1} max={30} value={paras} onChange={(e) => setParas(Number(e.target.value))} className="w-20 rounded-xl border bg-[var(--bg-3)] px-2 py-1.5 text-sm mono" style={{ borderColor: "var(--line-2)" }} />
          </div>
          <Btn accent onClick={() => setText(F.loremIpsum(F.clamp(paras, 1, 30)))}>↻ Generate</Btn>
        </div>
      </Panel>
      <Panel><Output value={text} label="Text" /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Diff
 * ================================================================== */
function DiffTool() {
  const [a, setA] = useState("line one\nline two\nline three");
  const [b, setB] = useState("line one\nline 2\nline three\nline four");
  const rows = useMemo(() => F.lineDiff(a, b), [a, b]);
  const added = rows.filter((r) => r.type === "add").length;
  const removed = rows.filter((r) => r.type === "del").length;
  return (
    <ToolShell title="Text Diff" subtitle="A line-by-line diff (LCS) between two blocks of text.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel><Field label="Original"><TextArea value={a} onChange={setA} rows={9} /></Field></Panel>
        <Panel><Field label="Changed"><TextArea value={b} onChange={setB} rows={9} /></Field></Panel>
      </div>
      <Panel>
        <span className="label">Diff · <span style={{ color: "#22c55e" }}>+{added}</span> <span style={{ color: "#ef4444" }}>−{removed}</span></span>
        <div className="thin-scroll mt-2 max-h-[380px] overflow-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
          {rows.map((r, i) => (
            <div key={i} className="mono flex gap-2 px-3 py-0.5 text-sm" style={{ background: r.type === "add" ? "rgba(34,197,94,.12)" : r.type === "del" ? "rgba(239,68,68,.12)" : "transparent" }}>
              <span className="w-4 shrink-0 select-none" style={{ color: r.type === "add" ? "#22c55e" : r.type === "del" ? "#ef4444" : "var(--fg-2)" }}>
                {r.type === "add" ? "+" : r.type === "del" ? "−" : " "}
              </span>
              <span className="break-all">{r.text || " "}</span>
            </div>
          ))}
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Registry
 * ================================================================== */
export type ToolDef = {
  id: string;
  name: string;
  icon: string;
  category: string;
  keywords: string;
  render: () => ReactNode;
};

export const TOOLS: ToolDef[] = [
  { id: "json", name: "JSON Formatter", icon: "{ }", category: "Data", keywords: "json format pretty minify validate beautify", render: JsonTool },
  { id: "diff", name: "Text Diff", icon: "⇄", category: "Data", keywords: "diff compare text changes lcs", render: DiffTool },
  { id: "base64", name: "Base64", icon: "⧉", category: "Encode", keywords: "base64 encode decode url safe", render: Base64Tool },
  { id: "url", name: "URL Encoder", icon: "🔗", category: "Encode", keywords: "url encode decode query params uri", render: UrlTool },
  { id: "html", name: "HTML Entities", icon: "‹›", category: "Encode", keywords: "html entities escape unescape", render: HtmlTool },
  { id: "jwt", name: "JWT Decoder", icon: "🎫", category: "Encode", keywords: "jwt json web token decode claims", render: JwtTool },
  { id: "hash", name: "Hash", icon: "#", category: "Generate", keywords: "hash sha1 sha256 sha512 digest checksum", render: HashTool },
  { id: "id", name: "ID Generator", icon: "⚇", category: "Generate", keywords: "uuid ulid nanoid guid generate identifier", render: IdTool },
  { id: "lorem", name: "Lorem Ipsum", icon: "¶", category: "Generate", keywords: "lorem ipsum placeholder text dummy", render: LoremTool },
  { id: "color", name: "Colour Studio", icon: "◐", category: "Convert", keywords: "color colour hex rgb hsl contrast wcag palette shades", render: ColorTool },
  { id: "time", name: "Timestamp", icon: "◷", category: "Convert", keywords: "time timestamp epoch unix date iso convert", render: TimeTool },
  { id: "base", name: "Number Base", icon: "⑯", category: "Convert", keywords: "number base binary octal decimal hex convert radix", render: BaseTool },
  { id: "text", name: "Text Toolkit", icon: "Aa", category: "Text", keywords: "text case camel snake kebab slug count sort dedupe", render: TextTool },
  { id: "regex", name: "Regex Tester", icon: ".*", category: "Text", keywords: "regex regular expression match groups test pattern", render: RegexTool },
  { id: "cron", name: "Cron Explainer", icon: "🗓", category: "Text", keywords: "cron schedule crontab explain", render: CronTool },
  { id: "markdown", name: "Markdown", icon: "M↓", category: "Text", keywords: "markdown md preview render html", render: MarkdownTool },
];

export const CATEGORIES = ["Data", "Encode", "Generate", "Convert", "Text"];
