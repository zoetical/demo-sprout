// Vercel Serverless Function
// iOS Shortcut → this endpoint → Groq Whisper + Feishu Doc

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    // ── 1. Parse audio from iOS Shortcut ──
    const { file, buffer } = await parseAudio(req);
    console.log(`[1] Audio: ${file.filename}, ${buffer.length} bytes`);

    // ── 2. Groq Whisper transcription ──
    const transcription = await transcribe(buffer, file.filename);
    console.log(`[2] Transcribed: ${transcription.substring(0, 60)}...`);

    // ── 3. Get Feishu token ──
    const token = await getFeishuToken();
    console.log("[3] Feishu token OK");

    // ── 4. Get or create the Sprout folder ──
    const folderToken = await getOrCreateFolder(token);
    console.log(`[4] Folder: ${folderToken}`);

    // ── 5. Find or create today's doc inside the folder ──
    const today = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Shanghai",
    });
    const docId = await findOrCreateDoc(token, folderToken, today);
    console.log(`[5] Doc: ${docId}`);

    // ── 6. Append transcription ──
    const timeNow = new Date().toLocaleTimeString("en-GB", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
    });
    await appendToDoc(token, docId, timeNow, transcription);
    console.log("[6] Appended OK");

    return res.json({
      ok: true,
      message: `已保存到「${today} 闪念笔记」`,
      time: timeNow,
      docUrl: `https://my.feishu.cn/docx/${docId}`,
    });
  } catch (err) {
    console.error("[ERROR]", err);
    return res.status(500).json({ error: err.message });
  }
}

// ─── Parse multipart audio from iOS Shortcut ───────────────────────

async function parseAudio(req) {
  const boundary = req.headers["content-type"]?.split("boundary=")[1];
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  if (!boundary) {
    return { file: { filename: "audio.m4a" }, buffer: body };
  }

  const boundaryBuf = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = 0;

  while (true) {
    const idx = body.indexOf(boundaryBuf, start);
    if (idx === -1) break;
    if (start > 0) parts.push(body.subarray(start, idx));
    start = idx + boundaryBuf.length;
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;
    if (body[start] === 0x2d && body[start + 1] === 0x2d) break;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headers = part.subarray(0, headerEnd).toString();
    if (
      headers.includes("filename") ||
      headers.includes("audio") ||
      headers.includes("file")
    ) {
      const filename =
        headers.match(/filename="?([^";\r\n]+)"?/)?.[1] || "audio.m4a";
      let dataEnd = part.length;
      if (part[dataEnd - 2] === 0x0d && part[dataEnd - 1] === 0x0a)
        dataEnd -= 2;
      return { file: { filename }, buffer: part.subarray(headerEnd + 4, dataEnd) };
    }
  }

  return { file: { filename: "audio.m4a" }, buffer: body };
}

// ─── Groq Whisper ──────────────────────────────────────────────────

async function transcribe(audioBuffer, filename) {
  const form = new FormData();
  form.append("file", new Blob([audioBuffer]), filename);
  form.append("model", "whisper-large-v3");
  form.append("language", "zh");
  form.append(
    "prompt",
    "你好，Whisper API！请把我的语音文件转换成文字。关于中文名的音译，我喜爱用大文起始的，像是Yuan，最终分享于各大社群流量台及其视频，比如小红书、Bilibili"
  );

  const resp = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: form,
    }
  );
  const data = await resp.json();
  if (data.error) throw new Error(`Groq: ${JSON.stringify(data.error)}`);
  return data.text;
}

// ─── Feishu helpers ────────────────────────────────────────────────

async function feishuAPI(token, method, path, body) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`https://open.feishu.cn/open-apis${path}`, opts);
  return resp.json();
}

async function getFeishuToken() {
  const resp = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: process.env.FEISHU_APP_ID,
        app_secret: process.env.FEISHU_APP_SECRET,
      }),
    }
  );
  const data = await resp.json();
  if (data.code !== 0)
    throw new Error(`Feishu token: ${JSON.stringify(data)}`);
  return data.tenant_access_token;
}

// ─── Folder management ─────────────────────────────────────────────

const FOLDER_NAME = "Sprout 闪念笔记";

async function getOrCreateFolder(token) {
  // Get app's root folder
  const rootData = await feishuAPI(token, "GET", "/drive/explorer/v2/root_folder/meta");
  console.log("[folder] root:", JSON.stringify(rootData));

  const rootToken = rootData.data?.token;
  if (!rootToken) throw new Error(`Root folder: ${JSON.stringify(rootData)}`);

  // List files in root to find our folder
  const listData = await feishuAPI(
    token,
    "GET",
    `/drive/v1/files?folder_token=${rootToken}&page_size=100`
  );
  console.log("[folder] list:", JSON.stringify(listData));

  const existing = listData.data?.files?.find(
    (f) => f.name === FOLDER_NAME && f.type === "folder"
  );
  if (existing) return existing.token;

  // Create folder
  const createData = await feishuAPI(token, "POST", "/drive/v1/files/create_folder", {
    name: FOLDER_NAME,
    folder_token: rootToken,
  });
  console.log("[folder] create:", JSON.stringify(createData));

  if (createData.code !== 0)
    throw new Error(`Create folder: ${JSON.stringify(createData)}`);

  const folderToken = createData.data?.token;

  // Share folder with user (full_access) — permission inherits to all docs inside
  const ownerId = process.env.FEISHU_OWNER_OPEN_ID;
  if (ownerId) {
    const permData = await feishuAPI(
      token,
      "POST",
      `/drive/v1/permissions/${folderToken}/members?type=folder`,
      {
        member_type: "openid",
        member_id: ownerId,
        perm: "full_access",
      }
    );
    console.log("[folder] share:", JSON.stringify(permData));
  }

  return folderToken;
}

// ─── Document management ────────────────────────────────────────────

async function findOrCreateDoc(token, folderToken, today) {
  const title = `${today} 闪念笔记`;

  // List docs in folder to find today's
  const listData = await feishuAPI(
    token,
    "GET",
    `/drive/v1/files?folder_token=${folderToken}&page_size=50`
  );
  console.log("[doc] list:", JSON.stringify(listData));

  const existing = listData.data?.files?.find(
    (f) => f.name === title && f.type === "docx"
  );
  if (existing) {
    console.log("[doc] found existing:", existing.token);
    return existing.token;
  }

  // Create new doc in folder
  const createData = await feishuAPI(token, "POST", "/docx/v1/documents", {
    title,
    folder_token: folderToken,
  });
  console.log("[doc] create:", JSON.stringify(createData));

  if (createData.code !== 0)
    throw new Error(`Create doc: ${JSON.stringify(createData)}`);

  const docId = createData.data.document.document_id;

  // Enable link sharing so the user can open the doc via URL
  // (folder permission inheritance doesn't work for web access)
  const shareData = await feishuAPI(
    token,
    "PATCH",
    `/drive/v1/permissions/${docId}/public?type=docx`,
    {
      external_access_entity: "open",
      security_entity: "anyone_can_view",
      link_share_entity: "anyone_readable",
      share_entity: "anyone",
    }
  );
  console.log("[doc] link-share:", JSON.stringify(shareData));

  return docId;
}

async function appendToDoc(token, docId, time, text) {
  const data = await feishuAPI(
    token,
    "POST",
    `/docx/v1/documents/${docId}/blocks/${docId}/children`,
    {
      children: [
        { block_type: 22, divider: {} },
        {
          block_type: 4,
          heading2: {
            elements: [{ text_run: { content: time } }],
            style: {},
          },
        },
        {
          block_type: 2,
          text: {
            elements: [{ text_run: { content: text } }],
            style: {},
          },
        },
      ],
    }
  );
  console.log("[append]", JSON.stringify(data));
  if (data.code !== 0) throw new Error(`Append: ${JSON.stringify(data)}`);
  return data;
}
