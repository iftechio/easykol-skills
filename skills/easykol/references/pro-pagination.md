# Smart Search Pro: One Page per Request

Read this for Smart Search Pro (`mode=7`), continuation of an existing Pro task,
or a request to fetch more than one page of Pro results.

## Capability and rollout boundary

The one-page contract is implemented in backend
[PR #2285](https://github.com/iftechio/talent-marking-backend/pull/2285) and frontend
[PR #844](https://github.com/iftechio/easykol-web/pull/844). A skill update does not
mean these changes are deployed. Verify the configured tool/API contract before use.

The repository's CLI `search` calls synchronous `/intelligent-search`, takes
`--limit` (1–50, default 20), and charges per returned creator. It has no Pro
`sourceTaskId` / `NEXT_PAGE` command. `parse` and `more-words` are previews, not pages.
The separately documented external `/web-search` `searchType=smart` maps to mode 4,
not Pro mode 7; its batch contract must not be substituted for Pro's.

Use Pro only through configured, authorized tooling that exposes that contract.
If only the current CLI is available, explain that it cannot continue the Pro task.
Do not invent CLI flags, send unsupported parameters, borrow browser credentials,
or silently switch endpoints and billing. Offer the Pro UI or a supported tooling
upgrade; do not run another paid CLI search as an undisclosed fallback.

## Pro request invariants

- Initial search and every next page use `mode=7`, `batchCount=1` (or omit it).
  Never send 2/3/5/10, derive a multiplier from keywords/tags, or use a larger batch
  to satisfy a requested total. Pro rejects those multi-batch requests.
- A completed request returns **at most 50** creators, not a guaranteed 50. No fixed
  total page limit is imposed, but inventory, hard filters, quota, and authorization
  still limit how long to continue.
- Initial search preserves the user's description and supported hard filters. Use
  `autoExtract=true` when the configured Pro contract exposes it; do not pad or
  broaden tags/keywords to fill a page. Preserve subject modifiers and exclusions.
  Automatic extraction is not proof that every resulting creator is strictly relevant.
- To continue, preserve platform/project and the exact search context, use
  `reason=NEXT_PAGE` and the latest completed task's `sourceTaskId`. Do not start
  another `SEARCH`, reuse an unrelated project's config, or inherit an old batch
  multiplier. Backend continuation owns candidate exclusion; do not disable it.
- Keep only one page request in flight for a search chain. Wait for completion and
  inspect its results before requesting another page. Polling an existing task does
  not authorize creating another one.
- Where supported, use one idempotency key per logical page. If submission times out,
  recover/check that task or retry the same request with the same key. A new page gets
  a new key. Never generate a fresh key merely to retry an uncertain paid submission.

The Pro API exposes `/api/search/v2/web-search` and a matching `/quote` route.
Use the configured tool's actual schema/authentication, not the external CLI key by
assumption. A compact task-bound continuation has these fields:

```json
{
  "projectId": "<same-project>",
  "platform": "TIKTOK",
  "mode": 7,
  "reason": "NEXT_PAGE",
  "sourceTaskId": "<latest-completed-task>",
  "batchCount": 1,
  "idempotencyKey": "<one-stable-key-for-this-page>"
}
```

## Budget and stopping

One batch is not necessarily one credit. Quote the request using the same context
before submitting; platform and advanced-filter multipliers still apply. Pro batch
billing and the synchronous CLI's per-creator billing are different. Report the
actual settlement, and do not increase batchCount to account for a price multiplier.

“Next batch” authorizes one page, not an endless automatic loop. For an explicitly
authorized multi-page target/budget, proceed sequentially within that authorization;
there is no need to ask again for every page already covered. Stop when the requested
unique count is reached, the authorized spend/page budget is reached, the user stops,
quota is exhausted, or the service reports exhaustion. Stop automatic paging on an
empty page or no new unique creators and explain the result; do not repeatedly pay to
retry the same empty response. A short non-empty page alone does not prove exhaustion.

For a request exceeding 50, explain the required sequential pages and spending plan
before execution. Deduplicate across pages and count only creators whose required
criteria have been verified. A request for 150 does not guarantee 150 matches in three
pages. Never widen the description, split countries, or weaken filters just to fill N.
