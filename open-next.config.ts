import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Minimal Cloudflare config. Static assets are served directly from the
// Workers assets binding (see wrangler.jsonc); dynamic routes run on the edge.
export default defineCloudflareConfig();
