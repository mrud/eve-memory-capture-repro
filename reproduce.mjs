import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const version = JSON.parse(readFileSync('node_modules/eve/package.json')).version;
const port = Number(process.env.REPRO_PORT || 21871);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/eve/bin/eve.js', 'dev', '--no-ui', '--host', '127.0.0.1', '--port', String(port)], {
  env: { ...process.env, EVE_LOG_LEVEL: 'debug' },
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
for (const output of [server.stdout, server.stderr]) output.on('data', chunk => { logs += chunk; });
const events = [];
mkdirSync('results', { recursive: true });
try {
  let ready = false;
  for (let i = 0; i < 180; i++) {
    if (server.exitCode !== null) throw Error(`Server exited: ${server.exitCode}`);
    try {
      const response = await fetch(`${base}/eve/v1/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(1000);
  }
  if (!ready) throw Error('Server did not become ready within 180 seconds');
  console.log(`eve ${version}: server ready`);
  const response = await fetch(`${base}/eve/v1/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Remember that I prefer short replies.' }),
  });
  const session = await response.json();
  if (!response.ok || !session.sessionId) throw Error(`Session rejected: ${JSON.stringify(session)}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  let completed = false;
  try {
    const stream = await fetch(`${base}/eve/v1/session/${session.sessionId}/stream`, { signal: controller.signal });
    if (!stream.ok) throw Error(`Stream status: ${stream.status}`);
    let buffer = '';
    outer: for await (const chunk of stream.body) {
      buffer += new TextDecoder().decode(chunk);
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line); events.push(event);
        console.log(`event: ${event.type}`);
        if (event.type === 'turn.completed') completed = true;
        if (event.type === 'session.failed' || event.type === 'turn.failed') throw Error(`Turn failed: ${line}`);
        if (completed && event.type === 'session.waiting') break outer;
      }
    }
  } finally { clearTimeout(timeout); controller.abort(); }
  await delay(1000);
  const recall = (logs.match(/REPRO_RECALL_CALLED/g) || []).length;
  const capture = (logs.match(/REPRO_CAPTURE_CALLED/g) || []).length;
  const result = { version, completed, recall, capture };
  writeFileSync(`results/${version}.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (!completed || recall < 1) throw Error('Inconclusive: turn completion and recall must both run');
  if (capture < 1) { console.error('FAIL: turn completed and recall ran, but capture never ran.'); process.exitCode = 1; }
  else console.log('PASS: capture ran after the completed turn.');
} catch (error) {
  console.error(error);
  console.error(logs.slice(-8000));
  process.exitCode = 2;
} finally {
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
  await delay(500);
  writeFileSync(`results/${version}.log`, logs);
  writeFileSync(`results/${version}.events.json`, JSON.stringify(events, null, 2) + '\n');
}
