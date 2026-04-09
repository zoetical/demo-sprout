#!/usr/bin/env bash
# Feishu API helper for cowrite skill
# Usage:
#   feishu-api.sh token                          — get tenant_access_token
#   feishu-api.sh find-doc <date>                — find doc by title "{date} 闪念笔记"
#   feishu-api.sh read-doc <doc_id>              — read all text blocks from doc
#   feishu-api.sh append-divider <doc_id>        — append a divider
#   feishu-api.sh append-heading <doc_id> <text> — append h2 heading
#   feishu-api.sh append-text <doc_id> <text>    — append text block
#   feishu-api.sh append-section <doc_id> <heading> <body> — append heading + text

set -euo pipefail

# Load .env
ENV_FILE="/Users/tomin/.gemini/workspace-cowriter/sprouts copy/.env"
if [[ -f "$ENV_FILE" ]]; then
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
fi

APP_ID="${FEISHU_APP_ID:-}"
APP_SECRET="${FEISHU_APP_SECRET:-}"
BASE="https://open.feishu.cn/open-apis"

# Token cache (reuse within 1 hour)
TOKEN_CACHE="/tmp/feishu_token_cache"

get_token() {
    # Check cache
    if [[ -f "$TOKEN_CACHE" ]]; then
        local age=$(( $(date +%s) - $(stat -f %m "$TOKEN_CACHE" 2>/dev/null || echo 0) ))
        if (( age < 3600 )); then
            cat "$TOKEN_CACHE"
            return
        fi
    fi

    local resp
    resp=$(curl -s -X POST "$BASE/auth/v3/tenant_access_token/internal" \
        -H "Content-Type: application/json" \
        -d "{\"app_id\":\"$APP_ID\",\"app_secret\":\"$APP_SECRET\"}")

    local token
    token=$(echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tenant_access_token',''))" 2>/dev/null)

    if [[ -z "$token" ]]; then
        echo "ERROR: Failed to get token: $resp" >&2
        exit 1
    fi

    echo "$token" > "$TOKEN_CACHE"
    echo "$token"
}

find_doc() {
    local date="$1"
    local token
    token=$(get_token)
    local title="${date} 闪念笔记"

    # Strategy: list files in "Sprout 闪念笔记" folder, match by title
    # Step 1: Get root folder token
    local root_token
    root_token=$(curl -s "$BASE/drive/explorer/v2/root_folder/meta" \
        -H "Authorization: Bearer $token" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('token',''))" 2>/dev/null)

    if [[ -z "$root_token" ]]; then
        echo "NOT_FOUND"
        return
    fi

    # Step 2: Find "Sprout 闪念笔记" folder in root
    local folder_token
    folder_token=$(curl -s "$BASE/drive/v1/files?folder_token=$root_token&page_size=100" \
        -H "Authorization: Bearer $token" \
        | python3 -c "
import sys, json
data = json.load(sys.stdin)
files = data.get('data', {}).get('files', [])
for f in files:
    if f.get('name') == 'Sprout 闪念笔记' and f.get('type') == 'folder':
        print(f['token'])
        break
else:
    print('')
" 2>/dev/null)

    if [[ -z "$folder_token" ]]; then
        # No folder yet — also check root for orphan docs (legacy)
        local doc_id
        doc_id=$(curl -s "$BASE/drive/v1/files?folder_token=$root_token&page_size=100" \
            -H "Authorization: Bearer $token" \
            | python3 -c "
import sys, json
data = json.load(sys.stdin)
files = data.get('data', {}).get('files', [])
for f in files:
    if f.get('name') == '$title' and f.get('type') == 'docx':
        print(f['token'])
        break
else:
    print('NOT_FOUND')
" 2>/dev/null)
        echo "$doc_id"
        return
    fi

    # Step 3: List files in the Sprout folder, match today's doc
    local doc_id
    doc_id=$(curl -s "$BASE/drive/v1/files?folder_token=$folder_token&page_size=100" \
        -H "Authorization: Bearer $token" \
        | python3 -c "
import sys, json
data = json.load(sys.stdin)
files = data.get('data', {}).get('files', [])
for f in files:
    if f.get('name') == '$title' and f.get('type') == 'docx':
        print(f['token'])
        break
else:
    print('NOT_FOUND')
" 2>/dev/null)
    echo "$doc_id"
}

read_doc() {
    local doc_id="$1"
    local token
    token=$(get_token)

    # Get all blocks from the document
    local resp
    resp=$(curl -s "$BASE/docx/v1/documents/$doc_id/blocks?page_size=500" \
        -H "Authorization: Bearer $token")

    # Extract text content from all text blocks
    echo "$resp" | python3 -c "
import sys, json

data = json.load(sys.stdin)
if data.get('code') != 0:
    print('ERROR:', data.get('msg', 'unknown error'))
    sys.exit(1)

blocks = data.get('data', {}).get('items', [])
output = []

for block in blocks:
    bt = block.get('block_type')
    text_content = None

    # block_type 2=text, 3=h1, 4=h2, 5=h3, 6=h4...
    for key in ['text', 'heading1', 'heading2', 'heading3', 'heading4',
                'heading5', 'heading6', 'heading7', 'heading8', 'heading9']:
        section = block.get(key)
        if section:
            elements = section.get('elements', [])
            parts = []
            for el in elements:
                tr = el.get('text_run', {})
                if tr.get('content'):
                    parts.append(tr['content'])
            if parts:
                prefix = ''
                if key.startswith('heading'):
                    level = key.replace('heading', '')
                    prefix = '#' * int(level) + ' '
                text_content = prefix + ''.join(parts)
            break

    if bt == 22:  # divider
        text_content = '---'

    if text_content:
        output.append(text_content)

print('\n'.join(output))
"
}

append_divider() {
    local doc_id="$1"
    local token
    token=$(get_token)

    curl -s -X POST "$BASE/docx/v1/documents/$doc_id/blocks/$doc_id/children" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d '{"children":[{"block_type":22,"divider":{}}]}' > /dev/null
}

append_heading() {
    local doc_id="$1"
    local text="$2"
    local token
    token=$(get_token)

    # Escape JSON special chars
    local escaped
    escaped=$(python3 -c "import json; print(json.dumps($( python3 -c "import sys; print(repr(sys.stdin.read()))" <<< "$text" )))" 2>/dev/null || echo "\"$text\"")

    curl -s -X POST "$BASE/docx/v1/documents/$doc_id/blocks/$doc_id/children" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{\"children\":[{\"block_type\":4,\"heading2\":{\"elements\":[{\"text_run\":{\"content\":$escaped}}],\"style\":{}}}]}" > /dev/null
}

append_text() {
    local doc_id="$1"
    local text="$2"
    local token
    token=$(get_token)

    # Feishu has a block text limit. Split into chunks if needed.
    python3 -c "
import json, sys, urllib.request

text = sys.stdin.read().strip()
token = '$token'
doc_id = '$doc_id'
base = '$BASE'

# Split into ~2000 char chunks (Feishu limit per text block)
chunks = []
while text:
    chunks.append(text[:2000])
    text = text[2000:]

for chunk in chunks:
    body = json.dumps({
        'children': [{
            'block_type': 2,
            'text': {
                'elements': [{'text_run': {'content': chunk}}],
                'style': {}
            }
        }]
    }).encode()

    req = urllib.request.Request(
        f'{base}/docx/v1/documents/{doc_id}/blocks/{doc_id}/children',
        data=body,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        },
        method='POST'
    )
    urllib.request.urlopen(req)
" <<< "$text"
}

append_section() {
    local doc_id="$1"
    local heading="$2"
    local body="$3"

    append_heading "$doc_id" "$heading"
    if [[ -n "$body" ]]; then
        append_text "$doc_id" "$body"
    fi
}

# --- Main dispatcher ---
CMD="${1:-}"
shift || true

case "$CMD" in
    token)
        get_token
        ;;
    find-doc)
        find_doc "${1:-}"
        ;;
    read-doc)
        read_doc "${1:-}"
        ;;
    append-divider)
        append_divider "${1:-}"
        ;;
    append-heading)
        append_heading "${1:-}" "${2:-}"
        ;;
    append-text)
        append_text "${1:-}" "${2:-}"
        ;;
    append-section)
        append_section "${1:-}" "${2:-}" "${3:-}"
        ;;
    *)
        echo "Usage: feishu-api.sh {token|find-doc|read-doc|append-divider|append-heading|append-text|append-section}" >&2
        exit 1
        ;;
esac
