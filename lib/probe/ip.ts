/* ============================================================================
   Multi-source IP + geo resolution.

   Probe never trusts a single provider. It races/fallbacks across several
   public endpoints and the site's own edge function, then reports *which*
   provider actually answered. Each provider returns a different shape, so we
   normalise everything into one `GeoData` record.

   Everything runs client-side. Nothing is persisted.
   ========================================================================== */

import { BASE_PATH } from "@/lib/data";

export type GeoData = {
  ip?: string;
  city?: string;
  region?: string;
  regionCode?: string;
  country?: string;
  cc?: string; // ISO-3166 alpha-2
  isp?: string;
  org?: string;
  asn?: string;
  tz?: string;
  lat?: number;
  lon?: number;
  /** Provider hints when available (some APIs expose these directly). */
  hostingFlag?: boolean;
  proxyFlag?: boolean;
  mobileFlag?: boolean;
  /** Human-readable name of the provider that answered. */
  source?: string;
};

type Provider = {
  id: string;
  url: string;
  /** Parse a provider payload into the normalised shape, or null on miss. */
  parse: (j: any) => GeoData | null;
  /** Whether this provider requires a separate geo lookup (IP-only). */
  ipOnly?: boolean;
};

const num = (v: any): number | undefined => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : undefined;
};

const asn = (v: any): string | undefined => {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return /^as/i.test(s) ? s.toUpperCase() : `AS${s.replace(/[^0-9]/g, "")}`;
};

/**
 * Ordered provider list. The edge endpoint is first (fastest, same-origin,
 * authoritative for the raw IP). Public providers fill in richer geo.
 */
const PROVIDERS: Provider[] = [
  {
    id: "saleh.im edge",
    url: `${BASE_PATH}/api/ip`,
    parse: (j) =>
      j?.ip && j.ip !== "unknown"
        ? {
            ip: j.ip,
            country: j.country || undefined,
            cc: j.countryCode || j.country || undefined,
            source: "saleh.im/api (edge)",
          }
        : null,
  },
  {
    id: "ipwho.is",
    url: "https://ipwho.is/",
    parse: (j) =>
      j?.success !== false && j?.ip
        ? {
            ip: j.ip,
            city: j.city,
            region: j.region,
            regionCode: j.region_code,
            country: j.country,
            cc: j.country_code,
            isp: j.connection?.isp,
            org: j.connection?.org,
            asn: asn(j.connection?.asn),
            tz: j.timezone?.id,
            lat: num(j.latitude),
            lon: num(j.longitude),
            source: "ipwho.is",
          }
        : null,
  },
  {
    id: "ipapi.co",
    url: "https://ipapi.co/json/",
    parse: (j) =>
      j?.ip && !j?.error
        ? {
            ip: j.ip,
            city: j.city,
            region: j.region,
            regionCode: j.region_code,
            country: j.country_name,
            cc: j.country_code,
            isp: j.org,
            org: j.org,
            asn: asn(j.asn),
            tz: j.timezone,
            lat: num(j.latitude),
            lon: num(j.longitude),
            source: "ipapi.co",
          }
        : null,
  },
  {
    id: "geojs.io",
    url: "https://get.geojs.io/v1/ip/geo.json",
    parse: (j) =>
      j?.ip
        ? {
            ip: j.ip,
            city: j.city,
            region: j.region,
            country: j.country,
            cc: j.country_code,
            org: j.organization_name,
            isp: j.organization_name,
            asn: asn(j.asn),
            tz: j.timezone,
            lat: num(j.latitude),
            lon: num(j.longitude),
            source: "geojs.io",
          }
        : null,
  },
  {
    id: "ipify",
    url: "https://api.ipify.org?format=json",
    ipOnly: true,
    parse: (j) => (j?.ip ? { ip: j.ip, source: "ipify.org" } : null),
  },
];

async function fetchJson(url: string, ms = 4500): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A single provider result plus how long it took. */
export type ProviderResult = { id: string; ok: boolean; ms: number; data?: GeoData };

/**
 * Query providers in order until we have a record with real geo (city/cc),
 * merging partial answers as we go. Returns the merged record + a per-provider
 * audit trail so the UI can show exactly which services were consulted.
 */
export async function resolveGeo(): Promise<{ geo: GeoData; trail: ProviderResult[] }> {
  const trail: ProviderResult[] = [];
  let merged: GeoData = {};

  for (const p of PROVIDERS) {
    const t = performance.now();
    const j = await fetchJson(p.url);
    const parsed = j ? p.parse(j) : null;
    const took = Math.round(performance.now() - t);
    trail.push({ id: p.id, ok: !!parsed, ms: took, data: parsed || undefined });

    if (parsed) {
      // Merge: keep the first non-empty value for each field, but always
      // record the richest `source` (a provider that produced a city wins).
      const gainedGeo = !!(parsed.city || parsed.cc);
      merged = {
        ...parsed,
        ...Object.fromEntries(Object.entries(merged).filter(([, v]) => v != null && v !== "")),
      };
      if (gainedGeo && parsed.source) merged.source = parsed.source;

      // Stop once we have IP + a real country/city.
      if (merged.ip && (merged.city || merged.cc)) break;
    }
  }

  return { geo: merged, trail };
}

/* ---------------------------------------------------------------------------
   TLS fingerprint (JA3 / JA4). A browser cannot compute its own ClientHello
   fingerprint, so we ask an echo service that reflects it back. This is
   best-effort: if the service is unreachable or blocks CORS we degrade
   gracefully and the UI simply marks it unavailable.
   ------------------------------------------------------------------------- */

export type TlsFingerprint = {
  ja3?: string;
  ja3Hash?: string;
  ja4?: string;
  ja4Hash?: string;
  http?: string;
  source?: string;
};

const TLS_SOURCES: { id: string; url: string; parse: (j: any) => TlsFingerprint | null }[] = [
  {
    id: "tls.peet.ws",
    url: "https://tls.peet.ws/api/all",
    parse: (j) => {
      const t = j?.tls;
      if (!t) return null;
      return {
        ja3: t.ja3,
        ja3Hash: t.ja3_hash,
        ja4: t.ja4,
        ja4Hash: t.ja4_r ? undefined : t.ja4,
        http: j.http_version,
        source: "tls.peet.ws",
      };
    },
  },
  {
    id: "check.ja3er",
    url: "https://ja3er.com/json",
    parse: (j) =>
      j?.ja3_hash
        ? { ja3: j.ja3, ja3Hash: j.ja3_hash, source: "ja3er.com" }
        : null,
  },
];

export async function resolveTls(): Promise<TlsFingerprint | null> {
  for (const s of TLS_SOURCES) {
    const j = await fetchJson(s.url, 5000);
    if (!j) continue;
    const parsed = s.parse(j);
    if (parsed) return parsed;
  }
  return null;
}
