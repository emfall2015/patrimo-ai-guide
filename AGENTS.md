<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture decisions

- Analysis logic lives in `src/lib/patrimoine.service.ts` behind a single entry point
  (`analyserSituation`), with the contract types in `src/lib/analysis.types.ts`.
  Today the service is local/mock; when Supabase + an external AI API are connected,
  only the service body changes (persist input via createServerFn, call the AI API
  server-side with env keys) — components must never call APIs directly.
- Outbound HTTP to n8n goes through `src/lib/webhook.functions.ts` (a `createServerFn`
  that POSTs the JSON payload and returns `{ ok, statut, message }`). Why: the n8n
  webhook sends no CORS headers, so a browser-side `fetch` would be blocked; the
  server fetch is not subject to CORS. Components only read the returned status.
