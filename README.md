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

## 如何获取 API Keys

### Groq API Key

1. 打开 [console.groq.com](https://console.groq.com)，注册/登录
2. 左侧菜单点 **API Keys**
3. 点 **Create API Key**，复制保存

Groq 免费额度足够个人使用（Whisper 转录不计入 token 用量限制）。

### 飞书自建应用（App ID / App Secret / Open ID）

1. 打开 [飞书开放平台](https://open.feishu.cn)，登录后点 **创建应用** → 选 **自建应用**
2. 填写应用名称（如 "Sprout"），创建完成后在 **凭证与基础信息** 页面获取 `App ID` 和 `App Secret`
3. 左侧菜单 → **权限管理**，搜索并开通以下权限：
   - `docx:document` — 读写文档
   - `drive:drive` — 读写云空间
   - `drive:file` — 读写文件
   - `drive:permission:member` — 管理文件协作者
4. 左侧菜单 → **版本管理与发布** → 创建版本并发布（自建应用审核秒过）
5. 获取你的 **Open ID**：
   - 左侧菜单 → **API 调试台**
   - 选一个用户相关 API，如 `GET /contact/v3/users/me`
   - 点发送，响应里的 `open_id`（格式 `ou_xxxxxxx`）就是你的

> Open ID 跟 App 绑定——同一个人在不同 App 下的 open_id 不一样，要用你自己创建的 App 来查。

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
