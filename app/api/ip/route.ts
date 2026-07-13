/**
 * GET /api/ip — the site's own edge endpoint.
 *
 * On Cloudflare Workers the visitor's IP and country arrive as request
 * headers (cf-connecting-ip / cf-ipcountry). Richer geo is resolved
 * client-side from public providers. Nothing is stored or logged.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const h = request.headers;
  const ip =
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const country = h.get("cf-ipcountry") || null;

  const body = {
    ip,
    city: null,
    region: null,
    country,
    countryCode: country,
    timezone: null,
    isp: null,
    asn: null,
    source: "saleh.im/api (edge)",
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}
