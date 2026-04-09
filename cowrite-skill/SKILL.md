---
name: cowrite
description: AI 共创技能。从飞书文档读取语音闪念笔记，通过深挖对话与用户共创内容，产出正文/内容架构/视频大纲/分镜，写回飞书文档。
argument-hint: <日期> <组名>，如 2026-04-09 科技组
---

# 共创技能 (Co-write)

从飞书文档读取语音转写的闪念笔记，通过深挖对话与用户共创结构化内容，然后将结果写回原文档。

## 触发方式

`/cowrite <日期> <组名>`

- 日期格式：`YYYY-MM-DD`（如 `2026-04-09`）
- 如果未提供日期，使用今天的日期
- 组名必须是以下之一：

| 组 | 对应板块 | 备注 |
|----|----------|------|
| 影视内容组 | 影视 | — |
| 科技组 | 科技 | — |
| 亿点点不一样 | 自然科学 | 自治区模式：绑定固定摄影+剪辑，自主决定制作流程和工作方式 |
| 飓多多 | 综艺娱乐 | — |
| 商业组 | 商业内容 | — |

所有账号全平台分发（小红书、抖音、YouTube、哔哩哔哩、微信视频号等）。

## 环境配置

飞书凭证存放在 `/Users/tomin/.gemini/workspace-job-mediastorm/demo-sprout/.env`：
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_OWNER_OPEN_ID`

## 工作流程

### 第一阶段：从飞书获取笔记

1. 获取飞书访问令牌：
   ```bash
   bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh token
   ```

2. 查找目标文档（标题模式 `{date} 闪念笔记`）：
   ```bash
   bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh find-doc "<date>"
   ```
   找到则返回 `document_id`，否则返回 "NOT_FOUND"。

3. 读取文档内容：
   ```bash
   bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh read-doc "<document_id>"
   ```

4. 如果文档未找到，告知用户并停止。不要创建新文档。

5. 读取完成后，先告诉用户笔记概况和本次共创最终会产出的内容：
   - 一篇统一正文
   - 内容架构（主题、核心论点、情感线、目标读者画像）
   - 视频大纲（如适用）
   - 分镜文字描述（如适用）

### 第二阶段：深挖对话

> **核心原则：先深挖，后动笔。至少 3-5 轮对话后才开始整理。**

#### 规则

1. **一次一个问题**
   不一次问完所有问题。每轮只提一个问题，等用户回答后再推进。降低回答负担，提高每轮回答的深度。

2. **问题有方向性**
   不问泛泛的"你想写什么"。每个问题给具体选项（A/B/C），降低用户思考负担，引导用户思考没想到的角度。

3. **主动做 Research**
   用户提到某个概念时，主动搜索查找相关依据或研究，带回可引用的论点。

4. **不急于动笔**
   前几轮的目标是"把素材挖厚"，不是"赶紧出初稿"。信息不够就继续问。

#### 推荐的问题方向

- 这几条灵感之间有什么关联？你觉得核心想表达的是什么？
- 你写这个的时候是什么场景/情绪？（挖故事性）
- 如果一句话说给朋友听，你会怎么说？（找标题/Hook）
- 你希望读者看完后做什么/感受什么？（明确目的）
- 有没有一个具体的案例、画面、或比喻可以支撑你的观点？
- 这个选题对「{组名}」账号的受众来说，最吸引人的点是什么？

### 第三阶段：整理输出

当信息足够时（一般 3-5 轮对话后），主动提议整理。如果用户中途说"差不多了"或"可以开始写了"，尊重用户判断，直接进入整理。

#### 输出内容

1. **一篇统一正文**
   - 一篇完整的、打磨好的文章
   - **不按平台拆分**——内容为王，风格差异只在标题和封面上适配
   - AI 可以加入自己的角度、补充、延伸思考，真正做到"共同创作"

2. **内容架构**（结构化纲要）
   - 主题和核心论点
   - 情感线（开头什么情绪 → 中间转折 → 结尾什么感受）
   - 目标读者画像

3. **视频大纲**（如果适用）
   - 按 `MM:SS 内容描述` 格式
   - 注明每段的核心要点和情绪节奏

4. **分镜文字描述**（如果适用）
   - 按 `镜头 N (时间段)：画面描述` 格式
   - 包含机位、画面元素、文字叠加建议

#### 风格保留规则

> **AI 的角色是收束，不是润色。**

- **默认保留原味**：用户的原话默认保留，不润色、不改写。只有当用户明确说"帮我润一下"时才修改。
- **保留真人痕迹**——以下元素是"人味"的核心：
  - 语气词（"嘿""哎""你看"）
  - 思维转弯（"但稍微一想，不对劲了"）
  - 自嘲和无聊的幽默
  - 说到一半跑题又拉回来的过程
  - 不完美的表达和奇怪的造词
- **AI 帮用户组织结构**、理清段落顺序、收束散发的话题，但**不替换用户的用词和语气**。像编辑帮你排版，不是帮你重写。

### 第四阶段：写回飞书

用户确认输出内容后，将结果写回同一飞书文档：

```bash
bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh append-divider "<document_id>"
bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh append-heading "<document_id>" "Co-write 结果（{组名}）"
bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh append-section "<document_id>" "正文" "<正文内容>"
bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh append-section "<document_id>" "内容架构" "<架构文本>"
bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh append-section "<document_id>" "视频大纲" "<大纲文本>"
bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh append-section "<document_id>" "分镜" "<分镜文本>"
```

### 第五阶段：总结

告知用户：
- 产出了什么内容
- 飞书文档链接：`https://my.feishu.cn/docx/<document_id>`

## 注意事项

- 此技能是交互式的——先深挖，再整理，确认后才写回
- 保持原始语音笔记不变；始终追加，不要覆盖
- 全程使用中文交流和输出
- 如果笔记已有上一轮 co-write 结果，在此基础上继续迭代，不要从零开始
- 如果素材本身已经很完整（比如已有草稿），可以减少提问轮数
- 如果用户想对已有结果的文档重新共创，将新结果追加在旧结果下方
