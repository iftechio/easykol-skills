# @easykol/cli

EasyKOL 的命令行客户端，用自然语言在 YouTube、TikTok、Instagram 上发现 KOL / 创作者。

## 前置条件

- Node.js 18+
- EasyKOL API Key（登录 [app.easykol.com/settings/quotaQuery](https://app.easykol.com/settings/quotaQuery) 生成）

## 安装

```bash
npm install -g @easykol/cli@latest
```

## 快速开始

### 1. 配置认证

```bash
# 推荐：从环境变量读取，避免 Key 出现在 shell 历史
printf '%s' "$EASYKOL_API_KEY" | easykol auth --key-stdin --email you@example.com

# 或直接传入
easykol auth --key ek_xxx --email you@example.com
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

直接搜索（推荐）。`search` 内部会自动完成 parse / 选词，无需先调 `parse`：

```bash
easykol search \
  --sentence "美妆护肤类 Instagram 博主，粉丝 10 万以上" \
  --platform INSTAGRAM \
  --regions US \
  --min-subscribers 100000 \
  --avg-min 0 \
  --limit 20
```

可选：调试或需要预览标签时，可先 `parse`（免费）再 `search`：

```bash
easykol parse --sentence "美妆护肤类 Instagram 博主" --platform INSTAGRAM --regions US
```

## 配额说明

| 操作 | 扣费规则 |
|------|----------|
| `search` 执行搜索 | 返回 N 个博主扣 **N 配额**，**0 结果不扣** |
| `parse` 解析搜索意图 | **免费** |
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
| `parse` | 免费 | 预览搜索：标签 + 关键词 + 预估数量（调试用） |
| `more-words` | 免费 | 扩展更多关键词（排除已展示的） |
| `search` | 返回数量 | 执行搜索，返回 N 个扣 N 配额，0 结果不扣 |
| `schema [cmd]` | 免费 | 查看命令参数（用于 AI Agent 集成） |
| `exit-codes` | 免费 | 查看所有退出码含义 |

## 筛选参数

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

## 典型使用示例

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
easykol schema search     # 单个命令的参数
easykol exit-codes        # 退出码含义
```
