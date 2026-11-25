# @easykol/cli

EasyKOL 的独立命令行客户端。通过 Codex、Cursor 或 Claude Code 使用 Skill 时，可直接使用[自带脚本](../README.md#runtime-and-credentials)。GitHub Skill 和 npm 独立 CLI 分别发布。

## 前置条件

- Node.js 18+
- EasyKOL API Key（登录 [app.easykol.com/settings/quotaQuery](https://app.easykol.com/settings/quotaQuery) 生成）

## 从源码使用当前版本

在本目录运行 `npm ci` 和 `npm run build`，然后使用 `node dist/index.js`。下文的 `easykol` 指本次构建的命令，也可用于已安装且支持相应命令的版本。通过 `easykol --version` 和 `easykol schema --all` 核对版本与功能。npm 版本可能滞后。

## 快速开始

### 1. 配置认证

```bash
# 推荐：从环境变量读取，避免 Key 出现在 shell 历史
printf '%s' "$EASYKOL_API_KEY" | easykol auth --key-stdin --email you@example.com
```

配置保存在 `~/.easykol/config.json`。

### 2. 检查连接

```bash
easykol doctor
```

### 3. 查看剩余配额

```bash
easykol quota
```

### 4. 搜索创作者

通过 V2 执行搜索，提交前自动请求免费准备和报价：

```bash
easykol search-v2 \
  --mode standard \
  --sentence "美妆护肤类 Instagram 博主，粉丝 10 万以上" \
  --platform INSTAGRAM \
  --regions US \
  --min-subscribers 100000
```

需要预览或调整准备结果时，可先运行 `easykol parse-v2`。执行后保存任务 ID，用 `task --task-id <id>` 免费读取。需要更多结果时，按[续批规则](../skills/easykol/references/pro-pagination.md)继续。

## 配额说明

| 操作 | 扣费规则 |
|------|----------|
| `search-v2`、`search-next` | 按服务端批次报价预扣，读取结算确认净扣费。 |
| `parse-v2`、`task` | **免费**，可读准备、历史分页或结算。 |
| `search`（V1） | 返回 N 个博主扣 **N 原始配额**，0 结果不扣。 |
| `parse`（V1） | **免费** |
| `more-words` 扩展关键词 | **免费** |
| `quota` 查询剩余配额 | **免费** |
| `doctor` / `auth` / `schema` | **免费** |

配额不足时命令以退出码 `3` 退出，可前往 [app.easykol.com/settings/quotaQuery](https://app.easykol.com/settings/quotaQuery) 查看或购买配额。

## 命令列表

| 命令 | 配额 | 说明 |
|------|------|------|
| `doctor` | 免费 | 检查 CLI 版本、配置和 API 连通性 |
| `auth` | 免费 | 保存 API Key 和邮箱 |
| `quota` | 免费 | 查看剩余配额 |
| `parse-v2` | 免费 | 准备 V2 搜索并查看报价 |
| `search-v2` / `search-next` | 服务端报价 | 执行或续批 V2 搜索 |
| `task` | 免费 | 查询任务或读取已保存结果 |
| `search-export` | 免费 | 从已保存的搜索结果下载 Excel |
| `parse`（V1） | 免费 | 预览同步搜索的标签和关键词 |
| `more-words` | 免费 | 扩展更多关键词（排除已展示的） |
| `search`（V1） | 返回数量 | 执行旧版同步搜索，N 个结果扣 N 原始配额 |
| `schema [cmd]` | 免费 | 查看命令参数（用于 AI Agent 集成） |
| `exit-codes` | 免费 | 查看所有退出码含义 |

## 旧版 V1 筛选参数

V2 和结果导出的字段见[搜索及结果筛选](../skills/easykol/references/search-filters.md)。

`parse` / `more-words` / `search` 均支持以下可选筛选：

| 参数 | 说明 | 示例 |
|------|------|------|
| `--platform` | 平台（必填） | `YOUTUBE` / `TIKTOK` / `INSTAGRAM` |
| `--regions` | 地区（ISO Alpha-2，逗号分隔） | `US,GB,AU` |
| `--languages` | 语言（BCP-47，逗号分隔） | `en,zh` |
| `--min-subscribers` | 最少粉丝数 | `100000` |
| `--max-subscribers` | 最多粉丝数 | `1000000` |
| `--avg-min` | 最低平均播放 / 点赞量 | `10000` |
| `--avg-max` | 最高平均播放 / 点赞量 | `500000` |

`search` 额外支持：

| 参数 | 说明 |
|------|------|
| `--limit` | 返回数量，1–50，默认 20 |
| `--tags` | 指定 canonical 标签（来自 parse 结果，逗号分隔） |
| `--keywords` | 指定关键词（来自 parse / more-words，逗号分隔） |
| `--has-contact` | 只返回有联系方式的创作者 |
| `--gender` | `male` / `female` |

## 输出格式

所有命令输出 JSON：

```json
{ "status": "ok", "data": { ... } }
```

出错时：

```json
{ "status": "error", "error": { "code": 2, "message": "Not authenticated..." } }
```

进程退出码：`0` 成功 · `1` 通用错误 · `2` 未认证 · `3` 配额不足 · `4` 无权限 · `5` 网络错误 · `6` 参数错误 · `7` 限流

## V1 兼容示例

```bash
# YouTube 科技评测，美国地区，50 万以上订阅
easykol search \
  --sentence "tech product reviewers in the US" \
  --platform YOUTUBE \
  --regions US \
  --min-subscribers 500000 \
  --limit 10

# TikTok 健身博主，英语内容，有联系方式
easykol search \
  --sentence "fitness and workout creators" \
  --platform TIKTOK \
  --languages en \
  --has-contact \
  --limit 20

# 先预览再搜索（可选，调试用）
easykol parse --sentence "skincare influencers" --platform INSTAGRAM --regions US
# 确认标签后执行
easykol search --sentence "skincare influencers" --platform INSTAGRAM \
  --regions US --min-subscribers 10000 --avg-min 0 \
  --tags "护肤/Skincare,美妆博主/Beauty Influencer"
```

## AI Agent 集成

本 CLI 为 Claude Code 等 AI Agent 设计。Agent 可通过以下命令自描述接口，无需硬编码参数：

```bash
easykol schema --all      # 完整命令树
easykol schema search-v2  # 单个命令的参数
easykol exit-codes        # 退出码含义
```

## V2 搜索模式

The original `search` and `parse` commands above retain their V1 contract.
Use V2 for fast, standard, beta, explicit-tag or explicit-keyword search:

```bash
easykol search-v2 --mode fast --platform TIKTOK --sentence "US gaming creators" --regions US
easykol search-v2 --mode standard --platform TIKTOK --sentence "US beauty creators" --main-category beauty --sub-category makeup --has-tk-shop --last-published-days 30
easykol search-v2 --mode standard --platform YOUTUBE --sentence "Running reviewers"
easykol search-v2 --mode beta --platform INSTAGRAM --sentence "Sports creators" --product "Running headphones"
easykol parse-v2 --mode fast --platform TIKTOK --sentence "US gaming creators"
easykol task --task-id TASK_ID --offset 0 --limit 100
easykol search-next --task-id COMPLETED_TASK_ID
easykol search-v2 --mode keyword --platform YOUTUBE --keywords 'road cycling,bike fit' --search-data-mode realtime
easykol task --task-id WEB_TASK_ID --project-id PROJECT_ID --attitude NORATE
easykol search-export --task-id WEB_TASK_ID --project-id PROJECT_ID --attitude LIKE --output ./favorites.xlsx
```

V2 requires the deployed external V2 backend; default mode is fast. The CLI
prepares/quotes before paid submission, persists the idempotency key for recovery,
and bills by quoted batches. Stored-page queries are free. See
[the V2 reference](../skills/easykol/references/search-modes.md) for recovery and
settlement rules. Missing V2 never silently submits a paid V1 request.

V2 also exposes creator taxonomy, appearance, recent-activity and stored TikTok
Shop filters. Each option requires a compatible deployment. Run `easykol schema search-v2` for the current flag list. Explicit
`--keywords ''` disables only keyword recall; tag and semantic recall remain active.


### Email module

With a backend supporting `/external/v1/email`, run `easykol schema email-send`
and the `email-template-*`, `email-followup-template-*`, `email-followups-*`,
`email-senders`, `email-sender-*`, `email-record`, `email-records` commands.
JSON writes use `--body-file file.json` or `--body-file -` (stdin).
Actual sending requires `--confirm-send`; changing an automatic follow-up sequence
requires `--confirm-scheduled-changes`, because pending schedules change too.
These flags reflect existing user authorization, not an instruction to ask again.
Never automatically retry an uncertain send. New mailbox binding and OAuth
reauthorization use the web flow. See `skills/easykol/references/email.md`.
