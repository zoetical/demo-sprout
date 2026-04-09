# Sprout iOS Shortcut — 简化版（3 步）

录音 → 发到 Vercel API → 自动搞定转录 + 飞书文档

---

## 前置：部署 API

API 代码在 `api/sprout.js`，部署在 Vercel（repo: `zoetical/sprout-api`）。

部署后在 Vercel Settings → Environment Variables 添加：

| 变量名 | 值 |
|--------|-----|
| `GROQ_API_KEY` | Groq API key |
| `FEISHU_APP_ID` | 飞书 App ID |
| `FEISHU_APP_SECRET` | 飞书 App Secret |
| `FEISHU_OWNER_OPEN_ID` | 飞书 Open ID |

当前部署地址：`https://sprout-api-delta.vercel.app`

---

## Shortcut 步骤

### Step 1: Record Audio
- Action: **Record Audio**

### Step 2: 发送录音到 API
- Action: **Get Contents of URL**
- URL: `https://sprout-api-delta.vercel.app/api/sprout`
- Method: **POST**
- Request Body: **Form**
  - `file`: Recorded Audio（类型选 **File**）

### Step 3: 显示结果
- Action: **Get Value** for `message` in Contents of URL
- Action: **Show Alert**
  - Title: Sprout
  - Message: `{Dictionary Value}`

---

## 工作原理

Shortcut 把录音发到 Vercel API，API 自动完成：

1. **Groq Whisper** 转录语音
2. 获取飞书 token
3. 在「Sprout 闪念笔记」文件夹中查找/创建当天文档
4. 追加：分隔线 + 时间标题 + 转录文字
5. 每天一篇文档，多次录音自动 append
