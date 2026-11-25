# Project favorites, fake-follower reports and TikTok product anchors

Use the current user's EasyKOL API identity. Talking about a creator or receiving search results does not authorize changes to a project. Run the following commands through `node "{baseDir}/scripts/api.cjs"`.

## Project favorites and Excel

- Find the exact project with `favorites-projects` or use a known ID with `favorites-project --project-id <id>`. `favorites-create --title <name>` creates an EasyKOL project. `favorites-rename --project-id <id> --title <name>` edits its name.
- `favorites-list --project-id <id>` reads saved creators. Pass `nextCursor` unchanged as `--cursor` on the next page with the same project and platform. The project commands use projects owned by the authenticated account.
- Use `favorites-add` or `favorites-remove` with `--project-id <id> --kol-ids <id,id>`. Use the stable EasyKOL creator IDs returned by the API. Each request accepts up to 100 IDs. Report per-creator status. Existing NO and Superlike ratings are preserved when adding. Removing clears the favorite status for the selected creator in that project.
- A project can include searches or other work. Confirm the exact project and the user's intent to delete the project before using `favorites-delete --project-id <id> --confirm-delete`. EasyKOL protects the default project.
- `favorites-share --project-id <id> --scope workspace` creates a read-only snapshot for active members of the owner's enterprise. Recipients read it using `favorites-shared --share-key <key>` with their EasyKOL identity. Pass `nextOffset` as `--offset` for additional pages. Use `--scope public` only when the user requests public access and return the browser URL. Public pages contain creator names, handles and platforms. `--scope off` revokes the share. The default expiry is 7 days. Set or refresh the scope to capture the current favorites again.
- `favorites-export --project-id <id> --days 7 --lang en` starts the standard EasyKOL personal favorites Excel export for that project. Ask for the period if unclear (1, 7 or 30 days). The export uses the account's web export columns. Keep the returned `taskId` and use `favorites-export-result --project-id <id> --task-id <id>` to get its status and download URL. Share downloads only with the intended recipient. Export and status reads cost 0 AI credits.

## Standalone fake-follower report

Run `fake-followers --url <profile-url>` only when asked for this report. A new report costs 2 AI credits at the existing EasyKOL fake-audience rate. Eligible reports within the current cache window are reused for free. Report the actual submission charge from `billing.chargedPoints`. Use `fake-followers-result --task-id <id>` to read or resume the report for free. If task submission times out, avoid assuming the paid call failed and never start a second report merely to check status.

Explain the evidence according to `sampleSource`. TikTok samples followers, Instagram samples post likers, and YouTube reports indicators from commenters. Counts of recently joined YouTube accounts and accounts without a listed country may overlap. Avoid describing these counts as the percentage of fake subscribers. Missing metrics are unknown.

## TikTok work-level product anchors

- Use `search-v2 --platform TIKTOK --has-video-cart` or `similar --url <tiktok-profile> --has-video-cart` when the user wants creators with stored TikTok product anchors. Search V2 quotes the advanced-filter price and settles through its normal per-batch billing. Similar uses its normal billing and filters its existing shortlist, so result counts may be lower.
- Use `tiktok-cart --url <tiktok-profile>` to check the most recent stored posts, up to 60. A successful check costs 0.1 AI credits. Failed requests cost zero. Report `billing.chargedPoints` and the scan size at `cartEvidence.scannedCount`. `cartEvidence.hasVideoCart: true` means the sample contains explicit product-anchor evidence. `null` means the stored sample cannot establish whether a cart exists. These checks use stored posts. Treat product availability and current cart state as unknown.
- `--has-tk-shop` is the separate account storefront filter. A store, an ad flag, or a product name in a caption does not establish that the post contains a product anchor.
