# EasyKOL External API Reference

Base URL: `https://app.easykol.com/external/v1`

---

## Authentication

Every request requires two headers:

```
ek-api-key: ek_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ek-api-email: you@example.com
```

Generate your API Key at [app.easykol.com/settings/quotaQuery](https://app.easykol.com/settings/quotaQuery).  
`ek-api-email` must match the email address bound to the key.

---

## Response Format

All endpoints return the same envelope:

**Success**
```json
{
  "statusCode": 1000,
  "error": null,
  "message": "Request was successful",
  "data": { ... }
}
```

**Failure**
```json
{
  "statusCode": 1450,
  "error": "VALIDATION_ERROR",
  "message": "body/platform must be one of TIKTOK, YOUTUBE, INSTAGRAM",
  "data": null
}
```

| statusCode | Meaning |
|-----------|---------|
| 1000 | Success |
| 1401 | Unauthenticated — missing or invalid key / email |
| 1403 | Forbidden — quota exhausted or key inactive |
| 1429 | Rate limited |
| 1450 | Validation error — bad request parameters |
| other | Internal server error |

---

## GET /quota

Returns the current account's quota usage. Use this before running searches to confirm you have sufficient credits.

**Quota cost:** 1 per call  
**Rate limit:** 120 req/min

**Request:** no body

**Response `data`:**
```json
{
  "total": 10000,
  "used": 1234,
  "remaining": 8766,
  "dailyUsed": 50,
  "dailyLimit": 10000
}
```

| Field | Type | Description |
|-------|------|-------------|
| total | number | Total quota on the account |
| used | number | Cumulative quota consumed |
| remaining | number | Available quota (= total − used, minimum 0) |
| dailyUsed | number | Quota consumed today |
| dailyLimit | number | Daily cap |

**Example:**
```bash
curl https://app.easykol.com/external/v1/quota \
  -H "ek-api-key: ek_xxx" \
  -H "ek-api-email: you@example.com"
```

---

## POST /intelligent-search/parse

Parses a natural-language description into canonical tags and keywords, with per-tag/keyword creator counts and an estimated total.

> **Note:** `/intelligent-search` runs this step automatically. Call `/parse` directly only when you need to inspect or override the intermediate tags/keywords.

**Quota cost:** 1 per call  
**Rate limit:** 30 req/min

**Request body:**
```json
{
  "sentence": "skincare creators on Instagram in the US with 100k+ followers",
  "platform": "INSTAGRAM",
  "regions": ["US"],
  "languages": ["en"],
  "minSubscribers": 100000,
  "maxSubscribers": 1000000,
  "avgMin": 1000,
  "avgMax": 50000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sentence | string | ✅ | Natural-language description, 1–500 chars |
| platform | string | ✅ | `TIKTOK` / `YOUTUBE` / `INSTAGRAM` |
| regions | string[] | — | ISO Alpha-2 country codes, e.g. `["US","GB"]` |
| languages | string[] | — | BCP-47 language codes, e.g. `["en","zh"]` |
| minSubscribers | number | — | Minimum follower count |
| maxSubscribers | number | — | Maximum follower count |
| avgMin | number | — | Min avg views (TikTok/YouTube) or avg likes (Instagram) |
| avgMax | number | — | Max avg views (TikTok/YouTube) or avg likes (Instagram) |

**Response `data`:**
```json
{
  "canonicalTags": [
    { "name": "Skincare", "count": 3010 },
    { "name": "Beauty Influencer", "count": 3292 }
  ],
  "keywords": [
    { "name": "skincare routine", "count": 420, "source": "ai" },
    { "name": "skincare", "count": 890, "source": "verbatim" }
  ],
  "estimatedTotal": 1000
}
```

| Field | Description |
|-------|-------------|
| canonicalTags[].name | Tag name — pass directly to `/intelligent-search` as `canonicalTags` |
| canonicalTags[].count | Creator count for this tag under current filters |
| keywords[].name | Keyword — pass directly to `/intelligent-search` as `keywords` |
| keywords[].count | Creator count for this keyword under current filters |
| keywords[].source | `verbatim` = extracted from sentence; `ai` = AI-expanded |
| estimatedTotal | Estimated total creators matching all tags + keywords + filters |

---

## POST /intelligent-search/more-words

Suggests additional keywords based on the original description, excluding ones already shown.

> **Note:** `/intelligent-search` triggers this automatically when results fall short of `limit`. Call it directly only for debugging or custom keyword expansion.

**Quota cost:** free  
**Rate limit:** 30 req/min

**Request body:**
```json
{
  "sentence": "skincare creators on Instagram",
  "platform": "INSTAGRAM",
  "exclude": ["skincare routine", "skincare"],
  "regions": ["US"],
  "languages": ["en"],
  "minSubscribers": 100000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sentence | string | ✅ | Original search description |
| platform | string | ✅ | `TIKTOK` / `YOUTUBE` / `INSTAGRAM` |
| exclude | string[] | ✅ | Keywords already shown — pass `[]` if none |
| regions | string[] | — | Same as `/parse` |
| languages | string[] | — | Same as `/parse` |
| minSubscribers | number | — | Same as `/parse` |
| maxSubscribers | number | — | Same as `/parse` |
| avgMin | number | — | Same as `/parse` |
| avgMax | number | — | Same as `/parse` |

**Response `data`:**
```json
{
  "keywords": [
    { "name": "anti-aging", "count": 215 },
    { "name": "glass skin", "count": 88 }
  ]
}
```

---

## POST /intelligent-search

Executes the KOL search and returns a list of matching creators.

**Quota cost:** N credits for N creators returned; 0 results = no charge  
**Rate limit:** 10 req/min

**Request body:**
```json
{
  "sentence": "skincare creators on Instagram",
  "platform": "INSTAGRAM",
  "regions": ["US", "GB"],
  "minSubscribers": 100000,
  "avgMin": 1000,
  "limit": 20,
  "languages": ["en"],
  "maxSubscribers": 1000000,
  "avgMax": 50000,
  "hasContactInfo": true,
  "gender": "female",
  "dedupDays": 3
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sentence | string | ✅ | Natural-language description, 1–500 chars |
| platform | string | ✅ | `TIKTOK` / `YOUTUBE` / `INSTAGRAM` |
| regions | string[] | ✅ | ISO Alpha-2 country codes, at least one required, e.g. `["US","GB"]` |
| minSubscribers | number | ✅ | Minimum follower count |
| avgMin | number | ✅ | Min avg views (TikTok/YouTube) or avg likes (Instagram) |
| limit | integer | — | Number of results, 1–50, default 20 |
| canonicalTags | string[] | — | Tag names from `/parse` response — improves precision |
| keywords | string[] | — | Keywords from `/parse` or `/more-words` — improves precision |
| languages | string[] | — | BCP-47 language codes |
| maxSubscribers | number | — | Maximum follower count |
| avgMax | number | — | Max avg views (TikTok/YouTube) or avg likes (Instagram) |
| hasContactInfo | boolean | — | `true` = only return creators with a contact email |
| gender | string | — | `male` / `female` |
| dedupDays | integer | — | Dedup window 0–30 days: exclude creators this API key returned in the past N days. `0` = no dedup. Default `3` |

**Response `data`:**
```json
{
  "total": 20,
  "data": [
    {
      "nickname": "Jane Smith",
      "username": "janesmith",
      "profileUrl": "https://www.instagram.com/janesmith",
      "followerCount": 520000,
      "averagePlayCount": null,
      "averageLikeCount": 8400,
      "region": "US",
      "language": "en",
      "email": "jane@example.com",
      "relevanceScore": 0.87,
      "reason": "Matched tag: Skincare"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| total | Number of creators returned in this response |
| data[].nickname | Display name |
| data[].username | Platform handle |
| data[].profileUrl | Profile page URL |
| data[].followerCount | Follower / subscriber count, may be null |
| data[].averagePlayCount | Avg views per video — TikTok/YouTube only, null for Instagram |
| data[].averageLikeCount | Avg likes per post — Instagram only, null for TikTok/YouTube |
| data[].region | Creator's region, may be null |
| data[].language | Primary language, may be null |
| data[].email | Contact email, may be empty string |
| data[].relevanceScore | Relevance score 0–1 |
| data[].reason | Human-readable match reason |

---

## Recommended Workflow

```
1. GET  /quota                 check you have enough credits
2. POST /intelligent-search    describe what you want → get creators back  (costs N)
```

`/intelligent-search` handles everything automatically:

1. Parses your sentence into canonical tags and keywords
2. Uses an LLM to select all tags/keywords that are relevant to your intent
3. Executes the search (ES + semantic vector)
4. If the result count is below `limit`, automatically calls for more keywords and runs a supplement round to fill up the remaining slots
5. Returns the final merged list

You do **not** need to call `/parse` or `/more-words` manually. Those endpoints are available for debugging or advanced use cases where you want to inspect or override the intermediate steps.

### Advanced: override tags/keywords

If you pass `canonicalTags` or `keywords` directly, the automatic selection is skipped for that field and your values are used as-is. This lets you lock in specific tags after inspecting `/parse` output.

```json
{
  "sentence": "skincare creators in the US",
  "platform": "INSTAGRAM",
  "limit": 20,
  "canonicalTags": ["Skincare", "Beauty Influencer"],
  "keywords": ["glass skin", "anti-aging"]
}
```

---

## Error Handling

| Scenario | HTTP | statusCode | Action |
|----------|------|-----------|--------|
| Missing / wrong key or email | 401 | 1401 | Fix request headers |
| Quota exhausted | 403 | 1403 | Top up at app.easykol.com |
| Invalid parameter | 400 | 1450 | Check `sentence` and `platform` |
| Rate limited | 429 | 1429 | Back off and retry |
| Server error | 500 | — | Retry after a short delay |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `POST /intelligent-search` | 10 req/min |
| `POST /intelligent-search/parse` | 30 req/min |
| `POST /intelligent-search/more-words` | 30 req/min |
| `GET /quota` | 120 req/min |

Exceeding the limit returns HTTP 429. Implement exponential backoff on the client side.
