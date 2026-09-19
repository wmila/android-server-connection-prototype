import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionController, type Clock } from '../src/connection/ConnectionController.ts';
import { DEFAULT_PREFERENCES, SAMPLE_SERVERS, type Preferences } from '../src/data/servers.ts';
import type { ServerInfo, VerifyServer } from '../src/connection/amnet.ts';

const http = SAMPLE_SERVERS[0];
const ws = SAMPLE_SERVERS[1];
const info: ServerInfo = { apiVersion: 1, gameId: null, serverName: 'AMNET', sessionUptime: 120, timeSinceLastPoll: null };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
class FakeClock implements Clock {
  time = 100000;
  nextId = 0;
  tasks = new Map<number, { at: number; run: () => void }>();
  now = () => this.time;
  setTimeout = (run: () => void, ms: number) => {
    const id = ++this.nextId;
    this.tasks.set(id, { at: this.time + ms, run });
    return id;
  };
  clearTimeout = (id: unknown) => { this.tasks.delete(id as number); };
  async advance(ms: number) {
    const end = this.time + ms;
    while (true) {
      const next = [...this.tasks.entries()].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.time = next[1].at;
      this.tasks.delete(next[0]);
      next[1].run();
      await flush();
    }
    this.time = end;
    await flush();
  }
}
function setup(patch: Partial<Preferences> = {}, verify?: VerifyServer) {
  const clock = new FakeClock();
  const preferences = { ...DEFAULT_PREFERENCES, ...patch };
  let successCount = 0;
  const controller = new ConnectionController(preferences, verify || (async () => info), () => successCount++, clock);
  return { controller, clock, preferences, successes: () => successCount };
}

test('default demand verifies once, remains green indefinitely, and no recheck without stale warning', async () => {
  const { controller: c, clock } = setup();
  c.connect(http);
  await flush();
  const first = c.getSnapshot().lastVerifiedAt;
  await clock.advance(86400000);
  c.recheck();
  assert.equal(c.getSnapshot().validationCount, 1);
  assert.equal(c.getSnapshot().status, 'connected');
  assert.equal(c.getSnapshot().stale, false);
  assert.equal(c.getSnapshot().lastVerifiedAt, first);
  assert.equal(clock.tasks.size, 0);
});
test('expiry is local, nullable AMNet game polling time is not an offline signal', async () => {
  const { controller: c, clock } = setup({ warnWhenStale: true, staleAfterSeconds: 10 });
  c.connect(http); await flush();
  await clock.advance(9999); assert.equal(c.getSnapshot().stale, false);
  await clock.advance(1); assert.equal(c.getSnapshot().stale, true);
  assert.equal(c.getSnapshot().status, 'connected');
  assert.equal(c.getSnapshot().validationCount, 1);
  c.recheck(); c.recheck(); await flush();
  assert.equal(c.getSnapshot().validationCount, 2);
  assert.equal(c.getSnapshot().stale, false);
  await clock.advance(10000);
  assert.equal(c.getSnapshot().stale, true);
  assert.equal(c.getSnapshot().validationCount, 2);
});
test('expiry preferences re-evaluate display only; increasing duration restores unexpired appearance', async () => {
  const { controller: c, clock, preferences: p } = setup({ staleAfterSeconds: 10 });
  c.connect(http); await flush(); await clock.advance(10000);
  c.setPreferences({ ...p, warnWhenStale: true });
  assert.equal(c.getSnapshot().stale, true);
  c.setPreferences({ ...p, warnWhenStale: true, staleAfterSeconds: 30 });
  assert.equal(c.getSnapshot().stale, false);
  await clock.advance(20000);
  assert.equal(c.getSnapshot().stale, true);
  c.setPreferences({ ...p, warnWhenStale: false });
  assert.equal(c.getSnapshot().stale, false);
  assert.equal(c.getSnapshot().validationCount, 1);
  assert.equal(clock.tasks.size, 0);
});
test('failed explicit recheck disconnects, and disabling warnings cannot turn known offline green', async () => {
  let fail = false;
  const { controller: c, clock, preferences: p } = setup({ warnWhenStale: true, staleAfterSeconds: 1 }, async () => {
    if (fail) throw new Error('offline');
    return info;
  });
  c.connect(http); await flush(); await clock.advance(1000);
  fail = true; c.recheck(); await flush();
  assert.equal(c.getSnapshot().status, 'disconnected');
  c.setPreferences({ ...p, warnWhenStale: false });
  assert.equal(c.getSnapshot().status, 'disconnected');
  await clock.advance(10000);
  assert.equal(c.getSnapshot().validationCount, 2);
});
test('polling defaults to 5 seconds and can be changed without accumulating timers', async () => {
  const { controller: c, clock, preferences: p } = setup({ httpMode: 'poll' });
  c.connect(http); await flush();
  await clock.advance(4999); assert.equal(c.getSnapshot().validationCount, 1);
  await clock.advance(1); assert.equal(c.getSnapshot().validationCount, 2);
  c.setPreferences({ ...p, pollIntervalSeconds: 2 });
  await clock.advance(6000);
  assert.equal(c.getSnapshot().validationCount, 5);
  assert.equal(clock.tasks.size, 1);
  c.setPreferences({ ...p, httpMode: 'demand' });
  await clock.advance(20000);
  assert.equal(c.getSnapshot().validationCount, 5);
  assert.equal(clock.tasks.size, 0);
});
test('switching demand to polling starts only one timer; returning to demand aborts an in-flight poll', async () => {
  let finish: (value: ServerInfo) => void = () => {};
  let pollSignal: AbortSignal | undefined;
  let requests = 0;
  const { controller: c, clock, preferences: p } = setup({}, async (_, signal) => {
    if (++requests === 1) return info;
    pollSignal = signal;
    return new Promise(resolve => { finish = resolve; });
  });
  c.connect(http); await flush();
  c.setPreferences({ ...p, httpMode: 'poll' });
  c.setPreferences({ ...p, httpMode: 'poll' });
  await clock.advance(5000);
  assert.equal(requests, 2);
  c.setPreferences(p);
  assert.equal(pollSignal?.aborted, true);
  const verifiedAt = c.getSnapshot().lastVerifiedAt;
  finish(info); await flush(); await clock.advance(60000);
  assert.equal(c.getSnapshot().lastVerifiedAt, verifiedAt);
  assert.equal(requests, 2);
  assert.equal(c.getSnapshot().checking, false);
});
test('known polling failure disconnects without continuing periodic checks', async () => {
  let requests = 0;
  const { controller: c, clock } = setup({ httpMode: 'poll' }, async () => {
    if (++requests > 1) throw new Error('unreachable');
    return info;
  });
  c.connect(http); await flush(); await clock.advance(5000);
  assert.equal(c.getSnapshot().status, 'disconnected');
  await clock.advance(60000); assert.equal(requests, 2);
});
test('cancel ignores late connection response and does not update last success', async () => {
  let finish: (value: ServerInfo) => void = () => {};
  let signal: AbortSignal | undefined;
  const { controller: c, clock, successes } = setup({ autoReconnect: true }, async (_, value) => {
    signal = value;
    return new Promise(resolve => { finish = resolve; });
  });
  c.connect(http); c.disconnect(); finish(info); await flush(); await clock.advance(60000);
  assert.equal(signal?.aborted, true);
  assert.equal(c.getSnapshot().status, 'disconnected');
  assert.equal(successes(), 0);
  assert.equal(c.getSnapshot().server?.id, http.id);
  assert.equal(clock.tasks.size, 0);
});
test('switching targets ignores the old response', async () => {
  const pending: ((value: ServerInfo) => void)[] = [];
  const { controller: c, successes } = setup({}, async () => new Promise(resolve => pending.push(resolve)));
  c.connect(http); c.connect(ws);
  pending[0](info); await flush();
  assert.equal(c.getSnapshot().status, 'connecting');
  assert.equal(successes(), 0);
  pending[1](info); await flush();
  assert.equal(c.getSnapshot().server?.id, ws.id);
  assert.equal(successes(), 1);
});
test('failure retries use independent interval, stop after total 3 attempts', async () => {
  const { controller: c, clock } = setup({ autoReconnect: true, retryIntervalSeconds: 2 }, async () => { throw new Error('timeout'); });
  c.connect(http); await flush();
  assert.equal(c.getSnapshot().status, 'retry-wait');
  await clock.advance(1999); assert.equal(c.getSnapshot().validationCount, 1);
  await clock.advance(1); assert.equal(c.getSnapshot().validationCount, 2);
  await clock.advance(2000); assert.equal(c.getSnapshot().validationCount, 3);
  assert.equal(c.getSnapshot().status, 'failed');
  await clock.advance(60000);
  assert.equal(c.getSnapshot().validationCount, 3);
});
test('successful retry uses ordinary connected status', async () => {
  let requests = 0;
  const { controller: c, clock } = setup({ autoReconnect: true, retryIntervalSeconds: 1 }, async () => {
    if (++requests === 1) throw new Error('timeout');
    return info;
  });
  c.connect(http); await flush(); await clock.advance(1000);
  assert.equal(c.getSnapshot().status, 'connected');
  assert.equal(c.getSnapshot().attempt, 2);
  assert.equal(c.getSnapshot().stale, false);
});
test('canceling retry wait and manual disconnection prevent any future reconnect', async () => {
  const { controller: c, clock } = setup({ autoReconnect: true }, async () => { throw new Error('timeout'); });
  c.connect(http); await flush(); c.disconnect(); await clock.advance(60000);
  assert.equal(c.getSnapshot().status, 'disconnected');
  assert.equal(c.getSnapshot().validationCount, 1);
  c.preview(http, 'connected'); c.disconnect(); await clock.advance(60000);
  assert.equal(c.getSnapshot().validationCount, 1);
});
test('changing retry interval replaces the old timer and disabling retries cancels wait', async () => {
  const { controller: c, clock, preferences: p } = setup({ autoReconnect: true }, async () => { throw new Error('timeout'); });
  c.connect(http); await flush();
  c.setPreferences({ ...p, retryIntervalSeconds: 2 });
  await clock.advance(2000); assert.equal(c.getSnapshot().validationCount, 2);
  c.setPreferences({ ...p, autoReconnect: false });
  await clock.advance(60000); assert.equal(c.getSnapshot().validationCount, 2);
  assert.equal(c.getSnapshot().status, 'disconnected');
});
test('WebSocket ignores all HTTP expiry and polling preferences; remote disconnect is unified', async () => {
  const { controller: c, clock, preferences: p } = setup({ httpMode: 'poll', warnWhenStale: true, staleAfterSeconds: 1 });
  c.connect(ws); await flush(); await clock.advance(60000);
  c.setPreferences({ ...p, httpMode: 'demand' }); await clock.advance(60000);
  assert.equal(c.getSnapshot().stale, false);
  assert.equal(c.getSnapshot().validationCount, 1);
  c.remoteDisconnect();
  assert.equal(c.getSnapshot().status, 'disconnected');
});
test('failed explicit retest is one request even with automatic reconnection enabled', async () => {
  let requests = 0;
  const { controller: c, clock } = setup({ autoReconnect: true, warnWhenStale: true, staleAfterSeconds: 1 }, async () => {
    if (++requests > 1) throw new Error('offline');
    return info;
  });
  c.connect(http); await flush(); await clock.advance(1000);
  c.recheck(); await flush(); await clock.advance(60000);
  assert.equal(requests, 2);
  assert.equal(c.getSnapshot().status, 'disconnected');
});
test('detected loss of an established connection remains disconnected after 3 failed recovery attempts', async () => {
  const { controller: c, clock } = setup({ autoReconnect: true, retryIntervalSeconds: 1 }, async () => { throw new Error('offline'); });
  c.preview(http, 'connected'); c.remoteDisconnect();
  await clock.advance(3000);
  assert.equal(c.getSnapshot().validationCount, 3);
  assert.equal(c.getSnapshot().status, 'disconnected');
  await clock.advance(10000);
  assert.equal(c.getSnapshot().validationCount, 3);
});
test('navigation subscribers can detach/reattach without canceling an ongoing request or its expiry', async () => {
  let finish: (value: ServerInfo) => void = () => {};
  const { controller: c, clock } = setup({ warnWhenStale: true, staleAfterSeconds: 1 }, async () => new Promise(resolve => { finish = resolve; }));
  const unsubscribe = c.subscribe(() => {});
  c.connect(http);
  unsubscribe(); // old page unmounts
  let updates = 0;
  c.subscribe(() => updates++); // settings page mounts
  finish(info); await flush(); await clock.advance(1000);
  assert.equal(c.getSnapshot().status, 'connected');
  assert.equal(c.getSnapshot().stale, true);
  assert.equal(c.getSnapshot().validationCount, 1);
  assert.ok(updates > 0);
});
test('dispose aborts work; fixture preview never records a fabricated last-success server', async () => {
  let finish: (value: ServerInfo) => void = () => {};
  const { controller: c, successes, clock } = setup({}, async () => new Promise(resolve => { finish = resolve; }));
  c.preview(http, 'connected');
  assert.equal(successes(), 0);
  c.connect(http); c.dispose(); finish(info); await flush();
  assert.equal(successes(), 0);
  assert.equal(clock.tasks.size, 0);
});
