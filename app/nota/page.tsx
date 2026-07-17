"use client";

/*
  Nota — an offline-first, markdown-native knowledge base.

  A real product, all client-side (localStorage, no server, no account):
    • Full markdown editor with a live preview: headings h1–h6, bold/italic,
      inline + fenced code, quotes, rules, ordered/unordered lists, task lists,
      tables, images, links, and [[wiki links]] that create-or-open notes.
    • Automatic backlinks panel + a per-note table of contents.
    • #tags with a filter rail, pinning, note colours, and sort by
      updated / created / title.
    • Instant full-text search, note templates, duplicate, per-note markdown
      export, whole-library JSON export/import, reading-time + word/char stats.
    • Fully bilingual (English / Persian) and theme-aware.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/lang-provider";
import { ThemePicker } from "@/components/theme-picker";
import { LangToggle } from "@/components/lang-toggle";

type Note = { id: string; title: string; body: string; created: number; updated: number; pinned?: boolean; color?: string };
type SortMode = "updated" | "created" | "title";

const STORE = "nota:notes:v1";
const uid = () => Math.random().toString(36).slice(2, 10);
const NOTE_COLORS = ["", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

const seed = (fa: boolean): Note[] => {
  const now = Date.now();
  return [
    {
      id: uid(), pinned: true, updated: now, created: now,
      title: fa ? "به نوتا خوش آمدی" : "Welcome to Nota",
      body: fa
        ? "# سلام 👋\n\nنوتا یک **پایگاهِ دانشِ آفلاین‌محور** است. همه‌چیز فقط در مرورگرِ تو ذخیره می‌شود.\n\n## چه کارهایی می‌کنی؟\n- نوشتن با **مارک‌داون** و پیش‌نمایشِ زنده\n- ساختِ پیوند با `[[عنوانِ یادداشت]]`\n- برچسب با #ایده و #راهنما\n- جدول، تصویر، فهرستِ کارها و بیشتر\n\n| ویژگی | پشتیبانی |\n| --- | --- |\n| جدول | ✅ |\n| تصویر | ✅ |\n\n> یادداشت را سنجاق کن، رنگ بده، یا از قالب بساز.\n\n- [x] نوتا را باز کن\n- [ ] اولین یادداشتت را بنویس\n\nنگاهی بینداز به [[ایده‌ها]]."
        : "# Hello 👋\n\nNota is an **offline-first knowledge base**. Everything is stored only in your browser.\n\n## What can you do?\n- Write in **markdown** with a live preview\n- Link notes with `[[Note title]]`\n- Tag with #idea and #guide\n- Tables, images, task lists and more\n\n| Feature | Supported |\n| --- | --- |\n| Tables | ✅ |\n| Images | ✅ |\n\n> Pin a note, colour it, or start from a template.\n\n- [x] Open Nota\n- [ ] Write your first note\n\nTake a look at [[Ideas]].",
    },
    {
      id: uid(), updated: now - 1000, created: now - 1000,
      title: fa ? "ایده‌ها" : "Ideas",
      body: fa ? "# ایده‌ها\n\nهرچه به ذهنت رسید اینجا بنویس. #ایده\n\n1. یک اپِ آب‌وهوا\n2. بازنویسیِ رزومه\n\nبرگرد به [[به نوتا خوش آمدی]]." : "# Ideas\n\nCapture anything here. #idea\n\n1. A weather app\n2. Rewrite the résumé\n\nBack to [[Welcome to Nota]].",
    },
  ];
};

/* ----------------------------- markdown ----------------------------- */

function InlineMD({ text, onLink }: { text: string; onLink: (title: string) => void }) {
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  const re = /(!\[[^\]]*\]\([^)]+\))|(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(~~[^~]+~~)|(\[\[[^\]]+\]\])|(\[[^\]]+\]\([^)]+\))/;
  while (rest.length) {
    const m = rest.match(re);
    if (!m || m.index === undefined) { nodes.push(<span key={key++}>{rest}</span>); break; }
    if (m.index > 0) nodes.push(<span key={key++}>{rest.slice(0, m.index)}</span>);
    const tok = m[0];
    if (tok.startsWith("![")) { const mm = tok.match(/!\[([^\]]*)\]\(([^)]+)\)/)!; nodes.push(<img key={key++} src={mm[2]} alt={mm[1]} className="my-2 max-h-80 max-w-full rounded-lg" />); }
    else if (tok.startsWith("`")) nodes.push(<code key={key++} className="rounded px-1.5 py-0.5 mono text-[0.85em]" style={{ background: "var(--bg-3)", color: "var(--accent)" }}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) nodes.push(<b key={key++}>{tok.slice(2, -2)}</b>);
    else if (tok.startsWith("~~")) nodes.push(<s key={key++} className="opacity-70">{tok.slice(2, -2)}</s>);
    else if (tok.startsWith("*")) nodes.push(<i key={key++}>{tok.slice(1, -1)}</i>);
    else if (tok.startsWith("[[")) { const title = tok.slice(2, -2).trim(); nodes.push(<button key={key++} onClick={() => onLink(title)} className="rounded px-1 font-medium underline decoration-dotted underline-offset-2" style={{ color: "var(--accent)" }}>{title}</button>); }
    else { const mm = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)!; nodes.push(<a key={key++} href={mm[2]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: "var(--accent)" }}>{mm[1]}</a>); }
    rest = rest.slice(m.index + tok.length);
  }
  return <>{nodes}</>;
}

function Markdown({ src, onLink }: { src: string; onLink: (title: string) => void }) {
  const lines = src.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0, key = 0;
  let ul: React.ReactNode[] | null = null;
  let ol: React.ReactNode[] | null = null;
  const flush = () => {
    if (ul) { out.push(<ul key={key++} className="my-2 space-y-1 ps-6">{ul}</ul>); ul = null; }
    if (ol) { out.push(<ol key={key++} className="my-2 list-decimal space-y-1 ps-6">{ol}</ol>); ol = null; }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flush(); const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++; } i++;
      out.push(<pre key={key++} className="my-2 overflow-x-auto rounded-xl p-3 mono text-[13px] force-ltr" style={{ background: "var(--bg-3)", border: "1px solid var(--line)" }}><code>{buf.join("\n")}</code></pre>);
      continue;
    }
    // tables: | a | b | then | --- | --- |
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      flush();
      const parseRow = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const header = parseRow(line); i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(parseRow(lines[i])); i++; }
      out.push(
        <div key={key++} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead><tr>{header.map((h, j) => <th key={j} className="border px-3 py-1.5 text-start font-semibold" style={{ borderColor: "var(--line)", background: "var(--bg-3)" }}><InlineMD text={h} onLink={onLink} /></th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border px-3 py-1.5" style={{ borderColor: "var(--line)" }}><InlineMD text={c} onLink={onLink} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flush();
      const level = line.match(/^#+/)![0].length;
      const txt = line.replace(/^#+\s/, "");
      const sizes = ["text-2xl font-display", "text-xl font-semibold", "text-lg font-semibold", "text-base font-semibold", "text-sm font-semibold", "text-sm font-semibold opacity-80"];
      out.push(<div key={key++} id={"h-" + slug(txt)} className={"mt-3 mb-1 " + sizes[level - 1]}><InlineMD text={txt} onLink={onLink} /></div>);
    } else if (/^>\s/.test(line)) {
      flush();
      out.push(<blockquote key={key++} className="my-2 border-s-2 ps-3 text-[var(--fg-2)]" style={{ borderColor: "var(--accent)" }}><InlineMD text={line.replace(/^>\s/, "")} onLink={onLink} /></blockquote>);
    } else if (/^---+\s*$/.test(line)) {
      flush(); out.push(<hr key={key++} className="my-3" style={{ borderColor: "var(--line)" }} />);
    } else if (/^\s*-\s\[[ x]\]\s/.test(line)) {
      const checked = /\[x\]/i.test(line); const txt = line.replace(/^\s*-\s\[[ x]\]\s/, ""); ul = ul || [];
      ul.push(<li key={key++} className="flex list-none items-start gap-2 -ms-6"><span className="mt-0.5" style={{ color: checked ? "var(--accent)" : "var(--fg-2)" }}>{checked ? "☑" : "☐"}</span><span className={checked ? "line-through opacity-60" : ""}><InlineMD text={txt} onLink={onLink} /></span></li>);
    } else if (/^\s*\d+\.\s/.test(line)) {
      ol = ol || []; ol.push(<li key={key++}><InlineMD text={line.replace(/^\s*\d+\.\s/, "")} onLink={onLink} /></li>);
    } else if (/^\s*[-*]\s/.test(line)) {
      ul = ul || []; ul.push(<li key={key++} className="list-disc"><InlineMD text={line.replace(/^\s*[-*]\s/, "")} onLink={onLink} /></li>);
    } else if (line.trim() === "") {
      flush();
    } else {
      flush(); out.push(<p key={key++} className="my-1.5 leading-relaxed"><InlineMD text={line} onLink={onLink} /></p>);
    }
    i++;
  }
  flush();
  return <div className="text-[15px]">{out}</div>;
}

const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\d]+/gu, "-").replace(/^-|-$/g, "");
const tagsOf = (body: string) => Array.from(new Set((body.match(/(^|\s)#([\p{L}\d_-]+)/gu) || []).map((t) => t.trim().replace(/^#/, "").toLowerCase())));
const linksOf = (body: string) => Array.from(new Set((body.match(/\[\[([^\]]+)\]\]/g) || []).map((t) => t.slice(2, -2).trim().toLowerCase())));
const headingsOf = (body: string) => body.split("\n").filter((l) => /^#{1,6}\s/.test(l)).map((l) => ({ level: l.match(/^#+/)![0].length, text: l.replace(/^#+\s/, "") }));

export default function NotaPage() {
  const { lang } = useLang();
  const fa = lang === "fa";
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("updated");
  const [preview, setPreview] = useState(true);
  const [ready, setReady] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [showTpl, setShowTpl] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const T = fa
    ? { brand: "نوتا", newNote: "یادداشتِ تازه", search: "جست‌وجو در همه…", untitled: "بدون عنوان", empty: "یادداشتی نیست", write: "بنویس…", preview: "پیش‌نمایش", edit: "ویرایش", del: "حذف", backlinks: "ارجاع‌ها", noBacklinks: "هیچ یادداشتی به این ارجاع نداده.", words: "کلمه", chars: "نویسه", read: "دقیقه مطالعه", tags: "برچسب‌ها", export: "برون‌بری", import: "درون‌ری", all: "همه", confirmDel: "این یادداشت حذف شود؟", titlePh: "عنوان یادداشت", pickNote: "یک یادداشت را انتخاب کن یا یکی تازه بساز.", pin: "سنجاق", unpin: "برداشتنِ سنجاق", duplicate: "تکثیر", exportMd: "خروجی ‎.md", copyMd: "کپیِ مارک‌داون", toc: "فهرست", sortBy: "مرتب‌سازی", sUpdated: "آخرین ویرایش", sCreated: "تاریخ ساخت", sTitle: "عنوان", templates: "قالب‌ها", tplDaily: "یادداشتِ روزانه", tplMeeting: "جلسه", tplTable: "جدول", color: "رنگ" }
    : { brand: "Nota", newNote: "New note", search: "Search everything…", untitled: "Untitled", empty: "No notes", write: "Write…", preview: "Preview", edit: "Edit", del: "Delete", backlinks: "Backlinks", noBacklinks: "No notes link here yet.", words: "words", chars: "chars", read: "min read", tags: "Tags", export: "Export", import: "Import", all: "All", confirmDel: "Delete this note?", titlePh: "Note title", pickNote: "Select a note or create a new one.", pin: "Pin", unpin: "Unpin", duplicate: "Duplicate", exportMd: "Export .md", copyMd: "Copy markdown", toc: "Contents", sortBy: "Sort", sUpdated: "Last edited", sCreated: "Created", sTitle: "Title", templates: "Templates", tplDaily: "Daily note", tplMeeting: "Meeting", tplTable: "Table", color: "Color" };

  useEffect(() => {
    try { const raw = localStorage.getItem(STORE); const parsed: Note[] = raw ? JSON.parse(raw) : []; const data = parsed.length ? parsed : seed(fa); setNotes(data); setActiveId(data[0]?.id ?? null); }
    catch { const s = seed(fa); setNotes(s); setActiveId(s[0]?.id ?? null); }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(STORE, JSON.stringify(notes)); } catch {} }, [notes, ready]);

  const active = notes.find((n) => n.id === activeId) || null;

  const createNote = useCallback((title = "", body = "") => {
    const now = Date.now();
    const n: Note = { id: uid(), title, body, created: now, updated: now };
    setNotes((p) => [n, ...p]); setActiveId(n.id); setSidebar(false); return n;
  }, []);
  const patchActive = (patch: Partial<Note>) => setNotes((p) => p.map((n) => (n.id === activeId ? { ...n, ...patch, updated: Date.now() } : n)));
  const togglePin = (id: string) => setNotes((p) => p.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  const duplicate = () => { if (!active) return; const now = Date.now(); const n: Note = { ...active, id: uid(), title: active.title + (fa ? " (کپی)" : " (copy)"), created: now, updated: now, pinned: false }; setNotes((p) => [n, ...p]); setActiveId(n.id); };

  const openByTitle = (title: string) => { const found = notes.find((n) => n.title.trim().toLowerCase() === title.trim().toLowerCase()); if (found) { setActiveId(found.id); setSidebar(false); } else createNote(title); };
  const removeActive = () => { if (!active || !window.confirm(T.confirmDel)) return; setNotes((p) => { const next = p.filter((n) => n.id !== active.id); setActiveId(next[0]?.id ?? null); return next; }); };

  const insertTemplate = (kind: "daily" | "meeting" | "table") => {
    setShowTpl(false);
    const d = new Date().toISOString().slice(0, 10);
    const body = kind === "daily"
      ? (fa ? `# ${d}\n\n## تمرکزِ امروز\n- \n\n## یادداشت‌ها\n\n## کارها\n- [ ] ` : `# ${d}\n\n## Today's focus\n- \n\n## Notes\n\n## Tasks\n- [ ] `)
      : kind === "meeting"
      ? (fa ? `# جلسه — \n\n**تاریخ:** ${d}\n**حاضران:** \n\n## دستورِ کار\n- \n\n## تصمیم‌ها\n\n## اقدامات\n- [ ] ` : `# Meeting — \n\n**Date:** ${d}\n**Attendees:** \n\n## Agenda\n- \n\n## Decisions\n\n## Action items\n- [ ] `)
      : (fa ? `| ستون ۱ | ستون ۲ |\n| --- | --- |\n| مقدار | مقدار |\n| مقدار | مقدار |\n` : `| Column 1 | Column 2 |\n| --- | --- |\n| value | value |\n| value | value |\n`);
    createNote(kind === "daily" ? d : kind === "meeting" ? (fa ? "جلسه" : "Meeting") : (fa ? "جدول" : "Table"), body);
  };

  const allTags = useMemo(() => Array.from(new Set(notes.flatMap((n) => tagsOf(n.body)))).sort(), [notes]);
  const backlinks = useMemo(() => { if (!active) return []; const t = active.title.trim().toLowerCase(); return notes.filter((n) => n.id !== active.id && linksOf(n.body).includes(t)); }, [notes, active]);
  const toc = useMemo(() => (active ? headingsOf(active.body) : []), [active]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cmp = sort === "title" ? (a: Note, b: Note) => a.title.localeCompare(b.title) : sort === "created" ? (a: Note, b: Note) => b.created - a.created : (a: Note, b: Note) => b.updated - a.updated;
    return [...notes]
      .filter((n) => (!tag || tagsOf(n.body).includes(tag)))
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || cmp(a, b));
  }, [notes, query, tag, sort]);

  const download = (name: string, text: string, mime = "text/plain") => { const blob = new Blob([text], { type: mime }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
  const exportJSON = () => download("nota-export.json", JSON.stringify(notes, null, 2), "application/json");
  const exportMd = () => { if (active) download((active.title || "note").replace(/[^\p{L}\d]+/gu, "-") + ".md", active.body, "text/markdown"); };
  const importJSON = (file: File) => { const r = new FileReader(); r.onload = () => { try { const arr = JSON.parse(r.result as string); if (Array.isArray(arr)) { setNotes(arr); setActiveId(arr[0]?.id ?? null); } } catch {} }; r.readAsText(file); };

  const words = active ? (active.body.trim().match(/\S+/g) || []).length : 0;
  const readMin = Math.max(1, Math.round(words / 200));

  return (
    <div className="flex h-[100dvh] flex-col" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="mono text-sm text-[var(--fg-2)] hover:text-[var(--fg)]">← saleh.im</Link>
          <span className="hidden items-center gap-2 sm:flex"><span className="grid h-8 w-8 place-items-center rounded-xl text-lg" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "var(--on-accent)" }}>◲</span><span className="font-display text-lg">{T.brand}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportJSON} className="btn btn-outline hidden h-9 px-3 py-0 text-xs sm:inline-flex">↓ {T.export}</button>
          <button onClick={() => fileRef.current?.click()} className="btn btn-outline hidden h-9 px-3 py-0 text-xs sm:inline-flex">↑ {T.import}</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.currentTarget.value = ""; }} />
          <ThemePicker /><LangToggle />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className={`${sidebar ? "flex" : "hidden"} w-full flex-col border-e sm:flex sm:w-80 sm:shrink-0`} style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
          <div className="space-y-2 border-b p-3" style={{ borderColor: "var(--line)" }}>
            <div className="flex gap-2">
              <button onClick={() => createNote("")} className="btn btn-accent flex-1">+ {T.newNote}</button>
              <div className="relative">
                <button onClick={() => setShowTpl((s) => !s)} className="btn btn-outline h-full px-3" title={T.templates}>▤</button>
                {showTpl && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowTpl(false)} />
                    <div className="absolute end-0 z-20 mt-1 w-44 rounded-xl border p-1 text-sm shadow-lg" style={{ borderColor: "var(--line-2)", background: "var(--bg-2)" }}>
                      <div className="label px-2 py-1">{T.templates}</div>
                      <button onClick={() => insertTemplate("daily")} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-[var(--bg-3)]">📅 {T.tplDaily}</button>
                      <button onClick={() => insertTemplate("meeting")} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-[var(--bg-3)]">👥 {T.tplMeeting}</button>
                      <button onClick={() => insertTemplate("table")} className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-[var(--bg-3)]">▦ {T.tplTable}</button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={T.search} className="w-full rounded-xl border px-3 py-2 text-sm outline-none" style={{ background: "var(--bg-3)", borderColor: "var(--line)" }} />
            <div className="flex items-center gap-2 text-xs text-[var(--fg-2)]">
              <span>{T.sortBy}:</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="rounded-lg border bg-transparent px-2 py-1 outline-none" style={{ borderColor: "var(--line)" }}>
                <option value="updated">{T.sUpdated}</option><option value="created">{T.sCreated}</option><option value="title">{T.sTitle}</option>
              </select>
            </div>
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button onClick={() => setTag(null)} className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: tag === null ? "var(--accent)" : "var(--bg-3)", color: tag === null ? "var(--on-accent)" : "var(--fg-2)" }}>{T.all}</button>
                {allTags.map((tg) => <button key={tg} onClick={() => setTag(tg === tag ? null : tg)} className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: tag === tg ? "var(--accent)" : "var(--bg-3)", color: tag === tg ? "var(--on-accent)" : "var(--fg-2)" }}>#{tg}</button>)}
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 thin-scroll">
            {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-[var(--fg-2)]">{T.empty}</p>}
            {filtered.map((n) => (
              <div key={n.id} className="group relative">
                <button onClick={() => { setActiveId(n.id); setSidebar(false); }} className="mb-1 block w-full rounded-xl p-2.5 text-start transition-colors" style={{ background: activeId === n.id ? "var(--bg-3)" : "transparent", borderInlineStart: n.color ? `3px solid ${n.color}` : "3px solid transparent" }}>
                  <div className="flex items-center gap-1.5"><span className="truncate text-sm font-medium">{n.title || T.untitled}</span>{n.pinned && <span className="text-xs">📌</span>}</div>
                  <div className="truncate text-xs text-[var(--fg-2)]">{n.body.replace(/[#*`>\-[\]|]/g, "").slice(0, 60) || "…"}</div>
                </button>
                <button onClick={() => togglePin(n.id)} className="absolute end-2 top-2 hidden rounded p-1 text-xs opacity-0 transition-opacity group-hover:block group-hover:opacity-100" title={n.pinned ? T.unpin : T.pin}>{n.pinned ? "📌" : "📍"}</button>
              </div>
            ))}
          </div>
        </aside>

        <main className={`${sidebar ? "hidden" : "flex"} min-w-0 flex-1 flex-col sm:flex`}>
          {!active ? (
            <div className="grid flex-1 place-items-center p-8 text-center text-[var(--fg-2)]">{T.pickNote}</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                <button onClick={() => setSidebar(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border sm:hidden" style={{ borderColor: "var(--line-2)" }}>☰</button>
                <input value={active.title} onChange={(e) => patchActive({ title: e.target.value })} placeholder={T.titlePh} className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none" />
                {/* colour dots */}
                <div className="hidden items-center gap-1 sm:flex">
                  {NOTE_COLORS.map((c) => <button key={c || "none"} onClick={() => patchActive({ color: c })} className="h-5 w-5 rounded-full border-2" title={T.color} style={{ background: c || "var(--bg-3)", borderColor: active.color === c ? "var(--fg)" : "var(--line)" }}>{!c && <span className="text-[9px]">✕</span>}</button>)}
                </div>
                <button onClick={() => togglePin(active.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border" style={{ borderColor: active.pinned ? "var(--accent)" : "var(--line-2)" }} title={active.pinned ? T.unpin : T.pin}>📌</button>
                <button onClick={duplicate} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }} title={T.duplicate}>⧉</button>
                <button onClick={() => navigator.clipboard?.writeText(active.body)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border" style={{ borderColor: "var(--line-2)" }} title={T.copyMd}>⧉md</button>
                <button onClick={exportMd} className="btn btn-outline hidden h-9 px-3 py-0 text-xs sm:inline-flex">{T.exportMd}</button>
                <button onClick={() => setPreview((p) => !p)} className="btn btn-outline h-9 px-3 py-0 text-xs">{preview ? T.edit : T.preview}</button>
                <button onClick={removeActive} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors hover:border-[#ff6a6a] hover:text-[#ff6a6a]" style={{ borderColor: "var(--line-2)" }} title={T.del}>🗑</button>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
                <textarea ref={bodyRef} value={active.body} onChange={(e) => patchActive({ body: e.target.value })} placeholder={T.write} className={`${preview ? "hidden md:block" : "block"} min-h-0 resize-none overflow-y-auto border-e p-4 mono text-[14px] leading-relaxed outline-none thin-scroll force-ltr`} style={{ background: "var(--bg)", borderColor: "var(--line)" }} />
                <div className={`${preview ? "block" : "hidden md:block"} min-h-0 overflow-y-auto p-4 thin-scroll`} style={{ background: preview ? "var(--bg)" : "var(--bg-2)" }}>
                  {toc.length > 2 && (
                    <details className="mb-3 rounded-xl border p-2" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                      <summary className="cursor-pointer text-xs font-semibold text-[var(--fg-2)]">📑 {T.toc}</summary>
                      <div className="mt-2 space-y-0.5">{toc.map((h, j) => <div key={j} className="truncate text-xs text-[var(--fg-2)] hover:text-[var(--accent)]" style={{ paddingInlineStart: (h.level - 1) * 12 }}>{h.text}</div>)}</div>
                    </details>
                  )}
                  <Markdown src={active.body || (fa ? "*خالی*" : "*Empty*")} onLink={openByTitle} />
                  <div className="mt-6 rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                    <div className="label mb-2">🔗 {T.backlinks}</div>
                    {backlinks.length === 0 ? <p className="text-xs text-[var(--fg-2)]">{T.noBacklinks}</p> : <div className="flex flex-wrap gap-1.5">{backlinks.map((b) => <button key={b.id} onClick={() => setActiveId(b.id)} className="rounded-lg border px-2 py-1 text-xs" style={{ borderColor: "var(--line-2)" }}>{b.title || T.untitled}</button>)}</div>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 border-t px-4 py-2 text-xs text-[var(--fg-2)]" style={{ borderColor: "var(--line)", background: "var(--bg-2)" }}>
                <span className="mono">{words} {T.words}</span>
                <span className="mono">{active.body.length} {T.chars}</span>
                <span className="mono">{readMin} {T.read}</span>
                {tagsOf(active.body).length > 0 && <span className="truncate">{tagsOf(active.body).map((t) => `#${t}`).join(" ")}</span>}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
