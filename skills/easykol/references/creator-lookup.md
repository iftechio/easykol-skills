# Creator and recent post lookups

Both operations use the configured EasyKOL API key and bound email. Use the
bundled helper's `schema` command for exact flags.

## Recent posts

Use a YouTube `/@handle` or `/channel/…` URL, a TikTok `/@handle` URL, or an
Instagram profile URL. Video links and short redirect URLs need a supported
profile URL instead.

- `items` contains stored posts ordered by known publication date, with unknown
  dates last. `profileUpdatedAt` is the stored profile record's update time.
- Each item has a platform post ID, content type, post link when available,
  title or caption, publication date, and available views, likes and comments.
  A missing field is `null`; zero is retained when provided by the inventory.
- The result is a bounded inventory sample. `truncated` means there were more
  usable stored rows than the requested limit. This call creates no tracking
  records or refresh jobs.
- Each successful query costs 0.1 AI credits, regardless of the limit or number
  of posts returned. An empty result for a stored profile counts as successful.
  Invalid input, a missing profile, or a failed read does not charge.

## Creator lookup by email

The operation normalizes the input by trimming it and ignoring case. Prefer
`--email-stdin` when the address should stay out of shell arguments. It searches
the current saved contact email in the YouTube, TikTok, and Instagram inventory.
Each result contains the EasyKOL creator ID, platform, username, nickname, profile
URL, and follower count when available. Explain that an inventory match cannot
establish inbox ownership or delivery. Do not contact or refresh the matches as
part of a lookup.

The default maximum is 20 rows. Set `--limit` to 1–60 to match the user's
requested scope and budget. Each returned row costs 0.1 AI credits. An empty
result costs zero. Report `truncated` when the limit was reached and further
matches exist. Request a higher cap only when the user wants additional results,
as a new lookup charges for the returned rows.

## Billing receipt

Both endpoints return `billing`. Use `ratePoints` for the unit price,
`maxPoints` for the most this request could cost, and `chargedPoints` for the
actual charge recorded by the server. The unit is `AI_CREDIT`. The rate basis
is `per_query` for recent posts and `per_creator` for email lookup. An empty
email match or exempt charge returns `chargedPoints: 0`.

If the connection drops or times out, the charge outcome may be unknown. Avoid
automatically calling either operation again.

If either operation is missing from the deployed API, report that availability
issue. Use the requested operation without automatically substituting a paid
lookup, direct platform call, refresh, or internal web endpoint.
