/* ============================================================================
   Forge — network & security engine.

   Pure, browser-only helpers for the network/security toolset:
     • a real packet builder + a Wireshark-style layered decoder (Ethernet,
       ARP, IPv4/IPv6, TCP, UDP, ICMP, DNS) with genuine field values and a
       verified IPv4 header checksum,
     • an nmap command builder + flag reference,
     • sandboxed, educational injection analysers (SQLi / XSS / command
       injection) that teach detection and prevention — they never touch a
       real target,
     • an HTTP security-header grader.

   Everything is local and offline. The offensive-looking tools are learning
   simulators for systems you own or are authorised to test.
   ========================================================================== */

/* -------------------------------------------------------------------------- */
/* byte helpers                                                               */
/* -------------------------------------------------------------------------- */

export function hexToBytes(input: string): Uint8Array {
  const clean = input.replace(/0x/gi, "").replace(/[^0-9a-fA-F]/g, "");
  if (clean.length % 2 !== 0) throw new Error("Hex has an odd number of digits.");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}
export function bytesToHex(b: Uint8Array, sep = ""): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(sep);
}
const mac = (b: Uint8Array, o: number) => Array.from(b.subarray(o, o + 6), (x) => x.toString(16).padStart(2, "0")).join(":");
const ipv4 = (b: Uint8Array, o: number) => `${b[o]}.${b[o + 1]}.${b[o + 2]}.${b[o + 3]}`;
const u16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function ipv6(b: Uint8Array, o: number): string {
  const parts: string[] = [];
  for (let i = 0; i < 8; i++) parts.push(u16(b, o + i * 2).toString(16));
  // collapse the longest run of zeroes
  return parts.join(":").replace(/\b(?:0:){2,}0\b/, "::").replace(/^0::/, "::").replace(/::0$/, "::");
}

export function ipv4Checksum(header: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < header.length; i += 2) sum += (header[i] << 8) | (header[i + 1] || 0);
  while (sum >> 16) sum = (sum & 0xffff) + (sum >> 16);
  return (~sum) & 0xffff;
}

/* -------------------------------------------------------------------------- */
/* packet decoder — a layered, field-by-field breakdown                       */
/* -------------------------------------------------------------------------- */

export type PktField = { name: string; value: string; note?: string; bytes?: string };
export type PktLayer = { name: string; summary: string; fields: PktField[] };
export type ParsedPacket = { ok: boolean; error?: string; layers: PktLayer[]; summary: string; length: number };

const ETHERTYPE: Record<number, string> = { 0x0800: "IPv4", 0x0806: "ARP", 0x86dd: "IPv6", 0x8100: "802.1Q VLAN" };
const IP_PROTO: Record<number, string> = { 1: "ICMP", 2: "IGMP", 6: "TCP", 17: "UDP", 41: "IPv6", 47: "GRE", 50: "ESP", 58: "ICMPv6", 89: "OSPF" };
const ICMP_TYPE: Record<number, string> = { 0: "Echo Reply", 3: "Destination Unreachable", 5: "Redirect", 8: "Echo Request", 11: "Time Exceeded" };
export const WELL_KNOWN_PORTS: Record<number, string> = {
  20: "FTP-data", 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS", 67: "DHCP", 68: "DHCP", 69: "TFTP",
  80: "HTTP", 110: "POP3", 123: "NTP", 143: "IMAP", 161: "SNMP", 389: "LDAP", 443: "HTTPS", 445: "SMB",
  465: "SMTPS", 514: "syslog", 587: "SMTP", 993: "IMAPS", 995: "POP3S", 1433: "MSSQL", 1521: "Oracle",
  3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL", 5900: "VNC", 6379: "Redis", 8080: "HTTP-alt", 8443: "HTTPS-alt", 27017: "MongoDB",
};
const portName = (p: number) => (WELL_KNOWN_PORTS[p] ? `${p} (${WELL_KNOWN_PORTS[p]})` : String(p));

export function parsePacket(hexInput: string, start: "eth" | "ip" = "eth"): ParsedPacket {
  let b: Uint8Array;
  try { b = hexToBytes(hexInput); } catch (e) { return { ok: false, error: (e as Error).message, layers: [], summary: "", length: 0 }; }
  if (b.length < 4) return { ok: false, error: "Too short to be a packet.", layers: [], summary: "", length: b.length };

  const layers: PktLayer[] = [];
  let off = 0;
  let etherType = 0x0800;
  const parts: string[] = [];

  try {
    if (start === "eth") {
      if (b.length < 14) throw new Error("Ethernet frame needs ≥ 14 bytes.");
      etherType = u16(b, 12);
      layers.push({
        name: "Ethernet II",
        summary: `${mac(b, 6)} → ${mac(b, 0)}  (${ETHERTYPE[etherType] || "0x" + etherType.toString(16)})`,
        fields: [
          { name: "Destination MAC", value: mac(b, 0), bytes: bytesToHex(b.subarray(0, 6), ":") },
          { name: "Source MAC", value: mac(b, 6), bytes: bytesToHex(b.subarray(6, 12), ":") },
          { name: "EtherType", value: `0x${etherType.toString(16).padStart(4, "0")} · ${ETHERTYPE[etherType] || "unknown"}` },
        ],
      });
      off = 14;
    } else {
      etherType = (b[0] >> 4) === 6 ? 0x86dd : 0x0800;
    }

    if (etherType === 0x0806) { parseArp(b, off, layers, parts); }
    else if (etherType === 0x86dd) { off = parseIpv6(b, off, layers, parts); parseL4(b, off, layers, parts, b[off - 40 + 6]); }
    else { const r = parseIpv4(b, off, layers, parts); if (r) parseL4(b, r.next, layers, parts, r.proto); }
  } catch (e) {
    return { ok: false, error: (e as Error).message, layers, summary: parts.join(" / "), length: b.length };
  }

  return { ok: true, layers, summary: parts.join("  ·  ") || "packet", length: b.length };
}

function parseArp(b: Uint8Array, o: number, layers: PktLayer[], parts: string[]) {
  const oper = u16(b, o + 6);
  const senderMac = mac(b, o + 8), senderIp = ipv4(b, o + 14), targetMac = mac(b, o + 18), targetIp = ipv4(b, o + 24);
  parts.push(oper === 1 ? `ARP who-has ${targetIp}? tell ${senderIp}` : `ARP ${senderIp} is-at ${senderMac}`);
  layers.push({
    name: "ARP",
    summary: oper === 1 ? `Request — who has ${targetIp}?` : `Reply — ${senderIp} is at ${senderMac}`,
    fields: [
      { name: "Hardware type", value: `${u16(b, o)} (Ethernet)` },
      { name: "Protocol type", value: `0x${u16(b, o + 2).toString(16).padStart(4, "0")} (IPv4)` },
      { name: "Operation", value: `${oper} (${oper === 1 ? "request" : "reply"})` },
      { name: "Sender MAC", value: senderMac },
      { name: "Sender IP", value: senderIp },
      { name: "Target MAC", value: targetMac },
      { name: "Target IP", value: targetIp },
    ],
  });
}

function parseIpv4(b: Uint8Array, o: number, layers: PktLayer[], parts: string[]): { next: number; proto: number } | null {
  const ihl = (b[o] & 0x0f) * 4;
  const total = u16(b, o + 2);
  const proto = b[o + 9];
  const ttl = b[o + 8];
  const flags = b[o + 6] >> 5;
  const fragOff = u16(b, o + 6) & 0x1fff;
  const src = ipv4(b, o + 12), dst = ipv4(b, o + 16);
  const csumField = u16(b, o + 10);
  const hdr = b.subarray(o, o + ihl).slice();
  hdr[10] = 0; hdr[11] = 0;
  const csumCalc = ipv4Checksum(hdr);
  parts.push(`IP ${src} → ${dst}`);
  layers.push({
    name: "IPv4",
    summary: `${src} → ${dst}  ttl=${ttl}  ${IP_PROTO[proto] || proto}`,
    fields: [
      { name: "Version / IHL", value: `4 / ${ihl} bytes` },
      { name: "DSCP / ECN", value: `${b[o + 1] >> 2} / ${b[o + 1] & 3}` },
      { name: "Total length", value: `${total} bytes` },
      { name: "Identification", value: `0x${u16(b, o + 4).toString(16).padStart(4, "0")}` },
      { name: "Flags", value: `${(flags & 2) ? "DF " : ""}${(flags & 1) ? "MF" : ""}`.trim() || "none" },
      { name: "Fragment offset", value: String(fragOff) },
      { name: "TTL", value: String(ttl) },
      { name: "Protocol", value: `${proto} (${IP_PROTO[proto] || "?"})` },
      { name: "Header checksum", value: `0x${csumField.toString(16).padStart(4, "0")}`, note: csumField === csumCalc ? "✓ valid" : `✗ expected 0x${csumCalc.toString(16).padStart(4, "0")}` },
      { name: "Source IP", value: src },
      { name: "Destination IP", value: dst },
    ],
  });
  return { next: o + ihl, proto };
}

function parseIpv6(b: Uint8Array, o: number, layers: PktLayer[], parts: string[]): number {
  const next = b[o + 6];
  const src = ipv6(b, o + 8), dst = ipv6(b, o + 24);
  parts.push(`IPv6 ${src} → ${dst}`);
  layers.push({
    name: "IPv6",
    summary: `${src} → ${dst}  ${IP_PROTO[next] || next}`,
    fields: [
      { name: "Version", value: "6" },
      { name: "Traffic class", value: String(((b[o] & 0x0f) << 4) | (b[o + 1] >> 4)) },
      { name: "Payload length", value: `${u16(b, o + 4)} bytes` },
      { name: "Next header", value: `${next} (${IP_PROTO[next] || "?"})` },
      { name: "Hop limit", value: String(b[o + 7]) },
      { name: "Source", value: src },
      { name: "Destination", value: dst },
    ],
  });
  return o + 40;
}

function parseL4(b: Uint8Array, o: number, layers: PktLayer[], parts: string[], proto: number) {
  if (proto === 6) parseTcp(b, o, layers, parts);
  else if (proto === 17) parseUdp(b, o, layers, parts);
  else if (proto === 1) parseIcmp(b, o, layers, parts);
}

function parseTcp(b: Uint8Array, o: number, layers: PktLayer[], parts: string[]) {
  const sport = u16(b, o), dport = u16(b, o + 2);
  const seq = u32(b, o + 4), ack = u32(b, o + 8);
  const dataOff = (b[o + 12] >> 4) * 4;
  const fl = b[o + 13];
  const names = ["FIN", "SYN", "RST", "PSH", "ACK", "URG", "ECE", "CWR"];
  const set = names.filter((_, i) => fl & (1 << i));
  parts.push(`TCP ${sport} → ${dport} [${set.join(",") || "none"}]`);
  layers.push({
    name: "TCP",
    summary: `${portName(sport)} → ${portName(dport)}  [${set.join(", ")}]  seq=${seq}`,
    fields: [
      { name: "Source port", value: portName(sport) },
      { name: "Destination port", value: portName(dport) },
      { name: "Sequence number", value: String(seq) },
      { name: "Acknowledgment", value: String(ack) },
      { name: "Data offset", value: `${dataOff} bytes` },
      { name: "Flags", value: `0x${fl.toString(16).padStart(2, "0")} · ${set.join(", ") || "none"}` },
      { name: "Window size", value: String(u16(b, o + 14)) },
      { name: "Checksum", value: `0x${u16(b, o + 16).toString(16).padStart(4, "0")}` },
    ],
  });
  parsePayload(b, o + dataOff, layers, parts, sport, dport);
}

function parseUdp(b: Uint8Array, o: number, layers: PktLayer[], parts: string[]) {
  const sport = u16(b, o), dport = u16(b, o + 2);
  parts.push(`UDP ${sport} → ${dport}`);
  layers.push({
    name: "UDP",
    summary: `${portName(sport)} → ${portName(dport)}  len=${u16(b, o + 4)}`,
    fields: [
      { name: "Source port", value: portName(sport) },
      { name: "Destination port", value: portName(dport) },
      { name: "Length", value: `${u16(b, o + 4)} bytes` },
      { name: "Checksum", value: `0x${u16(b, o + 6).toString(16).padStart(4, "0")}` },
    ],
  });
  if (sport === 53 || dport === 53) parseDns(b, o + 8, layers, parts);
  else parsePayload(b, o + 8, layers, parts, sport, dport);
}

function parseIcmp(b: Uint8Array, o: number, layers: PktLayer[], parts: string[]) {
  const type = b[o], code = b[o + 1];
  parts.push(`ICMP ${ICMP_TYPE[type] || type}`);
  layers.push({
    name: "ICMP",
    summary: `${ICMP_TYPE[type] || "type " + type}  (type ${type}, code ${code})`,
    fields: [
      { name: "Type", value: `${type} (${ICMP_TYPE[type] || "?"})` },
      { name: "Code", value: String(code) },
      { name: "Checksum", value: `0x${u16(b, o + 2).toString(16).padStart(4, "0")}` },
      ...(type === 8 || type === 0 ? [{ name: "Identifier", value: String(u16(b, o + 4)) }, { name: "Sequence", value: String(u16(b, o + 6)) }] : []),
    ],
  });
}

function parseDns(b: Uint8Array, o: number, layers: PktLayer[], parts: string[]) {
  const id = u16(b, o), flags = u16(b, o + 2);
  const qd = u16(b, o + 4), an = u16(b, o + 6);
  const qr = flags >> 15;
  // read the first question name
  let p = o + 12, name = "", guard = 0;
  while (b[p] !== 0 && p < b.length && guard++ < 64) { const len = b[p]; name += new TextDecoder().decode(b.subarray(p + 1, p + 1 + len)) + "."; p += len + 1; }
  name = name.replace(/\.$/, "") || "(root)";
  const qtype = u16(b, p + 1);
  const QT: Record<number, string> = { 1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 12: "PTR", 15: "MX", 16: "TXT", 28: "AAAA", 33: "SRV" };
  parts.push(`DNS ${qr ? "response" : "query"} ${name} ${QT[qtype] || ""}`.trim());
  layers.push({
    name: "DNS",
    summary: `${qr ? "Response" : "Query"} · ${name} · ${QT[qtype] || "type " + qtype}`,
    fields: [
      { name: "Transaction ID", value: `0x${id.toString(16).padStart(4, "0")}` },
      { name: "Flags", value: `0x${flags.toString(16).padStart(4, "0")} (${qr ? "response" : "query"})` },
      { name: "Questions", value: String(qd) },
      { name: "Answer RRs", value: String(an) },
      { name: "Query name", value: name },
      { name: "Query type", value: `${QT[qtype] || qtype}` },
    ],
  });
}

function parsePayload(b: Uint8Array, o: number, layers: PktLayer[], parts: string[], sport: number, dport: number) {
  if (o >= b.length) return;
  const payload = b.subarray(o);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(payload);
  const printable = text.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, ".");
  const isHttp = /^(GET|POST|PUT|DELETE|HEAD|HTTP\/)/.test(text);
  layers.push({
    name: isHttp ? "HTTP" : "Payload",
    summary: isHttp ? printable.split("\r\n")[0] : `${payload.length} bytes`,
    fields: [
      { name: "Length", value: `${payload.length} bytes` },
      { name: "ASCII", value: printable.slice(0, 600) },
      { name: "Hex", value: bytesToHex(payload.subarray(0, 96), " ") + (payload.length > 96 ? " …" : "") },
    ],
  });
  if (isHttp) parts.push(printable.split("\r\n")[0]);
}

/* -------------------------------------------------------------------------- */
/* packet builders — produce genuine, internally-consistent frames            */
/* -------------------------------------------------------------------------- */

function ethFrame(dstMac: number[], srcMac: number[], etherType: number, payload: number[]): number[] {
  return [...dstMac, ...srcMac, (etherType >> 8) & 0xff, etherType & 0xff, ...payload];
}
function macBytes(m: string): number[] { return m.split(":").map((x) => parseInt(x, 16)); }
function ipBytes(ip: string): number[] { return ip.split(".").map(Number); }
function be16(n: number): number[] { return [(n >> 8) & 0xff, n & 0xff]; }
function be32(n: number): number[] { return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]; }

function ipv4Header(proto: number, src: string, dst: string, payloadLen: number, id = 0x1c46, ttl = 64): number[] {
  const total = 20 + payloadLen;
  const h = [0x45, 0x00, ...be16(total), ...be16(id), 0x40, 0x00, ttl, proto, 0x00, 0x00, ...ipBytes(src), ...ipBytes(dst)];
  const csum = ipv4Checksum(Uint8Array.from(h));
  h[10] = (csum >> 8) & 0xff; h[11] = csum & 0xff;
  return h;
}

const DEMO_SRC_MAC = "00:1b:44:11:3a:b7";
const DEMO_DST_MAC = "3c:5a:b4:0e:99:21";

export function buildIcmpEcho(src = "192.168.1.24", dst = "8.8.8.8", seq = 1): string {
  const icmp = [0x08, 0x00, 0x00, 0x00, ...be16(0x1a2b), ...be16(seq), ...Array.from("abcdefghijklmnopqrstuvwabcdefghi", (c) => c.charCodeAt(0))];
  // icmp checksum
  let s = 0; for (let i = 0; i < icmp.length; i += 2) s += (icmp[i] << 8) | (icmp[i + 1] || 0);
  while (s >> 16) s = (s & 0xffff) + (s >> 16); s = (~s) & 0xffff;
  icmp[2] = (s >> 8) & 0xff; icmp[3] = s & 0xff;
  const ip = ipv4Header(1, src, dst, icmp.length);
  return bytesToHex(Uint8Array.from(ethFrame(macBytes(DEMO_DST_MAC), macBytes(DEMO_SRC_MAC), 0x0800, [...ip, ...icmp])), " ");
}

export function buildDnsQuery(domain = "example.com", src = "192.168.1.24", dst = "8.8.8.8"): string {
  const labels: number[] = [];
  for (const part of domain.split(".")) { labels.push(part.length, ...Array.from(part, (c) => c.charCodeAt(0))); }
  labels.push(0);
  const dns = [...be16(0x8f2a), ...be16(0x0100), ...be16(1), ...be16(0), ...be16(0), ...be16(0), ...labels, ...be16(1), ...be16(1)];
  const udp = [...be16(54321), ...be16(53), ...be16(8 + dns.length), 0x00, 0x00, ...dns];
  const ip = ipv4Header(17, src, dst, udp.length);
  return bytesToHex(Uint8Array.from(ethFrame(macBytes(DEMO_DST_MAC), macBytes(DEMO_SRC_MAC), 0x0800, [...ip, ...udp])), " ");
}

export function buildTcpSyn(src = "192.168.1.24", dst = "93.184.216.34", dport = 443, seq = 0xdead1234): string {
  const tcp = [...be16(51000), ...be16(dport), ...be32(seq), ...be32(0), 0x50 + 0x02 * 0, 0x02, ...be16(64240), 0x00, 0x00, 0x00, 0x00];
  const ip = ipv4Header(6, src, dst, tcp.length);
  return bytesToHex(Uint8Array.from(ethFrame(macBytes(DEMO_DST_MAC), macBytes(DEMO_SRC_MAC), 0x0800, [...ip, ...tcp])), " ");
}

export function buildHttpGet(host = "saleh.im", path = "/", src = "192.168.1.24", dst = "93.184.216.34"): string {
  const req = `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nUser-Agent: forge/1.0\r\nAccept: */*\r\n\r\n`;
  const body = Array.from(req, (c) => c.charCodeAt(0));
  const tcp = [...be16(51001), ...be16(80), ...be32(0xdead1300), ...be32(0x11223344), 0x50, 0x18, ...be16(64240), 0x00, 0x00, 0x00, 0x00, ...body];
  const ip = ipv4Header(6, src, dst, tcp.length);
  return bytesToHex(Uint8Array.from(ethFrame(macBytes(DEMO_DST_MAC), macBytes(DEMO_SRC_MAC), 0x0800, [...ip, ...tcp])), " ");
}

export function buildArp(sender = "192.168.1.24", target = "192.168.1.1"): string {
  const arp = [...be16(1), ...be16(0x0800), 6, 4, ...be16(1), ...macBytes(DEMO_SRC_MAC), ...ipBytes(sender), 0, 0, 0, 0, 0, 0, ...ipBytes(target)];
  return bytesToHex(Uint8Array.from(ethFrame(macBytes("ff:ff:ff:ff:ff:ff"), macBytes(DEMO_SRC_MAC), 0x0806, arp)), " ");
}

export const SAMPLE_PACKETS: { id: string; label: string; hex: string }[] = [
  { id: "dns", label: "DNS query · example.com", hex: buildDnsQuery() },
  { id: "syn", label: "TCP SYN · :443", hex: buildTcpSyn() },
  { id: "http", label: "HTTP GET · saleh.im", hex: buildHttpGet() },
  { id: "icmp", label: "ICMP echo (ping)", hex: buildIcmpEcho() },
  { id: "arp", label: "ARP who-has", hex: buildArp() },
];

/* -------------------------------------------------------------------------- */
/* live-capture demo — a realistic stream of tcpdump-style rows               */
/* -------------------------------------------------------------------------- */

export type CaptureRow = { no: number; time: string; src: string; dst: string; proto: string; length: number; info: string; hex: string };

const RNET = () => `192.168.1.${10 + Math.floor(Math.random() * 200)}`;
const rpick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function genCaptureRow(no: number, t0: number): CaptureRow {
  const kind = rpick(["dns", "syn", "http", "icmp", "arp", "https", "ack"]);
  const local = RNET();
  const time = ((Date.now() - t0) / 1000).toFixed(6);
  const hosts = ["93.184.216.34", "142.250.185.14", "8.8.8.8", "1.1.1.1", "140.82.121.4"];
  const remote = rpick(hosts);
  switch (kind) {
    case "dns": { const d = rpick(["github.com", "google.com", "cloudflare.com", "example.com", "saleh.im"]); return { no, time, src: local, dst: "8.8.8.8", proto: "DNS", length: 74 + d.length, info: `Standard query A ${d}`, hex: buildDnsQuery(d, local, "8.8.8.8") }; }
    case "syn": return { no, time, src: local, dst: remote, proto: "TCP", length: 74, info: `51000 → 443 [SYN] Seq=0 Win=64240`, hex: buildTcpSyn(local, remote, 443) };
    case "https": return { no, time, src: local, dst: remote, proto: "TCP", length: 66, info: `50xyz → 443 [SYN] Win=64240 MSS=1460`, hex: buildTcpSyn(local, remote, 443, (Math.random() * 0xffffffff) >>> 0) };
    case "http": return { no, time, src: local, dst: remote, proto: "HTTP", length: 140, info: `GET / HTTP/1.1 Host: saleh.im`, hex: buildHttpGet("saleh.im", "/", local, remote) };
    case "icmp": return { no, time, src: local, dst: "8.8.8.8", proto: "ICMP", length: 98, info: `Echo (ping) request id=0x1a2b seq=${no}`, hex: buildIcmpEcho(local, "8.8.8.8", no) };
    case "ack": return { no, time, src: remote, dst: local, proto: "TCP", length: 66, info: `443 → 51000 [SYN, ACK] Seq=0 Ack=1`, hex: buildTcpSyn(remote, local, 51000) };
    default: return { no, time, src: local, dst: "192.168.1.1", proto: "ARP", length: 42, info: `Who has 192.168.1.1? Tell ${local}`, hex: buildArp(local, "192.168.1.1") };
  }
}

/* -------------------------------------------------------------------------- */
/* nmap command builder + reference                                           */
/* -------------------------------------------------------------------------- */

export type NmapOpts = {
  target: string;
  ports: string; // "" | "top" | "1-65535" | "22,80,443"
  scan: "syn" | "connect" | "udp" | "ping" | "ack";
  service: boolean;
  os: boolean;
  scripts: "none" | "default" | "vuln";
  timing: number; // 0..5
  noPing: boolean;
  verbose: boolean;
};

export function buildNmap(o: NmapOpts): string {
  const p: string[] = ["nmap"];
  if (o.scan === "syn") p.push("-sS");
  else if (o.scan === "connect") p.push("-sT");
  else if (o.scan === "udp") p.push("-sU");
  else if (o.scan === "ping") p.push("-sn");
  else if (o.scan === "ack") p.push("-sA");
  if (o.service) p.push("-sV");
  if (o.os) p.push("-O");
  if (o.scripts === "default") p.push("-sC");
  else if (o.scripts === "vuln") p.push("--script vuln");
  if (o.ports === "top") p.push("--top-ports 100");
  else if (o.ports) p.push(`-p ${o.ports}`);
  if (o.noPing) p.push("-Pn");
  p.push(`-T${o.timing}`);
  if (o.verbose) p.push("-v");
  p.push(o.target || "TARGET");
  return p.join(" ");
}

export const NMAP_FLAGS: { flag: string; desc: string }[] = [
  { flag: "-sS", desc: "TCP SYN (half-open) scan — fast, stealthy; needs root." },
  { flag: "-sT", desc: "TCP connect scan — full 3-way handshake; no root needed." },
  { flag: "-sU", desc: "UDP scan — slow; finds DNS, SNMP, DHCP, etc." },
  { flag: "-sn", desc: "Ping sweep — host discovery only, no port scan." },
  { flag: "-Pn", desc: "Skip host discovery — treat every host as online." },
  { flag: "-sV", desc: "Service/version detection on open ports." },
  { flag: "-O", desc: "OS fingerprinting via TCP/IP stack quirks." },
  { flag: "-sC", desc: "Run the default NSE script set." },
  { flag: "--script vuln", desc: "Run vulnerability-detection NSE scripts." },
  { flag: "-p", desc: "Port spec: -p22,80,443 · -p1-1000 · -p- (all 65535)." },
  { flag: "-T0…-T5", desc: "Timing template — paranoid → insane. -T4 is a good default." },
  { flag: "-A", desc: "Aggressive: -sV -O -sC --traceroute in one." },
  { flag: "-oN / -oX / -oG", desc: "Save output as normal / XML / grepable." },
];

export const NMAP_PRESETS: { id: string; label: string; opts: Partial<NmapOpts> }[] = [
  { id: "quick", label: "Quick top-100", opts: { scan: "syn", ports: "top", timing: 4 } },
  { id: "full", label: "Full TCP + version", opts: { scan: "syn", ports: "1-65535", service: true, timing: 4 } },
  { id: "discover", label: "Host discovery (ping sweep)", opts: { scan: "ping", ports: "", timing: 4 } },
  { id: "aggressive", label: "Aggressive + scripts", opts: { scan: "syn", ports: "top", service: true, os: true, scripts: "default", timing: 4 } },
  { id: "vuln", label: "Vulnerability scan", opts: { scan: "syn", ports: "top", service: true, scripts: "vuln", timing: 4 } },
];

/* -------------------------------------------------------------------------- */
/* SQL injection lab — a sandboxed simulator (no real database)               */
/* -------------------------------------------------------------------------- */

export type SqliResult = {
  vulnerableQuery: string;
  safeQuery: string;
  bypassed: boolean;
  reason: string;
  detected: { payload: string; kind: string }[];
};

const SQLI_SIGNS: { re: RegExp; kind: string }[] = [
  { re: /('|").*(\bOR\b|\bAND\b).*(=|\blike\b)/i, kind: "Boolean / tautology (OR 1=1)" },
  { re: /--|#|\/\*/, kind: "Comment truncation (-- , #, /*)" },
  { re: /\bUNION\b\s+\bSELECT\b/i, kind: "UNION-based extraction" },
  { re: /;\s*(drop|delete|update|insert|alter)\b/i, kind: "Stacked / destructive query" },
  { re: /\bsleep\s*\(|\bbenchmark\s*\(|waitfor\s+delay/i, kind: "Time-based blind" },
  { re: /\b(information_schema|sysobjects|pg_tables)\b/i, kind: "Schema enumeration" },
];

export function analyzeSqli(username: string, password: string): SqliResult {
  const vulnerableQuery = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}';`;
  const safeQuery = `SELECT * FROM users WHERE username = ? AND password = ?;\n-- params: [${JSON.stringify(username)}, ${JSON.stringify(password)}]`;

  const detected: { payload: string; kind: string }[] = [];
  for (const val of [username, password]) {
    for (const s of SQLI_SIGNS) if (s.re.test(val)) detected.push({ payload: val, kind: s.kind });
  }

  // naive simulation of a tautology / comment auth-bypass
  const tautology = /('|")?\s*(\bor\b)\s+('?\d+'?|'.'|true)\s*=\s*\2?\s*('?\d+'?|'.'|true)/i.test(username) || /'\s*or\s*'?1'?\s*=\s*'?1/i.test(username);
  const commented = /('.*--|'.*#|'\s*\/\*)/.test(username);
  const bypassed = tautology || commented;

  return {
    vulnerableQuery,
    safeQuery,
    bypassed,
    reason: bypassed
      ? "The injected quote closes the string and the OR/comment makes the WHERE clause always true — the DB returns the first user (often the admin) without a valid password."
      : detected.length
        ? "Injection characters detected. Against a string-concatenated query these can alter its logic."
        : "No injection markers. But string concatenation is still unsafe — always use parameterised queries.",
    detected,
  };
}

export const SQLI_PAYLOADS: { p: string; note: string }[] = [
  { p: "' OR '1'='1", note: "Classic tautology — makes WHERE always true." },
  { p: "' OR 1=1 -- ", note: "Tautology + comment out the rest of the query." },
  { p: "admin'-- ", note: "Log in as 'admin', comment out the password check." },
  { p: "' UNION SELECT username, password FROM users -- ", note: "UNION exfiltration of another table." },
  { p: "'; DROP TABLE users; -- ", note: "Stacked query (destructive) — needs multi-statement." },
  { p: "' AND SLEEP(5) -- ", note: "Time-based blind — infer data from response delay." },
];

/* -------------------------------------------------------------------------- */
/* XSS analyser + escaper                                                     */
/* -------------------------------------------------------------------------- */

export function analyzeXss(input: string): { vectors: string[]; escaped: string; jsEscaped: string; attrSafe: boolean } {
  const vectors: string[] = [];
  if (/<script\b/i.test(input)) vectors.push("<script> tag injection");
  if (/on\w+\s*=/i.test(input)) vectors.push("Inline event handler (onerror/onload…)");
  if (/javascript:/i.test(input)) vectors.push("javascript: URI");
  if (/<img\b[^>]*\bonerror/i.test(input)) vectors.push("<img onerror> payload");
  if (/<svg\b|<iframe\b|<object\b/i.test(input)) vectors.push("Dangerous element (svg/iframe/object)");
  if (/&#x?\d+/i.test(input)) vectors.push("HTML-entity / numeric encoding evasion");
  const escaped = input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const jsEscaped = JSON.stringify(input);
  const attrSafe = !/["'`<>]/.test(input);
  return { vectors, escaped, jsEscaped, attrSafe };
}

export const XSS_PAYLOADS: { p: string; note: string }[] = [
  { p: "<script>alert(1)</script>", note: "Basic reflected/stored XSS." },
  { p: "<img src=x onerror=alert(1)>", note: "Fires when the image fails to load." },
  { p: "\"><svg onload=alert(1)>", note: "Breaks out of an attribute, then injects." },
  { p: "javascript:alert(1)", note: "Payload in an href/src URI." },
  { p: "<body onpageshow=alert(1)>", note: "Event handler on a structural element." },
];

/* -------------------------------------------------------------------------- */
/* command-injection analyser                                                 */
/* -------------------------------------------------------------------------- */

export function analyzeCmdInjection(input: string): { risky: boolean; hits: { token: string; desc: string }[]; safe: string } {
  const tokens: { re: RegExp; token: string; desc: string }[] = [
    { re: /;/, token: ";", desc: "Command separator — runs a second command." },
    { re: /&&|\|\|/, token: "&& / ||", desc: "Conditional chaining of commands." },
    { re: /\|/, token: "|", desc: "Pipe — feed output into another command." },
    { re: /`[^`]*`|\$\([^)]*\)/, token: "$( ) / ``", desc: "Command substitution." },
    { re: />|>>|</, token: "> < >>", desc: "Redirection — write/read arbitrary files." },
    { re: /\n|\r/, token: "newline", desc: "Newline can start a new command." },
    { re: /\$\{?\w+\}?/, token: "$VAR", desc: "Variable expansion." },
  ];
  const hits = tokens.filter((t) => t.re.test(input)).map(({ token, desc }) => ({ token, desc }));
  return {
    risky: hits.length > 0,
    hits,
    safe: `execFile("ping", ["-c", "1", ${JSON.stringify(input.replace(/[^\w.\-]/g, ""))}])  // args array — no shell, metacharacters are inert`,
  };
}

/* -------------------------------------------------------------------------- */
/* HTTP security-header grader                                                */
/* -------------------------------------------------------------------------- */

export type HeaderCheck = { name: string; present: boolean; value?: string; advice: string; weight: number };

export function gradeSecurityHeaders(raw: string): { checks: HeaderCheck[]; score: number; grade: string } {
  const map = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) { const i = line.indexOf(":"); if (i > 0) map.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()); }
  const def: { name: string; key: string; advice: string; weight: number }[] = [
    { name: "Strict-Transport-Security", key: "strict-transport-security", advice: "Force HTTPS: max-age=63072000; includeSubDomains; preload", weight: 20 },
    { name: "Content-Security-Policy", key: "content-security-policy", advice: "The strongest XSS defence — start with default-src 'self'", weight: 25 },
    { name: "X-Content-Type-Options", key: "x-content-type-options", advice: "Set 'nosniff' to stop MIME sniffing", weight: 10 },
    { name: "X-Frame-Options", key: "x-frame-options", advice: "DENY or SAMEORIGIN to prevent clickjacking (or use CSP frame-ancestors)", weight: 15 },
    { name: "Referrer-Policy", key: "referrer-policy", advice: "strict-origin-when-cross-origin limits referrer leakage", weight: 10 },
    { name: "Permissions-Policy", key: "permissions-policy", advice: "Lock down camera/mic/geolocation features", weight: 10 },
    { name: "Cross-Origin-Opener-Policy", key: "cross-origin-opener-policy", advice: "same-origin isolates your browsing context", weight: 10 },
  ];
  let score = 0;
  const checks: HeaderCheck[] = def.map((d) => {
    const present = map.has(d.key);
    if (present) score += d.weight;
    return { name: d.name, present, value: map.get(d.key), advice: d.advice, weight: d.weight };
  });
  const grade = score >= 90 ? "A+" : score >= 75 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : score >= 20 ? "D" : "F";
  return { checks, score, grade };
}

/* -------------------------------------------------------------------------- */
/* Linux cheatsheets + payload references (educational)                       */
/* -------------------------------------------------------------------------- */

export const LINUX_CHEATS: { tool: string; note: string; cmds: { c: string; d: string }[] }[] = [
  {
    tool: "nmap", note: "Port & service discovery (install: sudo apt install nmap).",
    cmds: [
      { c: "nmap -sS -T4 192.168.1.0/24", d: "SYN scan a whole /24 subnet." },
      { c: "nmap -sV -p- 10.0.0.5", d: "Version-detect every one of the 65535 ports." },
      { c: "sudo nmap -O 10.0.0.5", d: "OS fingerprint (needs root)." },
      { c: "nmap -sn 192.168.1.0/24", d: "Ping sweep — just find live hosts." },
      { c: "nmap --script vuln 10.0.0.5", d: "Run vulnerability NSE scripts." },
    ],
  },
  {
    tool: "tcpdump", note: "CLI packet capture (install: sudo apt install tcpdump).",
    cmds: [
      { c: "sudo tcpdump -i eth0 -nn", d: "Capture on eth0, no name resolution." },
      { c: "sudo tcpdump -i any port 53", d: "Only DNS traffic on any interface." },
      { c: "sudo tcpdump -i eth0 -w cap.pcap", d: "Write raw packets to a file for Wireshark." },
      { c: "sudo tcpdump 'tcp[tcpflags] & tcp-syn != 0'", d: "Only TCP SYN packets (BPF filter)." },
      { c: "sudo tcpdump -A port 80", d: "Print HTTP payloads as ASCII." },
    ],
  },
  {
    tool: "wireshark / tshark", note: "GUI + CLI analyser (install: sudo apt install wireshark tshark).",
    cmds: [
      { c: "tshark -i eth0 -f 'port 443'", d: "Live capture with a capture filter." },
      { c: "tshark -r cap.pcap -Y 'http.request'", d: "Read a file, display-filter HTTP requests." },
      { c: "tshark -q -z io,stat,1", d: "Per-second traffic statistics." },
      { c: "Wireshark filter: ip.addr==10.0.0.5 && tcp.flags.syn==1", d: "Display filter syntax." },
    ],
  },
  {
    tool: "netcat / socat", note: "Swiss-army networking (install: sudo apt install netcat-openbsd socat).",
    cmds: [
      { c: "nc -vz 10.0.0.5 22", d: "Check if a single TCP port is open." },
      { c: "nc -lvnp 4444", d: "Listen on a port (a lab listener)." },
      { c: "nc 10.0.0.5 80 <<< 'GET / HTTP/1.0\\r\\n'", d: "Hand-craft an HTTP request." },
      { c: "socat TCP-LISTEN:8080,fork TCP:10.0.0.5:80", d: "TCP port forward / relay." },
    ],
  },
];
