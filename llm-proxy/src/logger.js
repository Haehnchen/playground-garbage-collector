const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');

const logsDir = path.join(__dirname, '..', 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function extractSessionId(body) {
  const userId = body?.metadata?.user_id;
  if (!userId) return null;
  const match = userId.match(/_session_(.*)/);
  return match ? match[1] : null;
}

function parseSSE(raw) {
  const content = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      const data = JSON.parse(line.slice(6));
      if (data.type === 'content_block_start' && data.content_block) {
        const block = { ...data.content_block };
        for (const key of Object.keys(block)) {
          if (block[key] !== null && typeof block[key] === 'object') block[key] = '';
        }
        content[data.index] = block;
      } else if (data.type === 'content_block_delta' && data.delta && content[data.index]) {
        const block = content[data.index];
        const { type, ...fields } = data.delta;
        for (const [key, value] of Object.entries(fields)) {
          block[key] = (block[key] || '') + value;
        }
      }
    } catch (e) {}
  }

  for (const block of content) {
    if (!block) continue;
    if (block.partial_json !== undefined) {
      try { block.input = JSON.parse(block.partial_json); } catch (e) { block.input = block.partial_json; }
      delete block.partial_json;
    }
  }

  return content.length > 0 ? content : null;
}

function parseJSON(raw) {
  try {
    const data = JSON.parse(raw);
    if (data.content) return data.content;
    if (data.choices?.[0]?.message) return data.choices[0].message.content;
  } catch (e) {}
  return null;
}

function teeStreamAndLog(stream, requestBody, contentType) {
  const sessionId = extractSessionId(requestBody);
  const passThrough = new PassThrough();

  if (!sessionId || !requestBody.messages) {
    stream.pipe(passThrough);
    return passThrough;
  }

  const isSSE = contentType && contentType.includes('text/event-stream');

  const chunks = [];
  stream.on('data', (chunk) => {
    chunks.push(chunk);
    passThrough.write(chunk);
  });
  stream.on('end', () => {
    passThrough.end();

    const logFile = path.join(logsDir, `${sessionId}.json`);
    const messages = [...requestBody.messages];

    const raw = Buffer.concat(chunks).toString('utf8');
    const content = isSSE ? parseSSE(raw) : parseJSON(raw);

    if (content) {
      messages.push({ role: 'assistant', content });
    }

    fs.writeFileSync(logFile, JSON.stringify({ sessionId, messages }, null, 2));
  });
  stream.on('error', (err) => {
    passThrough.destroy(err);
  });

  return passThrough;
}

module.exports = { teeStreamAndLog };
