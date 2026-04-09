# Sprout

语音闪念笔记 → AI 转录 → 飞书文档 → Co-write 内容创作

## 它做什么

1. **iPhone 录音** — iOS Shortcut 一键录音
2. **自动转录** — Groq Whisper 语音转文字
3. **写入飞书** — 每天一篇文档，多次录音自动追加到同一篇
4. **Co-write** — Claude Code Skill，分析闪念笔记，生成内容架构 / 大纲 / 分镜

## 项目结构

```
api/sprout.js          Vercel Serverless Function（Shortcut 后端）
shortcut-guide.md      iOS Shortcut 配置指南（3 步搞定）
cowrite-skill/         Claude Code Skill（AI Co-write）
  SKILL.md             Skill 定义
  scripts/feishu-api.sh  飞书 API 工具脚本
vercel.json            Vercel 配置
package.json           项目信息
.env                   环境变量（不上传 git）
```

## 快速开始

### 1. 部署 API（免费）

```bash
# Fork 这个 repo，在 Vercel 上 Import，添加环境变量即可
```

Vercel 环境变量：

| 变量 | 用途 |
|------|------|
| `GROQ_API_KEY` | Groq Whisper 语音转录 |
| `FEISHU_APP_ID` | 飞书自建应用 App ID |
| `FEISHU_APP_SECRET` | 飞书自建应用 Secret |
| `FEISHU_OWNER_OPEN_ID` | 你的飞书 Open ID |

### 2. 配置 iOS Shortcut

只需 3 步：

1. **Record Audio** — 录音
2. **Get Contents of URL** — POST 到你的 Vercel API，Body 选 Form，`file` 字段选录音文件
3. **Show Alert** — 显示结果

详见 [shortcut-guide.md](shortcut-guide.md)

### 3. Co-write（可选）

将 `cowrite-skill/` 复制到 `~/.claude/skills/cowrite/`，在 Claude Code 中使用 `/cowrite` 命令即可读取当天飞书闪念笔记，AI 协助生成内容架构、大纲和分镜。

## 工作原理

```
iPhone Shortcut
    │ 录音
    ▼
Vercel API (api/sprout.js)
    │ Groq Whisper 转录
    │ 飞书 API 写入
    ▼
飞书文档「2026-04-09 闪念笔记」
    │
    ▼ /cowrite
Claude Code → 内容架构 / 大纲 / 分镜
```

## 飞书文档效果

每天一篇，标题如「2026-04-09 闪念笔记」：

```
───────────────
## 09:15
今天早上想到一个点子，关于内容创作流程的优化...

───────────────
## 14:32
刚和团队讨论完，决定用飞书文档作为素材库...

───────────────
## 21:08
睡前总结：今天完成了三件事...
```
