"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as N from "@/lib/forge/netsec";
import { Btn, CopyBtn, ErrorNote, Field, Input, Output, Panel, Segmented, Stat, TextArea, Toggle, ToolShell } from "./ui";
import type { ToolDef } from "./tools";

/* Small "for learning / authorised testing only" banner reused by the labs. */
function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)", background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--fg-2)" }}>
      <span className="mt-0.5" style={{ color: "var(--accent)" }}>ⓘ</span>
      <span>{children}</span>
    </div>
  );
}

/* Renders a parsed packet as a Wireshark-style stack of layers. */
function LayerView({ pkt }: { pkt: N.ParsedPacket }) {
  const [open, setOpen] = useState<number | null>(0);
  if (!pkt.ok) return <ErrorNote message={pkt.error} />;
  return (
    <div className="grid gap-2">
      <div className="mono rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
        {pkt.summary} · <span className="text-[var(--fg-2)]">{pkt.length} bytes</span>
      </div>
      {pkt.layers.map((layer, i) => (
        <div key={i} className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--line-2)" }}>
          <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition-colors hover:bg-[var(--bg-3)]" style={{ background: "var(--bg-3)" }}>
            <span className="mono rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>{layer.name}</span>
            <span className="min-w-0 flex-1 truncate text-[var(--fg-2)]">{layer.summary}</span>
            <span className="text-[var(--fg-2)]">{open === i ? "▾" : "▸"}</span>
          </button>
          {open === i && (
            <div className="divide-y" style={{ borderColor: "var(--line)" }}>
              {layer.fields.map((f, j) => (
                <div key={j} className="grid grid-cols-[9rem_1fr] gap-2 px-3 py-1.5 text-xs" style={{ borderColor: "var(--line)" }}>
                  <span className="text-[var(--fg-2)]">{f.name}</span>
                  <span className="mono break-words">
                    {f.value}
                    {f.note && <span className="ms-2" style={{ color: f.note.startsWith("✓") ? "#22c55e" : "#f59e0b" }}>{f.note}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ================================================================== *
 * Packet Analyzer
 * ================================================================== */
function PacketAnalyzerTool() {
  const [hex, setHex] = useState(N.SAMPLE_PACKETS[0].hex);
  const [start, setStart] = useState<"eth" | "ip">("eth");
  const pkt = useMemo(() => N.parsePacket(hex, start), [hex, start]);
  return (
    <ToolShell title="Packet Analyzer" subtitle="Paste raw packet bytes (hex) and decode every layer — Ethernet, ARP, IPv4/IPv6, TCP, UDP, ICMP and DNS — with real field values, like Wireshark.">
      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="label me-1">Samples:</span>
          {N.SAMPLE_PACKETS.map((s) => (
            <button key={s.id} onClick={() => { setHex(s.hex); setStart("eth"); }} className="chip">{s.label}</button>
          ))}
        </div>
        <Field label="Packet bytes (hex)" hint="spaces/colons ok">
          <TextArea value={hex} onChange={setHex} rows={4} />
        </Field>
        <div className="mt-3"><Segmented value={start} onChange={setStart} options={[{ value: "eth", label: "Ethernet frame" }, { value: "ip", label: "Starts at IP" }]} /></div>
      </Panel>
      <Panel><LayerView pkt={pkt} /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Live Sniffer (demo capture)
 * ================================================================== */
function SnifferTool() {
  const [rows, setRows] = useState<N.CaptureRow[]>([]);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState("");
  const [sel, setSel] = useState<N.CaptureRow | null>(null);
  const no = useRef(1);
  const t0 = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      timer.current = setInterval(() => {
        setRows((r) => {
          const next = [...r, N.genCaptureRow(no.current++, t0.current)];
          return next.slice(-300);
        });
      }, 550);
    } else if (timer.current) clearInterval(timer.current);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [running]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.proto + " " + r.src + " " + r.dst + " " + r.info).toLowerCase().includes(q));
  }, [rows, filter]);

  const protoColor: Record<string, string> = { DNS: "#a78bfa", TCP: "#38bdf8", HTTP: "#22c55e", ICMP: "#fbbf24", ARP: "#fb7185" };

  return (
    <ToolShell title="Live Sniffer (demo)" subtitle="A realistic, tcpdump-style capture stream for learning — packets with genuine structure. Start it, filter it, then click any row to fully decode it. Simulated locally; it never touches your real network.">
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <Btn accent onClick={() => setRunning((v) => !v)}>{running ? "⏸ Pause" : "▶ Start capture"}</Btn>
          <Btn onClick={() => { setRows([]); no.current = 1; t0.current = Date.now(); setSel(null); }}>Clear</Btn>
          <div className="min-w-[10rem] flex-1"><Input value={filter} onChange={setFilter} placeholder="filter: dns, tcp, 8.8.8.8…" /></div>
          <Stat value={rows.length} label="captured" />
        </div>
      </Panel>
      <Panel>
        <div className="thin-scroll max-h-[320px] overflow-auto rounded-lg border" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-start text-xs">
            <thead className="sticky top-0" style={{ background: "var(--bg-3)" }}>
              <tr className="text-[var(--fg-2)]">
                <th className="px-2 py-1.5 text-start font-medium">#</th>
                <th className="px-2 py-1.5 text-start font-medium">Time</th>
                <th className="px-2 py-1.5 text-start font-medium">Source</th>
                <th className="px-2 py-1.5 text-start font-medium">Destination</th>
                <th className="px-2 py-1.5 text-start font-medium">Proto</th>
                <th className="px-2 py-1.5 text-start font-medium">Len</th>
                <th className="px-2 py-1.5 text-start font-medium">Info</th>
              </tr>
            </thead>
            <tbody className="mono">
              {shown.slice().reverse().map((r) => (
                <tr key={r.no} onClick={() => setSel(r)} className="cursor-pointer border-t transition-colors hover:bg-[var(--bg-3)]" style={{ borderColor: "var(--line)", background: sel?.no === r.no ? "color-mix(in srgb, var(--accent) 12%, transparent)" : undefined }}>
                  <td className="px-2 py-1 text-[var(--fg-2)]">{r.no}</td>
                  <td className="px-2 py-1 text-[var(--fg-2)]">{r.time}</td>
                  <td className="px-2 py-1 force-ltr">{r.src}</td>
                  <td className="px-2 py-1 force-ltr">{r.dst}</td>
                  <td className="px-2 py-1 font-semibold" style={{ color: protoColor[r.proto] || "var(--fg)" }}>{r.proto}</td>
                  <td className="px-2 py-1 text-[var(--fg-2)]">{r.length}</td>
                  <td className="px-2 py-1 max-w-0 truncate">{r.info}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="px-2 py-6 text-center text-[var(--fg-2)]">Press “Start capture”.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      {sel && <Panel><p className="label mb-2">Packet #{sel.no} — full decode</p><LayerView pkt={N.parsePacket(sel.hex)} /></Panel>}
    </ToolShell>
  );
}

/* ================================================================== *
 * nmap builder
 * ================================================================== */
function NmapTool() {
  const [o, setO] = useState<N.NmapOpts>({ target: "192.168.1.0/24", ports: "top", scan: "syn", service: true, os: false, scripts: "none", timing: 4, noPing: false, verbose: false });
  const set = (p: Partial<N.NmapOpts>) => setO((s) => ({ ...s, ...p }));
  const cmd = useMemo(() => N.buildNmap(o), [o]);
  return (
    <ToolShell title="nmap Command Builder" subtitle="Compose an nmap scan visually, learn what every flag does, then copy the command to your Linux box. Only scan hosts you own or are authorised to test.">
      <Panel>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {N.NMAP_PRESETS.map((p) => <button key={p.id} onClick={() => set(p.opts)} className="chip">{p.label}</button>)}
        </div>
        <Field label="Target" hint="host, range or CIDR"><Input value={o.target} onChange={(v) => set({ target: v })} /></Field>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Scan type">
            <Segmented value={o.scan} onChange={(v) => set({ scan: v })} options={[{ value: "syn", label: "SYN -sS" }, { value: "connect", label: "Connect -sT" }, { value: "udp", label: "UDP -sU" }, { value: "ping", label: "Ping -sn" }, { value: "ack", label: "ACK -sA" }]} />
          </Field>
          <Field label="Ports">
            <Segmented value={o.ports} onChange={(v) => set({ ports: v })} options={[{ value: "top", label: "Top 100" }, { value: "1-1000", label: "1-1000" }, { value: "1-65535", label: "All" }, { value: "22,80,443", label: "22,80,443" }]} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <Toggle checked={o.service} onChange={(v) => set({ service: v })} label="Version -sV" />
          <Toggle checked={o.os} onChange={(v) => set({ os: v })} label="OS -O" />
          <Toggle checked={o.noPing} onChange={(v) => set({ noPing: v })} label="No ping -Pn" />
          <Toggle checked={o.verbose} onChange={(v) => set({ verbose: v })} label="Verbose -v" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="label">Scripts</span>
          <Segmented value={o.scripts} onChange={(v) => set({ scripts: v })} options={[{ value: "none", label: "None" }, { value: "default", label: "-sC" }, { value: "vuln", label: "vuln" }]} />
          <span className="label ms-3">Timing T{o.timing}</span>
          <input type="range" min={0} max={5} value={o.timing} onChange={(e) => set({ timing: +e.target.value })} className="accent-[var(--accent)]" />
        </div>
      </Panel>
      <Panel><Output value={cmd} label="Command" /></Panel>
      <Panel>
        <p className="label mb-2">Flag reference</p>
        <div className="grid gap-1.5">
          {N.NMAP_FLAGS.map((f) => (
            <div key={f.flag} className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
              <span className="mono font-semibold accent-text">{f.flag}</span>
              <span className="text-[var(--fg-2)]">{f.desc}</span>
            </div>
          ))}
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * SQL Injection lab
 * ================================================================== */
function SqliTool() {
  const [u, setU] = useState("' OR '1'='1");
  const [p, setP] = useState("x");
  const res = useMemo(() => N.analyzeSqli(u, p), [u, p]);
  return (
    <ToolShell title="SQL Injection Lab" subtitle="A safe, offline simulator of a string-concatenated login query. See how a payload rewrites the SQL, why it bypasses auth, and the parameterised query that stops it. No real database is touched.">
      <Notice>Educational sandbox. Only test injection against apps you own or are explicitly authorised to assess.</Notice>
      <Panel>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {N.SQLI_PAYLOADS.map((x) => <button key={x.p} onClick={() => setU(x.p)} className="chip force-ltr" title={x.note}>{x.p}</button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="username"><Input value={u} onChange={setU} /></Field>
          <Field label="password"><Input value={p} onChange={setP} /></Field>
        </div>
      </Panel>
      <Panel>
        <Stat value={res.bypassed ? "⚠ Auth bypassed" : "No bypass"} label="Simulated result" />
        <p className="mt-3 text-sm text-[var(--fg-2)]">{res.reason}</p>
        {res.detected.length > 0 && (
          <div className="mt-3 grid gap-1.5">
            {res.detected.map((d, i) => (
              <div key={i} className="rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: "color-mix(in srgb, #f59e0b 40%, transparent)" }}>
                <span className="mono accent-text">{d.payload}</span> — <span className="text-[var(--fg-2)]">{d.kind}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel><Output value={res.vulnerableQuery} label="① Vulnerable query (string-concatenated)" /></Panel>
      <Panel><Output value={res.safeQuery} label="② Safe query (parameterised / prepared)" /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * XSS lab
 * ================================================================== */
function XssTool() {
  const [input, setInput] = useState('<img src=x onerror=alert(1)>');
  const res = useMemo(() => N.analyzeXss(input), [input]);
  return (
    <ToolShell title="XSS Lab & Escaper" subtitle="Classify a cross-site-scripting payload, see how it must be escaped for HTML/JS/attributes, and preview the safely-encoded output. Payloads are shown as text — never executed.">
      <Notice>The preview below is fully escaped and inert. Learn detection + output encoding; test only on your own apps.</Notice>
      <Panel>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {N.XSS_PAYLOADS.map((x) => <button key={x.p} onClick={() => setInput(x.p)} className="chip force-ltr" title={x.note}>{x.p.slice(0, 22)}</button>)}
        </div>
        <Field label="Untrusted input"><TextArea value={input} onChange={setInput} rows={3} /></Field>
      </Panel>
      <Panel>
        <p className="label mb-2">Detected vectors</p>
        {res.vectors.length ? (
          <div className="grid gap-1.5">{res.vectors.map((v, i) => <div key={i} className="rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: "color-mix(in srgb, #ef4444 40%, transparent)", color: "#ef4444" }}>⚠ {v}</div>)}</div>
        ) : <p className="text-sm text-[var(--fg-2)]">No obvious script vectors — still encode all untrusted output.</p>}
        <div className="mt-3"><span className="label">Safe rendered preview (escaped, inert)</span>
          <div className="mt-1 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>{input}</div>
        </div>
      </Panel>
      <Panel><Output value={res.escaped} label="HTML-encoded (for element/text context)" /></Panel>
      <Panel><Output value={res.jsEscaped} label="JS string-encoded (for <script> context)" /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Command injection analyzer
 * ================================================================== */
function CmdiTool() {
  const [input, setInput] = useState("8.8.8.8; cat /etc/passwd");
  const res = useMemo(() => N.analyzeCmdInjection(input), [input]);
  return (
    <ToolShell title="Command Injection Analyzer" subtitle="Spot the shell metacharacters that let user input break out of a command, and see the safe, shell-free way to run it.">
      <Notice>Educational. Never run untrusted input through a shell in production.</Notice>
      <Panel><Field label="User input (e.g. a “ping this host” field)"><Input value={input} onChange={setInput} /></Field></Panel>
      <Panel>
        <Stat value={res.risky ? "⚠ Injection-prone" : "No shell metacharacters"} label="Verdict" />
        {res.hits.length > 0 && (
          <div className="mt-3 grid gap-1.5">
            {res.hits.map((h, i) => (
              <div key={i} className="grid grid-cols-[5rem_1fr] gap-2 text-xs">
                <span className="mono font-semibold" style={{ color: "#ef4444" }}>{h.token}</span>
                <span className="text-[var(--fg-2)]">{h.desc}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel><Output value={res.safe} label="Safe approach — pass args as an array, no shell" /></Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * HTTP security headers
 * ================================================================== */
function HeadersTool() {
  const [raw, setRaw] = useState("content-type: text/html\nx-content-type-options: nosniff\nstrict-transport-security: max-age=63072000; includeSubDomains");
  const res = useMemo(() => N.gradeSecurityHeaders(raw), [raw]);
  const gradeColor = res.grade.startsWith("A") ? "#22c55e" : res.grade === "B" ? "#84cc16" : res.grade === "C" ? "#fbbf24" : "#ef4444";
  return (
    <ToolShell title="HTTP Security Headers" subtitle="Paste a response's headers and grade its security posture — CSP, HSTS, X-Frame-Options and more — with fix-it advice for anything missing.">
      <Panel><Field label="Raw response headers"><TextArea value={raw} onChange={setRaw} rows={6} /></Field></Panel>
      <Panel>
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl font-display text-3xl" style={{ background: `color-mix(in srgb, ${gradeColor} 16%, transparent)`, color: gradeColor }}>{res.grade}</div>
          <div><div className="count font-display text-2xl">{res.score}/100</div><div className="label">security score</div></div>
        </div>
        <div className="mt-4 grid gap-1.5">
          {res.checks.map((c) => (
            <div key={c.name} className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--line)" }}>
              <span style={{ color: c.present ? "#22c55e" : "#ef4444" }}>{c.present ? "✓" : "✗"}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{c.name} <span className="text-[var(--fg-2)]">· {c.weight} pts</span></div>
                {c.present ? <div className="mono break-words text-[var(--fg-2)]">{c.value}</div> : <div className="text-[var(--fg-2)]">{c.advice}</div>}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * Linux cheatsheet + payload reference
 * ================================================================== */
function CheatsheetTool() {
  return (
    <ToolShell title="Linux & Security Cheatsheet" subtitle="Copy-paste commands for the core network & security tools on Linux, plus a reference of common injection payloads — all for learning and authorised testing.">
      <Notice>For labs and systems you own or are authorised to test. Unauthorised scanning/attacking is illegal.</Notice>
      {N.LINUX_CHEATS.map((tool) => (
        <Panel key={tool.tool}>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-lg accent-text">{tool.tool}</span>
          </div>
          <p className="mb-3 text-xs text-[var(--fg-2)]">{tool.note}</p>
          <div className="grid gap-1.5">
            {tool.cmds.map((c) => (
              <div key={c.c} className="flex items-center gap-2 rounded-lg border px-3 py-1.5" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}>
                <code className="mono min-w-0 flex-1 truncate text-xs">{c.c}</code>
                <span className="hidden text-[10px] text-[var(--fg-2)] sm:block">{c.d}</span>
                <CopyBtn text={c.c} label="" />
              </div>
            ))}
          </div>
        </Panel>
      ))}
      <Panel>
        <p className="label mb-2">SQL injection payloads</p>
        <div className="grid gap-1.5">
          {N.SQLI_PAYLOADS.map((x) => (
            <div key={x.p} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: "var(--line)" }}>
              <code className="mono min-w-0 flex-1 truncate force-ltr">{x.p}</code>
              <span className="hidden text-[10px] text-[var(--fg-2)] sm:block">{x.note}</span>
              <CopyBtn text={x.p} label="" />
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <p className="label mb-2">XSS payloads</p>
        <div className="grid gap-1.5">
          {N.XSS_PAYLOADS.map((x) => (
            <div key={x.p} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: "var(--line)" }}>
              <code className="mono min-w-0 flex-1 truncate force-ltr">{x.p}</code>
              <span className="hidden text-[10px] text-[var(--fg-2)] sm:block">{x.note}</span>
              <CopyBtn text={x.p} label="" />
            </div>
          ))}
        </div>
      </Panel>
    </ToolShell>
  );
}

/* ================================================================== *
 * registry
 * ================================================================== */
export const NETSEC_CATEGORIES = ["Network", "Security"];

export const NETSEC_TOOLS: ToolDef[] = [
  { id: "packet", name: "Packet Analyzer", icon: "🔬", category: "Network", keywords: "packet analyzer wireshark decode ethernet ip tcp udp dns icmp arp hex network", render: PacketAnalyzerTool },
  { id: "sniffer", name: "Live Sniffer", icon: "📡", category: "Network", keywords: "sniffer capture tcpdump packets live stream network monitor", render: SnifferTool },
  { id: "nmap", name: "nmap Builder", icon: "🛰", category: "Network", keywords: "nmap port scan network scanner command builder recon", render: NmapTool },
  { id: "sqli", name: "SQL Injection Lab", icon: "💉", category: "Security", keywords: "sql injection sqli security payload database bypass owasp", render: SqliTool },
  { id: "xss", name: "XSS Lab", icon: "✖", category: "Security", keywords: "xss cross site scripting security escape sanitize payload owasp", render: XssTool },
  { id: "cmdi", name: "Command Injection", icon: "❯", category: "Security", keywords: "command injection shell rce security metacharacters owasp", render: CmdiTool },
  { id: "sechdr", name: "Security Headers", icon: "🛡", category: "Security", keywords: "http security headers csp hsts xframe grade audit", render: HeadersTool },
  { id: "cheats", name: "Linux Cheatsheet", icon: "🐧", category: "Security", keywords: "linux cheatsheet nmap tcpdump wireshark netcat commands payloads tutorial", render: CheatsheetTool },
];
