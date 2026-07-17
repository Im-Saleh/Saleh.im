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
  { id: "csvjson", name: "CSV ⇄ JSON", icon: "⊞", category: "Data", keywords: "csv json convert table spreadsheet", render: CsvJsonTool },
  { id: "jsonts", name: "JSON → TS", icon: "TS", category: "Data", keywords: "json typescript interface types generate", render: JsonTsTool },
  { id: "escape", name: "String Escape", icon: "\\n", category: "Encode", keywords: "escape unescape json javascript string quote", render: EscapeTool },
  { id: "morse", name: "Morse Code", icon: "· −", category: "Encode", keywords: "morse code dot dash telegraph", render: MorseTool },
  { id: "binary", name: "Binary ⇄ Text", icon: "01", category: "Encode", keywords: "binary text bits bytes ascii", render: BinaryTool },
  { id: "password", name: "Password", icon: "🔑", category: "Generate", keywords: "password generate random secure strength", render: PasswordTool },
  { id: "chmod", name: "chmod", icon: "rwx", category: "Convert", keywords: "chmod unix permissions octal file mode", render: ChmodTool },
  { id: "roman", name: "Roman Numerals", icon: "Ⅻ", category: "Convert", keywords: "roman numerals number convert", render: RomanTool },
  { id: "units", name: "Unit Converter", icon: "⇌", category: "Convert", keywords: "unit convert length mass data time temperature", render: UnitsTool },
  { id: "unicode", name: "Unicode", icon: "U+", category: "Text", keywords: "unicode ascii char code point inspect", render: UnicodeTool },
  { id: "gradient", name: "CSS Gradient", icon: "▧", category: "CSS", keywords: "css gradient linear radial background color", render: GradientTool },
  { id: "shadow", name: "Box Shadow", icon: "▢", category: "CSS", keywords: "css box shadow generator elevation", render: ShadowTool },
  { id: "bezier", name: "Cubic Bezier", icon: "∿", category: "CSS", keywords: "css cubic bezier easing animation timing curve", render: BezierTool },
  { id: "crc", name: "CRC32", icon: "≋", category: "Data", keywords: "crc32 checksum hash integrity", render: CrcTool },
  { id: "jsonquery", name: "JSON ⇄ Query", icon: "&?", category: "Data", keywords: "json query string url params convert", render: JsonQueryTool },
  { id: "base58", name: "Base58", icon: "58", category: "Encode", keywords: "base58 bitcoin encode decode", render: Base58Tool },
  { id: "aes", name: "AES Encrypt", icon: "🔒", category: "Encode", keywords: "aes encrypt decrypt aes-gcm password secure", render: AesTool },
  { id: "cipher", name: "Ciphers", icon: "🔤", category: "Encode", keywords: "cipher rot13 caesar atbash shift", render: CipherTool },
  { id: "mock", name: "Mock Data", icon: "⚄", category: "Generate", keywords: "mock fake test data users emails", render: MockTool },
  { id: "numwords", name: "Number → Words", icon: "N→", category: "Convert", keywords: "number words spell english", render: NumWordsTool },
  { id: "percent", name: "Percentage", icon: "%", category: "Convert", keywords: "percent percentage calculator change", render: PercentTool },
  { id: "wordfreq", name: "Word Frequency", icon: "Σw", category: "Text", keywords: "word frequency count text analysis common", render: WordFreqTool },
  { id: "cssunit", name: "px ⇄ rem", icon: "rem", category: "CSS", keywords: "css px rem em unit convert font size", render: CssUnitTool },
  { id: "aspect", name: "Aspect Ratio", icon: "▭", category: "CSS", keywords: "aspect ratio resolution 16:9 width height", render: AspectTool },
  { id: "httpstatus", name: "HTTP Status", icon: "#", category: "Web", keywords: "http status codes 404 500 reference rest", render: HttpStatusTool },
  { id: "jsonpath", name: "JSON Path", icon: "$.", category: "Data", keywords: "json path extract get value dot notation", render: JsonPathTool },
  { id: "luhn", name: "Card / Luhn", icon: "💳", category: "Encode", keywords: "luhn credit card validate checksum brand", render: LuhnTool },
  { id: "ulid", name: "ULID Inspector", icon: "⏱", category: "Convert", keywords: "ulid decode timestamp inspect id", render: UlidTool },
  { id: "duration", name: "Duration", icon: "⧗", category: "Convert", keywords: "duration humanize seconds time parse", render: DurationTool },
  { id: "timezone", name: "Time Zones", icon: "🌐", category: "Convert", keywords: "timezone time zone world clock convert utc", render: TimezoneTool },
  { id: "caseextra", name: "Case & Transform", icon: "aA", category: "Text", keywords: "case sentence alternating invert reverse text", render: CaseExtraTool },
  { id: "whitespace", name: "Whitespace", icon: "␣", category: "Text", keywords: "whitespace trim clean spaces tabs blank lines", render: WhitespaceTool },
  { id: "mdtable", name: "Markdown Table", icon: "▦", category: "Text", keywords: "markdown table generator csv tab convert", render: MdTableTool },
  { id: "readability", name: "Readability", icon: "📖", category: "Text", keywords: "readability flesch reading ease grade text score", render: ReadabilityTool },
  { id: "cidr", name: "Subnet / CIDR", icon: "🖧", category: "Web", keywords: "cidr subnet ip network mask hosts range calculator", render: CidrTool },
  { id: "curl", name: "cURL → fetch", icon: "↯", category: "Web", keywords: "curl fetch convert http request javascript", render: CurlTool },
  { id: "env", name: ".env ⇄ JSON", icon: "⚙", category: "Data", keywords: "env dotenv json config convert environment", render: EnvTool },
  { id: "ascii", name: "ASCII Table", icon: "A₇", category: "Web", keywords: "ascii table char codes reference decimal hex", render: AsciiTool },
  { id: "dice", name: "Random Number", icon: "🎲", category: "Generate", keywords: "random number dice roll range generator", render: DiceTool },
  { id: "jwtbuild", name: "JWT Builder", icon: "✍", category: "Encode", keywords: "jwt build sign hs256 hmac token create", render: JwtBuildTool },
  { id: "emoji", name: "Emoji Picker", icon: "☺", category: "Generate", keywords: "emoji picker search copy symbol", render: EmojiTool },
  { id: "speak", name: "Text to Speech", icon: "🔊", category: "Generate", keywords: "text speech tts read aloud voice", render: SpeakTool },
  { id: "blend", name: "Colour Blender", icon: "◑", category: "CSS", keywords: "color blend mix interpolate scale gradient", render: BlendTool },
  { id: "bytesize", name: "Byte Size", icon: "B", category: "Convert", keywords: "byte size format kb mb gb human readable", render: ByteSizeTool },
  { id: "listsort", name: "Number Sorter", icon: "↕", category: "Data", keywords: "sort numbers list unique dedupe order", render: ListSortTool },
  { id: "base32", name: "Base32", icon: "32", category: "Encode", keywords: "base32 rfc4648 encode decode totp", render: Base32Tool },
  { id: "hexdump", name: "Hex Dump", icon: "0x", category: "Data", keywords: "hex dump bytes offset ascii inspect", render: HexDumpTool },
  { id: "similarity", name: "String Similarity", icon: "≈", category: "Text", keywords: "levenshtein similarity distance compare fuzzy", render: SimilarityTool },
  { id: "pwstrength", name: "Password Strength", icon: "🛡", category: "Encode", keywords: "password strength entropy audit check secure", render: PwStrengthTool },
  { id: "ipint", name: "IPv4 ⇄ Int", icon: "🖧", category: "Web", keywords: "ipv4 integer convert ip address network", render: IpIntTool },
  { id: "hexb64", name: "Hex ⇄ Base64", icon: "⇄", category: "Encode", keywords: "hex base64 convert bytes", render: HexB64Tool },
  { id: "striphtml", name: "HTML → Text", icon: "⌦", category: "Data", keywords: "html strip tags plain text clean", render: StripHtmlTool },
  { id: "listjson", name: "List ⇄ JSON", icon: "≣", category: "Data", keywords: "list lines json array convert", render: ListJsonTool },
  { id: "datediff", name: "Date Diff", icon: "Δt", category: "Convert", keywords: "date difference duration between days time", render: DateDiffTool },
  { id: "findreplace", name: "Find & Replace", icon: "⇄", category: "Text", keywords: "find replace regex text substitute", render: FindReplaceTool },
  { id: "linetools", name: "Line Tools", icon: "≟", category: "Text", keywords: "line number prefix suffix affix text", render: LineToolsTool },
  { id: "repeat", name: "Repeat Text", icon: "××", category: "Generate", keywords: "repeat text multiply pad string", render: RepeatTool },
];

export const CATEGORIES = ["Data", "Encode", "Generate", "Convert", "Text", "CSS", "Web"];


/* ================================================================== *
 * CSV ⇄ JSON
 * ================================================================== */
function CsvJsonTool() {
  const [dir, setDir] = useState<"c2j" | "j2c">("c2j");
  const [input, setInput] = useState("name,role,active\nSaleh,Engineer,true\nSara,Designer,false");
  const res = useMemo(() => (dir === "c2j" ? F.csvToJson(input) : F.jsonToCsv(input)), [input, dir]);
  return (
    <ToolShell title="CSV ⇄ JSON" subtitle="Convert between CSV and a JSON array of objects — headers become keys, types are inferred.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "c2j", label: "CSV → JSON" }, { value: "j2c", label: "JSON → CSV" }]} /></div>
        <Field label={dir === "c2j" ? "CSV" : "JSON"}><TextArea value={input} onChange={setInput} rows={8} /></Field>
      </Panel>
      <Panel><ErrorNote message={res.error} /><Output value={res.output} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * JSON → TypeScript
 * ================================================================== */
function JsonTsTool() {
  const [input, setInput] = useState('{\n  "id": 7,\n  "name": "Saleh",\n  "tags": ["a", "b"],\n  "profile": { "city": "Tehran", "since": 2022 }\n}');
  const [root, setRoot] = useState("Root");
  const res = useMemo(() => F.jsonToTs(input, root || "Root"), [input, root]);
  return (
    <ToolShell title="JSON → TypeScript" subtitle="Generate TypeScript interfaces from a JSON object or array of objects.">
      <Panel>
        <div className="mb-3 max-w-xs"><Field label="Root interface name"><Input value={root} onChange={setRoot} /></Field></div>
        <Field label="JSON"><TextArea value={input} onChange={setInput} rows={9} /></Field>
      </Panel>
      <Panel><ErrorNote message={res.error} /><Output value={res.output} label="TypeScript" /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * chmod calculator
 * ================================================================== */
function ChmodTool() {
  const [perm, setPerm] = useState<F.ChmodPerm>({ owner: { r: true, w: true, x: true }, group: { r: true, w: false, x: true }, other: { r: true, w: false, x: false } });
  const octal = F.permToOctal(perm);
  const symbolic = F.permToSymbolic(perm);
  const roles: [keyof F.ChmodPerm, string][] = [["owner", "Owner"], ["group", "Group"], ["other", "Other"]];
  const bitKeys: [keyof F.ChmodBits, string][] = [["r", "Read"], ["w", "Write"], ["x", "Execute"]];
  return (
    <ToolShell title="chmod Calculator" subtitle="Toggle Unix permission bits and read the octal + symbolic form (and the command).">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-3">
          {roles.map(([role, label]) => (
            <div key={role} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
              <p className="label mb-2">{label}</p>
              <div className="grid gap-1.5">
                {bitKeys.map(([bit, blabel]) => (
                  <Toggle key={bit} label={blabel} checked={perm[role][bit]} onChange={(v) => setPerm((p) => ({ ...p, [role]: { ...p[role], [bit]: v } }))} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <div className="grid grid-cols-2 gap-3">
          <Stat value={octal} label="Octal" />
          <Stat value={symbolic} label="Symbolic" />
        </div>
        <div className="mt-3"><Output value={`chmod ${octal} file`} label="Command" /></div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Unicode inspector
 * ================================================================== */
function UnicodeTool() {
  const [input, setInput] = useState("Saleh ✦ صالح 🚀");
  const chars = useMemo(() => F.inspectChars(input), [input]);
  return (
    <ToolShell title="Unicode Inspector" subtitle="Break a string into code points — decimal, hex and HTML entity for each character.">
      <Panel><Field label="Text"><TextArea value={input} onChange={setInput} rows={3} mono={false} /></Field></Panel>
      <Panel>
        <span className="label">{chars.length} characters</span>
        <div className="thin-scroll mt-2 max-h-[360px] overflow-auto rounded-xl border" style={{ borderColor: "var(--line)" }}>
          {chars.map((c, i) => (
            <div key={i} className="grid grid-cols-[40px_1fr_1fr_1fr] items-center gap-2 border-b px-3 py-1.5 text-sm last:border-0" style={{ borderColor: "var(--line)" }}>
              <span className="grid h-7 w-7 place-items-center rounded-lg text-base" style={{ background: "var(--bg-3)" }}>{c.name ? "·" : c.char}</span>
              <span className="mono accent-text">{c.hex}</span>
              <span className="mono text-[var(--fg-2)]">{c.code}</span>
              <span className="mono text-[var(--fg-2)]">{c.name || c.html}</span>
            </div>
          ))}
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * String escape / unescape
 * ================================================================== */
function EscapeTool() {
  const [input, setInput] = useState('Line one\n"Quoted"\tTabbed');
  const [dir, setDir] = useState<"esc" | "unesc">("esc");
  const res = dir === "esc" ? { ok: true, output: F.escapeString(input) } : F.unescapeString(input);
  return (
    <ToolShell title="String Escape" subtitle="Escape or unescape a string for embedding in JSON / JavaScript source.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "esc", label: "Escape" }, { value: "unesc", label: "Unescape" }]} /></div>
        <Field label="Input"><TextArea value={input} onChange={setInput} rows={5} /></Field>
      </Panel>
      <Panel><ErrorNote message={(res as F.JsonResult).error} /><Output value={res.output} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Morse code
 * ================================================================== */
function MorseTool() {
  const [input, setInput] = useState("Saleh im");
  const [dir, setDir] = useState<"enc" | "dec">("enc");
  const out = dir === "enc" ? F.textToMorse(input) : F.morseToText(input);
  return (
    <ToolShell title="Morse Code" subtitle="Translate text to Morse and back (· dot, − dash, / word gap).">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "enc", label: "Text → Morse" }, { value: "dec", label: "Morse → Text" }]} /></div>
        <Field label={dir === "enc" ? "Text" : "Morse"}><TextArea value={input} onChange={setInput} rows={4} mono={dir === "dec"} /></Field>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Binary ⇄ text
 * ================================================================== */
function BinaryTool() {
  const [input, setInput] = useState("Saleh");
  const [dir, setDir] = useState<"enc" | "dec">("enc");
  const res = dir === "enc" ? { ok: true, output: F.textToBinary(input) } : F.binaryToText(input);
  return (
    <ToolShell title="Binary ⇄ Text" subtitle="Convert UTF-8 text to space-separated binary bytes and back.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "enc", label: "Text → Binary" }, { value: "dec", label: "Binary → Text" }]} /></div>
        <Field label={dir === "enc" ? "Text" : "Binary"}><TextArea value={input} onChange={setInput} rows={4} /></Field>
      </Panel>
      <Panel><ErrorNote message={(res as F.JsonResult).error} /><Output value={res.output} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Roman numerals
 * ================================================================== */
function RomanTool() {
  const [input, setInput] = useState("2026");
  const [dir, setDir] = useState<"toR" | "fromR">("toR");
  const out = dir === "toR" ? F.toRoman(parseInt(input, 10)) : String(F.fromRoman(input) || "");
  return (
    <ToolShell title="Roman Numerals" subtitle="Convert between Arabic numbers (1–3999) and Roman numerals.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "toR", label: "Number → Roman" }, { value: "fromR", label: "Roman → Number" }]} /></div>
        <Field label={dir === "toR" ? "Number" : "Roman"}><Input value={input} onChange={setInput} /></Field>
      </Panel>
      <Panel>
        <div className="grid place-items-center py-4">
          <span className="font-display text-4xl accent-text">{out || "—"}</span>
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Units converter
 * ================================================================== */
const TEMP_UNITS = [{ id: "c", label: "Celsius" }, { id: "f", label: "Fahrenheit" }, { id: "k", label: "Kelvin" }];
function UnitsTool() {
  const [cat, setCat] = useState("length");
  const [value, setValue] = useState("1");
  const [from, setFrom] = useState("m");
  const [to, setTo] = useState("ft");
  const units = cat === "temperature" ? TEMP_UNITS : F.UNIT_CATEGORIES.find((c) => c.id === cat)?.units || [];
  const changeCat = (c: string) => {
    setCat(c);
    const u = c === "temperature" ? TEMP_UNITS : F.UNIT_CATEGORIES.find((x) => x.id === c)?.units || [];
    setFrom(u[0]?.id || "");
    setTo(u[1]?.id || u[0]?.id || "");
  };
  const result = F.convertUnit(cat, parseFloat(value) || 0, from, to);
  const cats = [...F.UNIT_CATEGORIES.map((c) => ({ id: c.id, label: c.label })), { id: "temperature", label: "Temperature" }];
  const sel = "w-full rounded-xl border bg-[var(--bg-3)] px-3 py-2.5 text-sm outline-none";
  return (
    <ToolShell title="Unit Converter" subtitle="Convert length, mass, data size, time and temperature.">
      <Panel>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {cats.map((c) => (
            <button key={c.id} onClick={() => changeCat(c.id)} className="chip" style={cat === c.id ? { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" } : {}}>{c.label}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <Field label="Value"><Input value={value} onChange={setValue} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={sel} style={{ borderColor: "var(--line-2)" }}>{units.map((u) => <option key={u.id} value={u.id} style={{ background: "var(--bg-2)" }}>{u.label}</option>)}</select>
            <select value={to} onChange={(e) => setTo(e.target.value)} className={sel} style={{ borderColor: "var(--line-2)" }}>{units.map((u) => <option key={u.id} value={u.id} style={{ background: "var(--bg-2)" }}>{u.label}</option>)}</select>
          </div>
        </div>
      </Panel>
      <Panel>
        <div className="grid place-items-center py-3">
          <span className="font-display text-3xl force-ltr">{result == null ? "—" : Number(result.toPrecision(8)).toLocaleString(undefined, { maximumFractionDigits: 8 })}</span>
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Password generator
 * ================================================================== */
function PasswordTool() {
  const [opts, setOpts] = useState<F.PwOptions>({ length: 20, upper: true, lower: true, digits: true, symbols: true, avoidAmbiguous: false });
  const [pw, setPw] = useState("");
  const gen = () => setPw(F.generatePassword(opts));
  useEffect(gen, [opts]); // eslint-disable-line react-hooks/exhaustive-deps
  const bits = F.estimateEntropyBits(pw);
  const strength = bits >= 100 ? { l: "Very strong", c: "#22c55e" } : bits >= 70 ? { l: "Strong", c: "#84cc16" } : bits >= 45 ? { l: "Fair", c: "#eab308" } : { l: "Weak", c: "#ef4444" };
  return (
    <ToolShell title="Password Generator" subtitle="Cryptographically-random passwords (Web Crypto) with a live strength estimate.">
      <Panel>
        <div className="flex items-center gap-2">
          <div className="force-ltr flex-1 rounded-xl border bg-[var(--bg-3)] p-3 text-center mono text-lg break-all" style={{ borderColor: "var(--line-2)" }}>{pw || "—"}</div>
          <Btn onClick={gen}>↻</Btn>
          <CopyBtn text={pw} />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs"><span className="label">Strength</span><span className="mono" style={{ color: strength.c }}>{strength.l} · ~{bits} bits</span></div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}><div style={{ width: `${Math.min(100, bits)}%`, background: strength.c, transition: "width .3s ease" }} className="h-full" /></div>
        </div>
      </Panel>
      <Panel>
        <Field label={`Length: ${opts.length}`}>
          <input type="range" min={6} max={64} value={opts.length} onChange={(e) => setOpts((o) => ({ ...o, length: Number(e.target.value) }))} className="w-full accent-[var(--accent)]" />
        </Field>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Toggle label="Uppercase A-Z" checked={opts.upper} onChange={(v) => setOpts((o) => ({ ...o, upper: v }))} />
          <Toggle label="Lowercase a-z" checked={opts.lower} onChange={(v) => setOpts((o) => ({ ...o, lower: v }))} />
          <Toggle label="Digits 0-9" checked={opts.digits} onChange={(v) => setOpts((o) => ({ ...o, digits: v }))} />
          <Toggle label="Symbols !@#" checked={opts.symbols} onChange={(v) => setOpts((o) => ({ ...o, symbols: v }))} />
          <Toggle label="Avoid ambiguous" checked={opts.avoidAmbiguous} onChange={(v) => setOpts((o) => ({ ...o, avoidAmbiguous: v }))} />
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * CSS Gradient generator
 * ================================================================== */
function GradientTool() {
  const [c1, setC1] = useState("#b9ff3a");
  const [c2, setC2] = useState("#22d3ee");
  const [angle, setAngle] = useState(120);
  const [type, setType] = useState<"linear" | "radial">("linear");
  const css = type === "linear" ? `linear-gradient(${angle}deg, ${c1}, ${c2})` : `radial-gradient(circle, ${c1}, ${c2})`;
  return (
    <ToolShell title="CSS Gradient" subtitle="Design a gradient visually and copy the CSS.">
      <Panel>
        <div className="h-40 rounded-2xl" style={{ background: css, boxShadow: "inset 0 1px 0 rgba(255,255,255,.1)" }} />
      </Panel>
      <Panel>
        <div className="mb-3"><Segmented value={type} onChange={setType} options={[{ value: "linear", label: "Linear" }, { value: "radial", label: "Radial" }]} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Colour 1"><div className="flex gap-2"><input type="color" value={c1} onChange={(e) => setC1(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border" style={{ borderColor: "var(--line-2)" }} /><Input value={c1} onChange={setC1} /></div></Field>
          <Field label="Colour 2"><div className="flex gap-2"><input type="color" value={c2} onChange={(e) => setC2(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border" style={{ borderColor: "var(--line-2)" }} /><Input value={c2} onChange={setC2} /></div></Field>
        </div>
        {type === "linear" && (
          <div className="mt-3"><Field label={`Angle: ${angle}°`}><input type="range" min={0} max={360} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></Field></div>
        )}
      </Panel>
      <Panel><Output value={`background: ${css};`} label="CSS" /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Box-shadow generator
 * ================================================================== */
function ShadowTool() {
  const [x, setX] = useState(0);
  const [y, setY] = useState(18);
  const [blur, setBlur] = useState(40);
  const [spread, setSpread] = useState(-12);
  const [color, setColor] = useState("#000000");
  const [opacity, setOpacity] = useState(35);
  const rgba = `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${(opacity / 100).toFixed(2)})`;
  const css = `${x}px ${y}px ${blur}px ${spread}px ${rgba}`;
  const sliders: [string, number, (n: number) => void, number, number][] = [
    ["Offset X", x, setX, -50, 50], ["Offset Y", y, setY, -50, 50], ["Blur", blur, setBlur, 0, 100], ["Spread", spread, setSpread, -50, 50], ["Opacity", opacity, setOpacity, 0, 100],
  ];
  return (
    <ToolShell title="Box-Shadow" subtitle="Dial in a box-shadow with a live preview and copy the CSS.">
      <Panel>
        <div className="grid h-48 place-items-center rounded-2xl" style={{ background: "var(--bg-3)" }}>
          <div className="h-24 w-40 rounded-2xl" style={{ background: "var(--bg-2)", boxShadow: css, border: "1px solid var(--line)" }} />
        </div>
      </Panel>
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          {sliders.map(([label, val, set, min, max]) => (
            <Field key={label} label={`${label}: ${val}`}><input type="range" min={min} max={max} value={val} onChange={(e) => set(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></Field>
          ))}
          <Field label="Colour"><div className="flex gap-2"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border" style={{ borderColor: "var(--line-2)" }} /><Input value={color} onChange={setColor} /></div></Field>
        </div>
      </Panel>
      <Panel><Output value={`box-shadow: ${css};`} label="CSS" /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Cubic-bezier easing visualizer
 * ================================================================== */
function BezierTool() {
  const [p, setP] = useState([0.16, 1, 0.3, 1]);
  const set = (i: number, v: number) => setP((prev) => prev.map((x, j) => (j === i ? v : x)));
  const path = `M0,100 C${(p[0] * 100).toFixed(1)},${(100 - p[1] * 100).toFixed(1)} ${(p[2] * 100).toFixed(1)},${(100 - p[3] * 100).toFixed(1)} 100,0`;
  const css = `cubic-bezier(${p.map((x) => Number(x.toFixed(2))).join(", ")})`;
  const presets: [string, number[]][] = [["ease", [0.25, 0.1, 0.25, 1]], ["ease-in-out", [0.42, 0, 0.58, 1]], ["snappy", [0.16, 1, 0.3, 1]], ["back", [0.68, -0.55, 0.27, 1.55]]];
  return (
    <ToolShell title="Cubic Bezier" subtitle="Craft a CSS easing curve and preview its motion.">
      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          <svg viewBox="-6 -6 112 112" className="h-44 w-44 shrink-0 rounded-xl" style={{ background: "var(--bg-3)" }}>
            <line x1="0" y1="100" x2="100" y2="0" stroke="var(--line-2)" strokeWidth="0.6" strokeDasharray="3 3" />
            <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            <circle cx={p[0] * 100} cy={100 - p[1] * 100} r="3.5" fill="var(--accent-2)" />
            <circle cx={p[2] * 100} cy={100 - p[3] * 100} r="3.5" fill="var(--accent-2)" />
          </svg>
          <div className="flex-1">
            <div className="mb-3 h-10 w-full rounded-full" style={{ background: "var(--bg-3)", position: "relative", overflow: "hidden" }}>
              <span key={css} className="absolute top-1 h-8 w-8 rounded-full" style={{ background: "var(--accent)", animation: `bezMove 1.6s ${css} infinite alternate` }} />
            </div>
            <div className="flex flex-wrap gap-1.5">{presets.map(([l, v]) => <button key={l} onClick={() => setP(v)} className="chip">{l}</button>)}</div>
          </div>
        </div>
      </Panel>
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          {["x1", "y1", "x2", "y2"].map((l, i) => (
            <Field key={l} label={`${l}: ${p[i].toFixed(2)}`}><input type="range" min={l.startsWith("x") ? 0 : -0.9} max={l.startsWith("x") ? 1 : 1.9} step={0.01} value={p[i]} onChange={(e) => set(i, Number(e.target.value))} className="w-full accent-[var(--accent)]" /></Field>
          ))}
        </div>
      </Panel>
      <Panel><Output value={`transition-timing-function: ${css};`} label="CSS" /></Panel>
      <style jsx global>{`@keyframes bezMove { from { left: 2px } to { left: calc(100% - 34px) } }`}</style>
    </ToolShell>
  );
}


/* ================================================================== *
 * CRC32
 * ================================================================== */
function CrcTool() {
  const [input, setInput] = useState("The quick brown fox");
  const crc = useMemo(() => F.crc32(input), [input]);
  return (
    <ToolShell title="CRC32 Checksum" subtitle="A fast 32-bit cyclic-redundancy checksum for integrity checks.">
      <Panel><Field label="Input"><TextArea value={input} onChange={setInput} rows={4} mono={false} /></Field></Panel>
      <Panel><Output value={crc} label="CRC32 (hex)" /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Base58
 * ================================================================== */
function Base58Tool() {
  const [input, setInput] = useState("Saleh");
  const [dir, setDir] = useState<"enc" | "dec">("enc");
  const res = dir === "enc" ? { ok: true, output: F.base58Encode(input) } : F.base58Decode(input);
  return (
    <ToolShell title="Base58" subtitle="Bitcoin-style Base58 encoding — no ambiguous 0/O/I/l characters.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "enc", label: "Encode" }, { value: "dec", label: "Decode" }]} /></div>
        <Field label={dir === "enc" ? "Text" : "Base58"}><TextArea value={input} onChange={setInput} rows={4} /></Field>
      </Panel>
      <Panel><ErrorNote message={(res as F.JsonResult).error} /><Output value={res.output} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Classic ciphers
 * ================================================================== */
function CipherTool() {
  const [input, setInput] = useState("Attack at dawn");
  const [mode, setMode] = useState<"rot13" | "caesar" | "atbash">("rot13");
  const [shift, setShift] = useState(3);
  const out = mode === "rot13" ? F.rot13(input) : mode === "atbash" ? F.atbash(input) : F.caesar(input, shift);
  return (
    <ToolShell title="Classic Ciphers" subtitle="ROT13, Caesar shift and Atbash — reversible letter substitutions.">
      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Segmented value={mode} onChange={setMode} options={[{ value: "rot13", label: "ROT13" }, { value: "caesar", label: "Caesar" }, { value: "atbash", label: "Atbash" }]} />
          {mode === "caesar" && (<label className="flex items-center gap-2 text-sm"><span className="label">Shift</span><input type="number" min={-25} max={25} value={shift} onChange={(e) => setShift(Number(e.target.value))} className="w-16 rounded-xl border bg-[var(--bg-3)] px-2 py-1.5 text-sm mono" style={{ borderColor: "var(--line-2)" }} /></label>)}
        </div>
        <Field label="Text"><TextArea value={input} onChange={setInput} rows={4} mono={false} /></Field>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Number to words
 * ================================================================== */
function NumWordsTool() {
  const [input, setInput] = useState("2026");
  const words = F.numberToWords(parseFloat(input));
  return (
    <ToolShell title="Number to Words" subtitle="Spell out a number in English.">
      <Panel><Field label="Number"><Input value={input} onChange={setInput} /></Field></Panel>
      <Panel><p className="py-3 text-center font-display text-xl capitalize">{words || "—"}</p></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * HTTP status reference
 * ================================================================== */
function HttpStatusTool() {
  const [q, setQ] = useState("");
  const list = F.HTTP_STATUS.filter((s) => (s.code + " " + s.name + " " + s.desc).toLowerCase().includes(q.toLowerCase()));
  const cls = (c: number) => (c < 300 ? "#22c55e" : c < 400 ? "#38bdf8" : c < 500 ? "#eab308" : "#ef4444");
  return (
    <ToolShell title="HTTP Status Codes" subtitle="A searchable reference of common HTTP response codes.">
      <Panel><Field label="Search"><Input value={q} onChange={setQ} mono={false} placeholder="404, not found…" /></Field></Panel>
      <Panel>
        <div className="grid gap-2">
          {list.map((s) => (
            <div key={s.code} className="flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
              <span className="mono grid h-9 w-12 shrink-0 place-items-center rounded-lg text-sm font-bold" style={{ background: `color-mix(in srgb, ${cls(s.code)} 16%, transparent)`, color: cls(s.code) }}>{s.code}</span>
              <div><b className="text-sm">{s.name}</b><p className="text-xs text-[var(--fg-2)]">{s.desc}</p></div>
            </div>
          ))}
          {list.length === 0 && <p className="py-4 text-center text-sm text-[var(--fg-2)]">No match.</p>}
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * CSS px ⇄ rem
 * ================================================================== */
function CssUnitTool() {
  const [px, setPx] = useState("24");
  const [base, setBase] = useState("16");
  const b = parseFloat(base) || 16;
  const pxN = parseFloat(px) || 0;
  return (
    <ToolShell title="px ⇄ rem" subtitle="Convert pixel values to rem / em given a root font-size.">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pixels"><Input value={px} onChange={setPx} /></Field>
          <Field label="Root font-size (px)"><Input value={base} onChange={setBase} /></Field>
        </div>
      </Panel>
      <Panel>
        <div className="grid grid-cols-2 gap-3">
          <Stat value={`${F.pxToRem(pxN, b)}rem`} label="rem / em" />
          <Stat value={`${pxN}px`} label="pixels" />
        </div>
        <div className="mt-3 grid gap-1.5 text-sm">
          {[8, 12, 16, 20, 24, 32].map((v) => (<div key={v} className="flex justify-between border-b pb-1.5 last:border-0" style={{ borderColor: "var(--line)" }}><span className="mono text-[var(--fg-2)]">{v}px</span><span className="mono">{F.pxToRem(v, b)}rem</span></div>))}
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Aspect ratio
 * ================================================================== */
function AspectTool() {
  const [w, setW] = useState("1920");
  const [h, setH] = useState("1080");
  const ar = F.aspectRatio(parseFloat(w), parseFloat(h));
  return (
    <ToolShell title="Aspect Ratio" subtitle="Reduce a width × height to its simplest ratio.">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Width"><Input value={w} onChange={setW} /></Field>
          <Field label="Height"><Input value={h} onChange={setH} /></Field>
        </div>
      </Panel>
      {ar && (
        <Panel>
          <div className="grid grid-cols-2 gap-3">
            <Stat value={ar.ratio} label="Ratio" />
            <Stat value={ar.decimal} label="Decimal" />
          </div>
          <div className="mt-3 grid place-items-center">
            <div className="rounded-xl border" style={{ borderColor: "var(--accent)", width: Math.min(280, 160 * ar.decimal), height: Math.min(280 / ar.decimal, 160), background: "color-mix(in srgb, var(--accent) 10%, transparent)" }} />
          </div>
        </Panel>
      )}
    </ToolShell>
  );
}

/* ================================================================== *
 * Percentage calculator
 * ================================================================== */
function PercentTool() {
  const [a, setA] = useState("15");
  const [b, setB] = useState("200");
  const an = parseFloat(a) || 0, bn = parseFloat(b) || 0;
  return (
    <ToolShell title="Percentage" subtitle="Everyday percentage calculations.">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="X"><Input value={a} onChange={setA} /></Field>
          <Field label="Y"><Input value={b} onChange={setB} /></Field>
        </div>
      </Panel>
      <Panel>
        <div className="grid gap-2 text-sm">
          {[
            [`${an}% of ${bn}`, ((an / 100) * bn).toLocaleString()],
            [`${an} is what % of ${bn}`, bn ? ((an / bn) * 100).toFixed(2) + "%" : "—"],
            [`% change ${an} → ${bn}`, an ? (((bn - an) / an) * 100).toFixed(2) + "%" : "—"],
            [`${an} + ${an}% `, (an * 1 + (an * an) / 100).toLocaleString()],
          ].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between border-b pb-2 last:border-0" style={{ borderColor: "var(--line)" }}><span className="text-[var(--fg-2)]">{l}</span><span className="mono accent-text">{v}</span></div>
          ))}
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * JSON ⇄ query string
 * ================================================================== */
function JsonQueryTool() {
  const [dir, setDir] = useState<"j2q" | "q2j">("j2q");
  const [input, setInput] = useState('{\n  "page": 2,\n  "sort": "name",\n  "q": "hello world"\n}');
  const res = dir === "j2q" ? F.jsonToQuery(input) : { ok: true, output: F.queryToJson(input) };
  return (
    <ToolShell title="JSON ⇄ Query" subtitle="Convert a JSON object to a URL query string and back.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "j2q", label: "JSON → Query" }, { value: "q2j", label: "Query → JSON" }]} /></div>
        <Field label={dir === "j2q" ? "JSON" : "Query string"}><TextArea value={input} onChange={setInput} rows={6} /></Field>
      </Panel>
      <Panel><ErrorNote message={(res as F.JsonResult).error} /><Output value={res.output} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Word frequency
 * ================================================================== */
function WordFreqTool() {
  const [input, setInput] = useState("the quick brown fox the lazy dog the fox");
  const freq = useMemo(() => F.wordFrequency(input), [input]);
  const max = freq[0]?.count || 1;
  return (
    <ToolShell title="Word Frequency" subtitle="Count and rank the most common words in a text.">
      <Panel><Field label="Text"><TextArea value={input} onChange={setInput} rows={6} mono={false} /></Field></Panel>
      <Panel>
        <div className="space-y-1.5">
          {freq.map((f) => (
            <div key={f.word} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 truncate force-ltr">{f.word}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--bg-3)" }}><div className="h-full rounded-full" style={{ width: `${(f.count / max) * 100}%`, background: "linear-gradient(90deg, var(--accent), var(--accent-2))" }} /></div>
              <span className="mono w-8 shrink-0 text-end">{f.count}</span>
            </div>
          ))}
          {freq.length === 0 && <p className="py-4 text-center text-sm text-[var(--fg-2)]">No words.</p>}
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Mock data
 * ================================================================== */
function MockTool() {
  const [kind, setKind] = useState<"user" | "email" | "uuid">("user");
  const [count, setCount] = useState(10);
  const [out, setOut] = useState("");
  const gen = () => setOut(F.mockRows(kind, F.clamp(count, 1, 500)));
  useEffect(gen, [kind, count]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ToolShell title="Mock Data" subtitle="Generate placeholder users, emails or UUIDs for testing.">
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={kind} onChange={setKind} options={[{ value: "user", label: "Users" }, { value: "email", label: "Emails" }, { value: "uuid", label: "UUIDs" }]} />
          <div className="flex items-center gap-2"><span className="label">Rows</span><input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-20 rounded-xl border bg-[var(--bg-3)] px-2 py-1.5 text-sm mono" style={{ borderColor: "var(--line-2)" }} /></div>
          <Btn accent onClick={gen}>↻ Generate</Btn>
        </div>
      </Panel>
      <Panel><Output value={out} label={`${out.split("\n").filter(Boolean).length} rows`} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * AES text encryption
 * ================================================================== */
function AesTool() {
  const [dir, setDir] = useState<"enc" | "dec">("enc");
  const [input, setInput] = useState("A secret message");
  const [pass, setPass] = useState("");
  const [out, setOut] = useState("");
  const [err, setErr] = useState("");
  const run = async () => {
    setErr("");
    if (!pass) { setErr("Enter a passphrase."); return; }
    if (dir === "enc") setOut(await F.aesEncrypt(input, pass));
    else { const r = await F.aesDecrypt(input, pass); if (r.ok) setOut(r.output); else { setOut(""); setErr(r.error || ""); } }
  };
  return (
    <ToolShell title="AES Encryption" subtitle="AES-256-GCM with a PBKDF2-derived key — encrypt/decrypt text right in your browser.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={(d) => { setDir(d); setOut(""); setErr(""); }} options={[{ value: "enc", label: "Encrypt" }, { value: "dec", label: "Decrypt" }]} /></div>
        <Field label={dir === "enc" ? "Plaintext" : "Ciphertext (base64)"}><TextArea value={input} onChange={setInput} rows={4} /></Field>
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1"><Field label="Passphrase"><Input value={pass} onChange={setPass} type="password" mono={false} /></Field></div>
          <Btn accent onClick={run}>{dir === "enc" ? "🔒 Encrypt" : "🔓 Decrypt"}</Btn>
        </div>
      </Panel>
      <Panel><ErrorNote message={err} /><Output value={out} /></Panel>
    </ToolShell>
  );
}


/* ================================================================== *
 * Luhn / card validator
 * ================================================================== */
function LuhnTool() {
  const [input, setInput] = useState("4242 4242 4242 4242");
  const valid = F.luhnValid(input);
  const brand = F.cardBrand(input);
  const digits = input.replace(/\D/g, "");
  return (
    <ToolShell title="Card / Luhn Check" subtitle="Validate a credit-card (or any Luhn) number and detect the brand.">
      <Panel><Field label="Number"><Input value={input} onChange={setInput} /></Field></Panel>
      <Panel>
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl text-2xl" style={{ background: digits.length >= 2 && valid ? "color-mix(in srgb,#22c55e 18%,transparent)" : "color-mix(in srgb,#ef4444 18%,transparent)", color: valid ? "#22c55e" : "#ef4444" }}>{valid ? "✓" : "✕"}</span>
          <div>
            <p className="font-display text-lg">{digits.length < 2 ? "—" : valid ? "Valid" : "Invalid checksum"}</p>
            <p className="text-sm text-[var(--fg-2)]">{brand} · {digits.length} digits</p>
          </div>
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * ULID inspector
 * ================================================================== */
function UlidTool() {
  const [input, setInput] = useState(F.ulid());
  const ts = F.ulidTimestamp(input);
  return (
    <ToolShell title="ULID Inspector" subtitle="Decode the millisecond timestamp embedded in a ULID.">
      <Panel>
        <div className="flex items-end gap-2">
          <div className="flex-1"><Field label="ULID"><Input value={input} onChange={setInput} /></Field></div>
          <Btn onClick={() => setInput(F.ulid())}>↻ New</Btn>
        </div>
      </Panel>
      <Panel>
        {ts ? (
          <div className="grid gap-2 text-sm">
            {[["Timestamp (ms)", String(ts.getTime())], ["ISO", ts.toISOString()], ["Local", ts.toString()], ["Relative", F.relativeTime(ts.getTime())]].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0" style={{ borderColor: "var(--line)" }}><span className="text-[var(--fg-2)]">{k}</span><span className="mono text-right break-all">{v}</span></div>
            ))}
          </div>
        ) : <p className="py-4 text-center text-sm text-[var(--fg-2)]">Not a valid ULID.</p>}
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Duration humaniser
 * ================================================================== */
function DurationTool() {
  const [dir, setDir] = useState<"h" | "p">("h");
  const [input, setInput] = useState("90061");
  const out = dir === "h" ? F.humanizeDuration(parseFloat(input) || 0) : String(F.parseDuration(input));
  return (
    <ToolShell title="Duration" subtitle="Humanise seconds into “1d 1h 1m 1s” — or parse it back to seconds.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "h", label: "Seconds → human" }, { value: "p", label: "Human → seconds" }]} /></div>
        <Field label={dir === "h" ? "Seconds" : "e.g. 1d 2h 30m"}><Input value={input} onChange={setInput} mono={dir === "p"} /></Field>
      </Panel>
      <Panel><p className="py-3 text-center font-display text-2xl accent-text force-ltr">{out || "—"}</p></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * JSON path
 * ================================================================== */
function JsonPathTool() {
  const [json, setJson] = useState('{\n  "user": { "name": "Saleh", "roles": ["admin", "dev"] },\n  "count": 3\n}');
  const [path, setPath] = useState("user.roles[0]");
  const res = useMemo(() => F.jsonGet(json, path), [json, path]);
  return (
    <ToolShell title="JSON Path" subtitle="Extract a value from JSON with dot / bracket notation.">
      <Panel>
        <Field label="JSON"><TextArea value={json} onChange={setJson} rows={7} /></Field>
        <div className="mt-3"><Field label="Path" hint="e.g. user.roles[0]"><Input value={path} onChange={setPath} /></Field></div>
      </Panel>
      <Panel><ErrorNote message={res.error} /><Output value={res.output} label="Value" /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Extra case transforms
 * ================================================================== */
function CaseExtraTool() {
  const [text, setText] = useState("The Quick Brown Fox");
  const t: [string, (s: string) => string][] = [
    ["Sentence case", F.toSentenceCase],
    ["aLtErNaTiNg", F.toAlternatingCase],
    ["iNVERT cASE", F.invertCase],
    ["UPPER", (s) => s.toUpperCase()],
    ["lower", (s) => s.toLowerCase()],
    ["Reverse", (s) => [...s].reverse().join("")],
  ];
  return (
    <ToolShell title="Case & Transform" subtitle="Sentence, alternating, inverted case — and text reversal.">
      <Panel><Field label="Text"><TextArea value={text} onChange={setText} rows={4} mono={false} /></Field>
        <div className="mt-3 flex flex-wrap gap-1.5">{t.map(([l, fn]) => <button key={l} onClick={() => setText(fn(text))} className="chip mono transition-transform hover:-translate-y-0.5">{l}</button>)}</div>
      </Panel>
      <Panel><Output value={text} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Whitespace cleaner
 * ================================================================== */
function WhitespaceTool() {
  const [text, setText] = useState("  hello   world  \n\n\n\ttrailing   \n");
  const [o, setO] = useState<F.WsOptions>({ trimLines: true, collapseSpaces: true, removeBlank: false, tabsToSpaces: true });
  const out = F.cleanWhitespace(text, o);
  const toggles: [keyof F.WsOptions, string][] = [["trimLines", "Trim line ends"], ["collapseSpaces", "Collapse spaces"], ["removeBlank", "Remove blank lines"], ["tabsToSpaces", "Tabs → spaces"]];
  return (
    <ToolShell title="Whitespace Cleaner" subtitle="Tidy up messy whitespace, tabs and blank lines.">
      <Panel>
        <Field label="Text"><TextArea value={text} onChange={setText} rows={6} /></Field>
        <div className="mt-3 grid grid-cols-2 gap-2">{toggles.map(([k, l]) => <Toggle key={k} label={l} checked={o[k]} onChange={(v) => setO((s) => ({ ...s, [k]: v }))} />)}</div>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Markdown table builder
 * ================================================================== */
function MdTableTool() {
  const [input, setInput] = useState("Name\tRole\tYear\nSaleh\tEngineer\t2022\nForge\tToolbox\t2026");
  const out = F.markdownTable(input);
  return (
    <ToolShell title="Markdown Table" subtitle="Turn tab- or comma-separated rows into a clean Markdown table.">
      <Panel><Field label="Rows (tab or comma separated)"><TextArea value={input} onChange={setInput} rows={6} /></Field></Panel>
      <Panel><Output value={out} label="Markdown" /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Time-zone converter
 * ================================================================== */
function TimezoneTool() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const d = new Date(now);
  return (
    <ToolShell title="Time Zones" subtitle="The current time across major time zones, updating live.">
      <Panel>
        <div className="grid gap-1.5">
          {F.TIMEZONES.map((tz) => (
            <div key={tz} className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-0" style={{ borderColor: "var(--line)" }}>
              <span className="text-[var(--fg-2)]">{tz.replace("_", " ")}</span>
              <span className="mono force-ltr">{F.formatInZone(d, tz)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </ToolShell>
  );
}


/* ================================================================== *
 * CIDR / subnet calculator
 * ================================================================== */
function CidrTool() {
  const [input, setInput] = useState("192.168.1.0/24");
  const info = useMemo(() => F.cidrInfo(input), [input]);
  return (
    <ToolShell title="Subnet / CIDR" subtitle="Compute the network range, mask, host count and boundaries of a CIDR block.">
      <Panel><Field label="CIDR" hint="e.g. 10.0.0.0/16"><Input value={input} onChange={setInput} /></Field></Panel>
      {info ? (
        <Panel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[["Network", info.network], ["Broadcast", info.broadcast], ["Netmask", info.mask], ["Wildcard", info.wildcard], ["First host", info.firstHost], ["Last host", info.lastHost]].map(([l, v]) => (
              <div key={l} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}><p className="label mb-1">{l}</p><p className="mono text-sm force-ltr">{v}</p></div>
            ))}
          </div>
          <div className="mt-3"><Stat value={info.hosts.toLocaleString()} label={`usable hosts · /${info.prefix}`} /></div>
        </Panel>
      ) : <Panel><ErrorNote message="Enter a valid CIDR like 192.168.1.0/24" /></Panel>}
    </ToolShell>
  );
}

/* ================================================================== *
 * Readability
 * ================================================================== */
function ReadabilityTool() {
  const [text, setText] = useState("This is a simple sentence. It should be easy to read for most people.");
  const r = useMemo(() => F.readability(text), [text]);
  const col = r.score >= 60 ? "#22c55e" : r.score >= 30 ? "#eab308" : "#ef4444";
  return (
    <ToolShell title="Readability" subtitle="Flesch reading-ease score with word / sentence / syllable counts.">
      <Panel><Field label="Text"><TextArea value={text} onChange={setText} rows={6} mono={false} /></Field></Panel>
      <Panel>
        <div className="mb-3 flex items-center gap-4">
          <span className="font-display text-4xl" style={{ color: col }}>{r.score}</span>
          <span className="rounded-full px-3 py-1 text-sm font-medium" style={{ background: `color-mix(in srgb, ${col} 16%, transparent)`, color: col }}>{r.grade}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat value={r.words} label="Words" />
          <Stat value={r.sentences} label="Sentences" />
          <Stat value={r.syllables} label="Syllables" />
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * .env ⇄ JSON
 * ================================================================== */
function EnvTool() {
  const [dir, setDir] = useState<"e2j" | "j2e">("e2j");
  const [input, setInput] = useState('API_URL=https://api.example.com\nDEBUG=true\nMAX_RETRIES=3');
  const res = dir === "e2j" ? { ok: true, output: F.envToJson(input) } : F.jsonToEnv(input);
  return (
    <ToolShell title=".env ⇄ JSON" subtitle="Convert dotenv config to a JSON object and back.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "e2j", label: ".env → JSON" }, { value: "j2e", label: "JSON → .env" }]} /></div>
        <Field label={dir === "e2j" ? ".env" : "JSON"}><TextArea value={input} onChange={setInput} rows={6} /></Field>
      </Panel>
      <Panel><ErrorNote message={(res as F.JsonResult).error} /><Output value={res.output} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * cURL → fetch
 * ================================================================== */
function CurlTool() {
  const [input, setInput] = useState(`curl -X POST https://api.example.com/login -H "Content-Type: application/json" -d '{"user":"saleh"}'`);
  const out = useMemo(() => F.curlToFetch(input), [input]);
  return (
    <ToolShell title="cURL → fetch()" subtitle="Turn a curl command into a JavaScript fetch() call.">
      <Panel><Field label="curl command"><TextArea value={input} onChange={setInput} rows={5} /></Field></Panel>
      <Panel><Output value={out} label="JavaScript" /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * ASCII table
 * ================================================================== */
function AsciiTool() {
  const rows = useMemo(() => F.asciiTable(), []);
  return (
    <ToolShell title="ASCII Table" subtitle="Printable ASCII characters with decimal and hex codes.">
      <Panel>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          {rows.map((r) => (
            <div key={r.dec} className="rounded-lg border p-2 text-center" style={{ borderColor: "var(--line)" }}>
              <div className="text-base">{r.char}</div>
              <div className="mono text-[10px] text-[var(--fg-2)] force-ltr">{r.dec} · {r.hex}</div>
            </div>
          ))}
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Dice / random roller
 * ================================================================== */
function DiceTool() {
  const [min, setMin] = useState("1");
  const [max, setMax] = useState("100");
  const [result, setResult] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const roll = () => {
    const lo = Math.ceil(parseFloat(min) || 0), hi = Math.floor(parseFloat(max) || 0);
    if (hi < lo) return;
    setRolling(true);
    let ticks = 0;
    const id = setInterval(() => {
      setResult(lo + Math.floor(Math.random() * (hi - lo + 1)));
      if (++ticks > 10) { clearInterval(id); setRolling(false); }
    }, 45);
  };
  useEffect(() => { roll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ToolShell title="Random Number" subtitle="Roll a cryptographically-uniform random integer in a range.">
      <Panel>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min"><Input value={min} onChange={setMin} /></Field>
          <Field label="Max"><Input value={max} onChange={setMax} /></Field>
        </div>
        <div className="mt-4 grid place-items-center">
          <span className="font-display text-6xl accent-text" style={{ transform: rolling ? "scale(1.08)" : "scale(1)", transition: "transform .1s" }}>{result ?? "—"}</span>
          <Btn accent onClick={roll}>🎲 Roll</Btn>
        </div>
      </Panel>
    </ToolShell>
  );
}


/* ================================================================== *
 * JWT builder (HS256)
 * ================================================================== */
function JwtBuildTool() {
  const [payload, setPayload] = useState('{\n  "sub": "1234",\n  "name": "Saleh",\n  "iat": 1700000000\n}');
  const [secret, setSecret] = useState("my-secret");
  const [out, setOut] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    let alive = true;
    F.signJwtHS256(payload, secret).then((r) => { if (!alive) return; if (r.ok) { setOut(r.output); setErr(""); } else { setOut(""); setErr(r.error || ""); } });
    return () => { alive = false; };
  }, [payload, secret]);
  return (
    <ToolShell title="JWT Builder" subtitle="Sign a JSON payload into an HS256 JSON Web Token, entirely in-browser.">
      <Panel>
        <Field label="Payload (JSON)"><TextArea value={payload} onChange={setPayload} rows={7} /></Field>
        <div className="mt-3"><Field label="Secret"><Input value={secret} onChange={setSecret} mono={false} /></Field></div>
      </Panel>
      <Panel><ErrorNote message={err} /><Output value={out} label="Token" /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Colour blender
 * ================================================================== */
function BlendTool() {
  const [a, setA] = useState("#b9ff3a");
  const [b, setB] = useState("#22d3ee");
  const [steps, setSteps] = useState(9);
  const scale = useMemo(() => Array.from({ length: steps }, (_, i) => F.blendHex(a, b, steps === 1 ? 0 : i / (steps - 1)) || "#000"), [a, b, steps]);
  return (
    <ToolShell title="Colour Blender" subtitle="Interpolate a smooth scale between two colours.">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From"><div className="flex gap-2"><input type="color" value={a} onChange={(e) => setA(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border" style={{ borderColor: "var(--line-2)" }} /><Input value={a} onChange={setA} /></div></Field>
          <Field label="To"><div className="flex gap-2"><input type="color" value={b} onChange={(e) => setB(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border" style={{ borderColor: "var(--line-2)" }} /><Input value={b} onChange={setB} /></div></Field>
        </div>
        <div className="mt-3"><Field label={`Steps: ${steps}`}><input type="range" min={3} max={16} value={steps} onChange={(e) => setSteps(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></Field></div>
      </Panel>
      <Panel>
        <div className="flex overflow-hidden rounded-xl">
          {scale.map((c, i) => (
            <div key={i} className="group relative h-16 flex-1" style={{ background: c }} title={c}>
              <span className="mono absolute inset-x-0 bottom-1 text-center text-[8px] opacity-0 transition-opacity group-hover:opacity-100">{c}</span>
            </div>
          ))}
        </div>
        <Output value={scale.join(", ")} label="Scale" />
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Byte size formatter
 * ================================================================== */
function ByteSizeTool() {
  const [input, setInput] = useState("1536000");
  const bytes = F.parseSize(input);
  return (
    <ToolShell title="Byte Size" subtitle="Format a byte count into human-readable units (and parse it back).">
      <Panel><Field label="Bytes or size" hint="e.g. 1536000 or 2.5 MB"><Input value={input} onChange={setInput} /></Field></Panel>
      <Panel>
        {Number.isNaN(bytes) ? <ErrorNote message="Enter a number, optionally with a unit." /> : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat value={F.prettyBytes(bytes)} label="Pretty" />
            <Stat value={bytes.toLocaleString()} label="Bytes" />
            <Stat value={(bytes / 1024).toFixed(2)} label="KiB" />
            <Stat value={(bytes / 1024 ** 2).toFixed(3)} label="MiB" />
          </div>
        )}
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Number list sorter
 * ================================================================== */
function ListSortTool() {
  const [input, setInput] = useState("42, 7, 13, 7, 99, 1, 42");
  const [dir, setDir] = useState<"asc" | "desc" | "unique">("asc");
  const out = F.sortNumbers(input, dir);
  return (
    <ToolShell title="Number Sorter" subtitle="Sort, reverse-sort or de-duplicate a list of numbers.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "asc", label: "Ascending" }, { value: "desc", label: "Descending" }, { value: "unique", label: "Unique" }]} /></div>
        <Field label="Numbers (any separator)"><TextArea value={input} onChange={setInput} rows={4} /></Field>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Emoji picker
 * ================================================================== */
function EmojiTool() {
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState("");
  const copy = (e: string) => { navigator.clipboard?.writeText(e); setCopied(e); setTimeout(() => setCopied(""), 1200); };
  return (
    <ToolShell title="Emoji Picker" subtitle="Search and copy emoji by name.">
      <Panel><Field label="Search"><Input value={q} onChange={setQ} mono={false} placeholder="fire, heart, rocket…" /></Field></Panel>
      {F.EMOJI_SET.map((g) => {
        const items = g.items.filter((it) => (it.name + " " + it.e).toLowerCase().includes(q.toLowerCase()));
        if (!items.length) return null;
        return (
          <Panel key={g.group}>
            <span className="label">{g.group}</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {items.map((it) => (
                <button key={it.e} onClick={() => copy(it.e)} title={it.name} className="grid h-11 w-11 place-items-center rounded-xl border text-2xl transition-transform hover:scale-110 hover:border-[var(--accent)]" style={{ borderColor: copied === it.e ? "var(--accent)" : "var(--line)" }}>{it.e}</button>
              ))}
            </div>
          </Panel>
        );
      })}
    </ToolShell>
  );
}

/* ================================================================== *
 * Text to speech
 * ================================================================== */
function SpeakTool() {
  const [text, setText] = useState("Hello, I'm Saleh. This runs entirely in your browser.");
  const [rate, setRate] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const speak = () => {
    if (typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    speechSynthesis.speak(u);
  };
  const stop = () => { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); setSpeaking(false); };
  return (
    <ToolShell title="Text to Speech" subtitle="Read text aloud with the built-in Web Speech API.">
      <Panel>
        <Field label="Text"><TextArea value={text} onChange={setText} rows={5} mono={false} /></Field>
        <div className="mt-3"><Field label={`Rate: ${rate.toFixed(1)}×`}><input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></Field></div>
        <div className="mt-3 flex gap-2"><Btn accent onClick={speak}>▶ Speak</Btn>{speaking && <Btn onClick={stop}>⏹ Stop</Btn>}</div>
      </Panel>
    </ToolShell>
  );
}


/* ================================================================== *
 * Base32
 * ================================================================== */
function Base32Tool() {
  const [input, setInput] = useState("Saleh");
  const [dir, setDir] = useState<"enc" | "dec">("enc");
  const res = dir === "enc" ? { ok: true, output: F.base32Encode(input) } : F.base32Decode(input);
  return (
    <ToolShell title="Base32" subtitle="RFC 4648 Base32 encoding — used by TOTP secrets and more.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "enc", label: "Encode" }, { value: "dec", label: "Decode" }]} /></div>
        <Field label={dir === "enc" ? "Text" : "Base32"}><TextArea value={input} onChange={setInput} rows={4} /></Field>
      </Panel>
      <Panel><ErrorNote message={(res as F.JsonResult).error} /><Output value={res.output} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Hex dump
 * ================================================================== */
function HexDumpTool() {
  const [input, setInput] = useState("Forge by Saleh — hello!");
  const out = useMemo(() => F.hexDump(input), [input]);
  return (
    <ToolShell title="Hex Dump" subtitle="A classic offset · hex · ASCII dump of a string's bytes.">
      <Panel><Field label="Input"><TextArea value={input} onChange={setInput} rows={4} mono={false} /></Field></Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * String similarity
 * ================================================================== */
function SimilarityTool() {
  const [a, setA] = useState("kitten");
  const [b, setB] = useState("sitting");
  const dist = F.levenshtein(a, b);
  const sim = F.similarity(a, b);
  const col = sim >= 80 ? "#22c55e" : sim >= 50 ? "#eab308" : "#ef4444";
  return (
    <ToolShell title="String Similarity" subtitle="Levenshtein edit distance and a similarity percentage.">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="String A"><Input value={a} onChange={setA} mono={false} /></Field>
          <Field label="String B"><Input value={b} onChange={setB} mono={false} /></Field>
        </div>
      </Panel>
      <Panel>
        <div className="grid grid-cols-2 gap-3">
          <Stat value={dist} label="Edit distance" />
          <div className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
            <div className="count font-display text-2xl font-semibold" style={{ color: col }}>{sim}%</div>
            <div className="label mt-1">Similarity</div>
          </div>
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Password strength analyzer
 * ================================================================== */
function PwStrengthTool() {
  const [pw, setPw] = useState("");
  const a = useMemo(() => F.analyzePassword(pw), [pw]);
  const cols = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];
  return (
    <ToolShell title="Password Strength" subtitle="Estimate entropy and audit a password against common rules — nothing leaves your browser.">
      <Panel><Field label="Password"><Input value={pw} onChange={setPw} type="password" mono={false} /></Field>
        {pw && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs"><span className="label">{a.label}</span><span className="mono">~{a.bits} bits</span></div>
            <div className="flex gap-1">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= a.score ? cols[a.score] : "var(--bg-3)" }} />)}</div>
          </div>
        )}
      </Panel>
      <Panel>
        <div className="grid gap-1.5">
          {a.checks.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-sm"><span style={{ color: c.pass ? "#22c55e" : "var(--fg-2)" }}>{c.pass ? "✓" : "○"}</span><span style={{ color: c.pass ? "var(--fg)" : "var(--fg-2)" }}>{c.label}</span></div>
          ))}
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * IPv4 ⇄ integer
 * ================================================================== */
function IpIntTool() {
  const [input, setInput] = useState("192.168.1.1");
  const [dir, setDir] = useState<"toInt" | "toIp">("toInt");
  const out = dir === "toInt" ? (() => { const n = F.ipv4ToInt(input); return n == null ? "invalid" : String(n); })() : F.intToIpv4(Number(input) >>> 0);
  return (
    <ToolShell title="IPv4 ⇄ Integer" subtitle="Convert an IPv4 address to its 32-bit integer form and back.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "toInt", label: "IP → Integer" }, { value: "toIp", label: "Integer → IP" }]} /></div>
        <Field label={dir === "toInt" ? "IPv4" : "Integer"}><Input value={input} onChange={setInput} /></Field>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}


/* ================================================================== *
 * Hex ⇄ Base64
 * ================================================================== */
function HexB64Tool() {
  const [input, setInput] = useState("48656c6c6f");
  const [dir, setDir] = useState<"h2b" | "b2h">("h2b");
  const res = dir === "h2b" ? F.hexToBase64(input) : F.base64ToHex(input);
  return (
    <ToolShell title="Hex ⇄ Base64" subtitle="Convert raw bytes between hexadecimal and Base64.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "h2b", label: "Hex → Base64" }, { value: "b2h", label: "Base64 → Hex" }]} /></div>
        <Field label={dir === "h2b" ? "Hex" : "Base64"}><TextArea value={input} onChange={setInput} rows={4} /></Field>
      </Panel>
      <Panel><ErrorNote message={res.error} /><Output value={res.output} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * HTML → text
 * ================================================================== */
function StripHtmlTool() {
  const [input, setInput] = useState("<h1>Hello</h1><p>Some <b>bold</b> &amp; <i>italic</i> text.</p>");
  const out = useMemo(() => F.stripHtml(input), [input]);
  return (
    <ToolShell title="HTML → Text" subtitle="Strip tags and decode entities to get clean plain text.">
      <Panel><Field label="HTML"><TextArea value={input} onChange={setInput} rows={6} /></Field></Panel>
      <Panel><Output value={out} label="Plain text" /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * List ⇄ JSON array
 * ================================================================== */
function ListJsonTool() {
  const [dir, setDir] = useState<"l2j" | "j2l">("l2j");
  const [input, setInput] = useState("apple\nbanana\ncherry");
  const res = dir === "l2j" ? { ok: true, output: F.linesToJsonArray(input) } : F.jsonArrayToLines(input);
  return (
    <ToolShell title="List ⇄ JSON Array" subtitle="Turn lines into a JSON string array and back.">
      <Panel>
        <div className="mb-3"><Segmented value={dir} onChange={setDir} options={[{ value: "l2j", label: "Lines → JSON" }, { value: "j2l", label: "JSON → Lines" }]} /></div>
        <Field label={dir === "l2j" ? "Lines" : "JSON array"}><TextArea value={input} onChange={setInput} rows={6} /></Field>
      </Panel>
      <Panel><ErrorNote message={(res as F.JsonResult).error} /><Output value={res.output} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Date difference
 * ================================================================== */
function DateDiffTool() {
  const [a, setA] = useState("2022-01-01");
  const [b, setB] = useState(new Date().toISOString().slice(0, 10));
  const res = useMemo(() => F.dateDiff(a, b), [a, b]);
  return (
    <ToolShell title="Date Difference" subtitle="Measure the span between two dates or timestamps.">
      <Panel>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From"><Input value={a} onChange={setA} /></Field>
          <Field label="To"><Input value={b} onChange={setB} /></Field>
        </div>
      </Panel>
      <Panel>
        <ErrorNote message={res.error} />
        {res.ok && (
          <div className="grid grid-cols-2 gap-3">
            <Stat value={res.text || "—"} label="Duration" />
            <Stat value={`${res.days}`} label="Days" />
          </div>
        )}
      </Panel>
    </ToolShell>
  );
}


/* ================================================================== *
 * Find & replace
 * ================================================================== */
function FindReplaceTool() {
  const [text, setText] = useState("the cat sat on the mat");
  const [find, setFind] = useState("the");
  const [rep, setRep] = useState("a");
  const [useRe, setUseRe] = useState(false);
  const [ci, setCi] = useState(false);
  const { out, count, err } = useMemo(() => {
    if (!find) return { out: text, count: 0, err: "" };
    try {
      const flags = "g" + (ci ? "i" : "");
      const re = useRe ? new RegExp(find, flags) : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
      const matches = text.match(re);
      return { out: text.replace(re, rep), count: matches ? matches.length : 0, err: "" };
    } catch (e) {
      return { out: text, count: 0, err: e instanceof Error ? e.message : "Invalid pattern" };
    }
  }, [text, find, rep, useRe, ci]);
  return (
    <ToolShell title="Find & Replace" subtitle="Replace text with plain-string or regular-expression matching.">
      <Panel>
        <Field label="Text"><TextArea value={text} onChange={setText} rows={5} mono={false} /></Field>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Find"><Input value={find} onChange={setFind} /></Field>
          <Field label="Replace with"><Input value={rep} onChange={setRep} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <Toggle label="Regex" checked={useRe} onChange={setUseRe} />
          <Toggle label="Case-insensitive" checked={ci} onChange={setCi} />
        </div>
      </Panel>
      <Panel><ErrorNote message={err} /><Output value={out} label={`Result · ${count} replacement${count !== 1 ? "s" : ""}`} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Line tools (number / affix)
 * ================================================================== */
function LineToolsTool() {
  const [text, setText] = useState("alpha\nbeta\ngamma");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [numbered, setNumbered] = useState(true);
  const [start, setStart] = useState(1);
  const out = useMemo(() => {
    return text.split("\n").map((l, i) => {
      const num = numbered ? `${start + i}. ` : "";
      return `${num}${prefix}${l}${suffix}`;
    }).join("\n");
  }, [text, prefix, suffix, numbered, start]);
  return (
    <ToolShell title="Line Tools" subtitle="Number lines and add a prefix / suffix to every line.">
      <Panel>
        <Field label="Lines"><TextArea value={text} onChange={setText} rows={6} /></Field>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Prefix"><Input value={prefix} onChange={setPrefix} /></Field>
          <Field label="Suffix"><Input value={suffix} onChange={setSuffix} /></Field>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <Toggle label="Number lines" checked={numbered} onChange={setNumbered} />
          {numbered && <label className="flex items-center gap-2 text-sm"><span className="label">Start at</span><input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} className="w-16 rounded-xl border bg-[var(--bg-3)] px-2 py-1.5 text-sm mono" style={{ borderColor: "var(--line-2)" }} /></label>}
        </div>
      </Panel>
      <Panel><Output value={out} /></Panel>
    </ToolShell>
  );
}


/* ================================================================== *
 * Text repeat / pad
 * ================================================================== */
function RepeatTool() {
  const [text, setText] = useState("na");
  const [times, setTimes] = useState(8);
  const [sep, setSep] = useState(" ");
  const out = useMemo(() => Array.from({ length: F.clamp(times, 1, 10000) }, () => text).join(sep === "\\n" ? "\n" : sep), [text, times, sep]);
  return (
    <ToolShell title="Repeat Text" subtitle="Repeat a string N times with an optional separator.">
      <Panel>
        <Field label="Text"><Input value={text} onChange={setText} /></Field>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm"><span className="label">Times</span><input type="number" min={1} max={10000} value={times} onChange={(e) => setTimes(Number(e.target.value))} className="w-24 rounded-xl border bg-[var(--bg-3)] px-2 py-1.5 text-sm mono" style={{ borderColor: "var(--line-2)" }} /></label>
          <label className="flex items-center gap-2 text-sm"><span className="label">Separator</span><input value={sep} onChange={(e) => setSep(e.target.value)} placeholder="space, \n…" className="w-28 rounded-xl border bg-[var(--bg-3)] px-2 py-1.5 text-sm mono" style={{ borderColor: "var(--line-2)" }} /></label>
        </div>
      </Panel>
      <Panel><Output value={out} label={`${out.length} chars`} /></Panel>
    </ToolShell>
  );
}
