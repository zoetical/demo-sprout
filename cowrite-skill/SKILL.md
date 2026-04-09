---
name: cowrite
description: AI co-write skill. Reads raw voice notes from a Feishu document, produces content architecture / outline / storyboard, and writes results back to the same document.
argument-hint: <date, e.g. 2026-04-09>
---

# Co-write Skill

Read raw voice transcription notes from a Feishu document, co-write with the user to produce structured content (architecture, outline, storyboard), then write results back.

## Trigger

`/cowrite <date>` — date format: `YYYY-MM-DD` (e.g. `2026-04-09`)

If no date is provided, use today's date.

## Environment

Feishu credentials are stored in `/Users/tomin/.gemini/workspace-cowriter/sprouts copy/.env`:
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_OWNER_OPEN_ID`

## Workflow

### Phase 1: Fetch notes from Feishu

1. Run the helper script to get a Feishu access token:
   ```bash
   bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh token
   ```

2. Find the target document by listing all documents and matching the title pattern `{date} 闪念笔记`:
   ```bash
   bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh find-doc "<date>"
   ```
   This returns the `document_id` if found, or "NOT_FOUND".

3. Read the document content:
   ```bash
   bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh read-doc "<document_id>"
   ```
   This returns all text blocks from the document, which are the raw voice transcriptions.

4. If the document is not found, inform the user and stop. Do NOT create a new document — this skill only processes existing notes.

### Phase 2: Co-write

Analyze the raw transcription notes and produce three sections. Present each to the user for review before finalizing.

**Important**: The notes are raw voice transcriptions — they may be messy, repetitive, or stream-of-consciousness. Your job is to extract the core ideas and structure them.

#### 2a. Content Architecture (内容架构)
- Identify the core topic/theme from the notes
- Define the target audience
- Determine the content angle and hook
- Identify the key takeaway / value proposition
- Present to user: "Here's the architecture I see — does this match your intent?"

#### 2b. Outline (大纲)
- Based on the confirmed architecture, create a structured outline
- Include section headers and key points for each section
- Suggest an opening hook and closing CTA
- Present to user for feedback and iterate if needed

#### 2c. Storyboard (分镜)
- For video/visual content: describe scene-by-scene what to show
- For text content: describe paragraph-by-paragraph flow
- Include suggested visuals, transitions, or emphasis points
- Present to user for feedback and iterate if needed

### Phase 3: Write back to Feishu

Once the user confirms all three sections, write them back to the same Feishu document:

```bash
bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh append-doc "<document_id>" "<title>" "<content>"
```

Write the results as structured blocks appended to the document:
- A divider (to separate from raw notes)
- A heading: "Co-write 结果"
- Sub-heading: "内容架构" + the architecture text
- Sub-heading: "大纲" + the outline text  
- Sub-heading: "分镜" + the storyboard text

Use the helper script to append each section:

```bash
bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh append-doc "<document_id>" "Co-write 结果" ""
bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh append-section "<document_id>" "内容架构" "<architecture_text>"
bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh append-section "<document_id>" "大纲" "<outline_text>"
bash /Users/tomin/.claude/skills/cowrite/scripts/feishu-api.sh append-section "<document_id>" "分镜" "<storyboard_text>"
```

### Phase 4: Summary

Tell the user:
- What was produced
- Link to the Feishu document: `https://my.feishu.cn/docx/<document_id>`

## Notes

- This skill is interactive — present each section to the user and iterate before writing back
- Keep the original voice notes intact; always append, never overwrite
- The voice notes may be in Chinese, English, or mixed — follow the language of the notes
- If the user wants to re-run co-write on a document that already has results, append new results below the old ones (don't delete previous co-write results)
