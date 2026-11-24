# AI video content analysis

Use the plugin-equivalent video analysis for TikTok and Instagram videos up to
20 minutes. The backend analyzes the video itself, including picture and audio.
For views, likes and other metrics, use `video`. For saved placement history, use
`tracked-videos` or `tracked-video-trends`. Comment analysis and YouTube video
content are outside this command's scope.

## Submit and read a report

1. Use the user's video URL and the requested analysis focus. If the user says
   “分析这条视频” without a focus, use deep content analysis. Common prompts can
   cover the core message, narrative and tone, a breakdown of the hook, script,
   visuals, editing and music, or a description of the visuals followed by a
   translation of subtitles, onscreen text and speech. For custom requests, keep
   the user's actual instructions. Set the output language explicitly, using
   the user's requested language or the chat language.
2. Use the operation below. An explicit request to analyze one video authorizes
   that task within any stated budget. The price is **0.5 AI credits per newly
   accepted task**. An intentional rerun has the same price.

   ```sh
   node "{baseDir}/scripts/api.cjs" video-analysis --url "<video URL>" \
     --prompt "<analysis instructions>" --language zh-CN
   ```

3. Keep the task ID the helper prints before submission. The helper waits up to
   10 minutes by default. With `--submit-only`, it returns after acceptance.
   Read an existing task for free with the account that created it.

   ```sh
   node "{baseDir}/scripts/api.cjs" video-analysis-result --task-id "<task ID>"
   ```

4. Report the finished analysis in the requested language. If the task is still
   pending or processing, continue reading the same ID. If submission timed out
   and the task lookup still returns 404, resume using `video-analysis --task-id`
   with the original URL, prompt and language. Reusing the ID keeps one task and
   one charge. A new ID starts a separately billed task. A task that fails after
   acceptance has already gone through the creation charge.
