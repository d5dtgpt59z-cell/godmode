/** Bounded unattended writer. Credentials arrive on hidden stdin and are never saved. */
const ALLOWED_ORIGIN = 'https://godmode-by-magnus.magnusrobot.chatgpt.site';

async function input() {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdout.write('Ready for world updater JSON on stdin (input is hidden).\n');
  return await new Promise((resolve, reject) => {
    let buffer = '';
    const onData = chunk => {
      buffer += chunk;
      if (buffer.includes('\u0003') || buffer.length > 64000) return done(new Error('Input cancelled or too large.'));
      if (buffer.includes('\n')) {
        try { done(null, JSON.parse(buffer.slice(0, buffer.indexOf('\n')))); }
        catch { done(new Error('Updater input must be valid JSON.')); }
      }
    };
    const done = (error, value) => {
      process.stdin.off('data', onData);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      if (error) reject(error); else resolve(value);
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  const settings = await input();
  const origin = new URL(settings.origin);
  if (origin.origin !== ALLOWED_ORIGIN || origin.username || origin.password || origin.search || origin.hash) throw new Error('Updater origin does not match this Site.');
  if (typeof settings.bearerToken !== 'string' || settings.bearerToken.length < 16) throw new Error('Supported Site service access is required.');
  const maxCalls = Math.min(30, Math.max(1, Math.floor(settings.maxCalls ?? 30)));
  const headers = { 'OAI-Sites-Authorization': `Bearer ${settings.bearerToken}` };
  async function call(path, body) {
    const response = await fetch(origin.origin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error', signal: AbortSignal.timeout(25000),
    });
    if (response.status === 409) return { contention: true };
    if (!response.ok) throw new Error(`World updater received HTTP ${response.status}.`);
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The updater did not receive JSON.');
    return await response.json();
  }
  let result = await call('/api/world');
  if (!result.world) throw new Error('Create the saved world before enabling its updater.');
  const fromTick = result.world.run.state.tick;
  let calls = 0, contention = false;
  while (calls < maxCalls && !result.world.paused && result.world.clock.dueSeconds > 0) {
    const next = await call('/api/world/tick', { maxSeconds: 60 });
    calls++;
    if (next.contention) { contention = true; break; }
    if (!next.world) throw new Error('The saved world disappeared during an update.');
    const progressed = next.world.run.state.tick > result.world.run.state.tick;
    result = next;
    if (!progressed) break;
  }
  const readback = await call('/api/world');
  if (readback.world) result = readback;
  console.log(JSON.stringify({ calls, contention, fromTick, toTick: result.world.run.state.tick,
    advancedSeconds: result.world.run.state.tick - fromTick, paused: result.world.paused,
    dueSecondsRemaining: result.world.clock.dueSeconds,
    lastBackgroundTickAt: result.world.clock.lastBackgroundTickAt,
    lastJob: result.world.history[0] ? { id: result.world.history[0].id, source: result.world.history[0].source, status: result.world.history[0].status } : null,
    modelCalls: 0 }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'The updater failed.'); process.exitCode = 1; });
