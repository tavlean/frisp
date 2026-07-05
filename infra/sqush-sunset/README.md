# sqush-sunset — old-domain sunset Worker

Cloudflare Worker on the **sqush.app** zone. Serves a self-destructing service
worker at `/service-worker.js` (frees offline-first visitors pinned to the old
cached app — see the comment in `worker.js` for why a plain 301 can't) and
301-redirects every other path to the same path on **frisp.app**.

## Deploy

```
npx wrangler deploy -c infra/sqush-sunset/wrangler.jsonc
```

**Prerequisite:** the zone's Single Redirect Rule (sqush.app → frisp.app) must
be turned OFF in the Cloudflare dashboard — redirect rules run before Workers,
so while the rule is on this Worker never sees a request. The Worker replaces
the rule entirely (it does the redirecting itself).

## Decommission

Keep deployed for ~a year after the 2026-07-05 rename, then delete the Worker
and the zone. Context: `docs/presk-rename-runbook.md`.
