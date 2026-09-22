import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseServerInfo, infoRequest, VerificationError, simulateVerification } from '../src/connection/amnet.ts';
import { DEFAULT_PREFERENCES, SAMPLE_SERVERS, BLANK_FORM, DISCOVERED_SERVERS, parseSavedState, normalizePreferences, getAddress, addDiscoveredServer, validateForm } from '../src/data/servers.ts';
import { resolveScene, SCENES } from '../src/data/scenes.ts';

const info = { apiVersion: 1, gameId: null, serverName: 'AMNET-SERVER', sessionUptime: 120, timeSinceLastPoll: null };
test('AMNet uses GET /amnet/info, explicit JSON accept, no body or card endpoint', () => {
  assert.deepEqual(infoRequest(SAMPLE_SERVERS[0]), {
    method: 'GET', url: 'http://192.168.1.8:6070/amnet/info', headers: { Accept: 'application/json' },
  });
  assert.equal(BLANK_FORM.port, '6070');
});
test('valid v1 info accepts nullable game status without treating it as offline', () => {
  assert.deepEqual(parseServerInfo(200, info), info);
  assert.equal(parseServerInfo(200, { ...info, gameId: 'SDEZ', timeSinceLastPoll: 9999 }).timeSinceLastPoll, 9999);
});
test('wrong status, version, malformed JSON fields and unsupported game identifiers are rejected', () => {
  assert.throws(() => parseServerInfo(503, info), (e: unknown) => e instanceof VerificationError && e.code === 'http');
  assert.throws(() => parseServerInfo(200, { ...info, apiVersion: 2 }), (e: unknown) => e instanceof VerificationError && e.code === 'version');
  for (const body of [null, [], {}, 'invalid JSON', { ...info, gameId: 'sdez' }, { ...info, gameId: 'AB12' },
    { ...info, serverName: 'x'.repeat(17) }, { ...info, sessionUptime: -1 }, { ...info, sessionUptime: 0.5 },
    { ...info, timeSinceLastPoll: undefined }, { ...info, timeSinceLastPoll: -1 }]) {
    assert.throws(() => parseServerInfo(200, body), VerificationError);
  }
});
test('legacy storage migrates custom servers and autoConnect, removing obsolete transport fields', () => {
  const legacy = { servers: [{ ...SAMPLE_SERVERS[0], port: 9876, tls: true, httpPath: '/health', lastSuccess: 123 }, SAMPLE_SERVERS[1]],
    lastSuccessId: 'media', autoConnect: false };
  const migrated = parseSavedState(JSON.stringify(legacy));
  assert.equal(migrated.servers.length, 2);
  assert.equal(migrated.servers[0].port, 9876);
  assert.equal(migrated.servers[0].lastSuccess, 123);
  assert.equal(migrated.lastSuccessId, 'media');
  assert.equal(migrated.preferences.autoConnect, false);
  assert.equal(migrated.preferences.httpMode, 'demand');
  assert.equal('tls' in migrated.servers[0], false);
  assert.equal('httpPath' in migrated.servers[0], false);
  assert.equal(getAddress(migrated.servers[0]), 'http://192.168.1.8:9876/amnet/info');
  assert.equal(migrated.servers[1].wsPath, '/ws');
});
test('empty lists stay empty; corrupt storage falls back safely; invalid records do not lose valid ones', () => {
  assert.deepEqual(parseSavedState('{"servers":[],"lastSuccessId":"study"}').servers, []);
  assert.equal(parseSavedState('broken').servers.length, 2);
  const state = parseSavedState(JSON.stringify({ servers: [null, {}, SAMPLE_SERVERS[0]], lastSuccessId: 'missing' }));
  assert.equal(state.servers.length, 1);
  assert.equal(state.lastSuccessId, null);
});
test('all preferences survive persistence, invalid bounds are normalized individually', () => {
  const preferences = { ...DEFAULT_PREFERENCES, autoConnect: false, autoReconnect: true, httpMode: 'poll', pollIntervalSeconds: 12, warnWhenStale: true, staleAfterSeconds: 99, retryIntervalSeconds: 8 };
  assert.deepEqual(parseSavedState(JSON.stringify({ servers: [], preferences })).preferences, preferences);
  assert.deepEqual(normalizePreferences({ pollIntervalSeconds: 0, retryIntervalSeconds: Infinity, staleAfterSeconds: -3, autoConnect: 'no', httpMode: 'unknown' }), DEFAULT_PREFERENCES);
  assert.equal(normalizePreferences({ staleAfterSeconds: 86400 }).staleAfterSeconds, 86400);
  assert.equal(normalizePreferences({ staleAfterSeconds: 86401 }).staleAfterSeconds, 60);
});
test('discovery saves one HTTP entry immediately and deduplicates by host and port', () => {
  const first = addDiscoveredServer([...SAMPLE_SERVERS], DISCOVERED_SERVERS[0]);
  assert.equal(first.servers.length, 3);
  assert.equal(first.server.mode, 'http');
  const duplicate = addDiscoveredServer(first.servers, { ...DISCOVERED_SERVERS[0], id: 'other-scan-id' });
  assert.equal(duplicate.servers, first.servers);
  assert.equal(duplicate.server.id, first.server.id);
  assert.equal(duplicate.server.lastSuccess, undefined);
});
test('address generation respects independent WS paths and IPv6', () => {
  assert.equal(getAddress({ ...SAMPLE_SERVERS[0], host: '2001:db8::1' }), 'http://[2001:db8::1]:6070/amnet/info');
  assert.equal(getAddress({ ...SAMPLE_SERVERS[1], wsPath: '/events' }), 'ws://192.168.1.100:8080/events');
});
test('rediscovery after editing the old endpoint does not reuse its id or overwrite custom ports', () => {
  const first = addDiscoveredServer([], DISCOVERED_SERVERS[0]);
  const edited = { ...first.server, port: 9876 };
  const result = addDiscoveredServer([edited], DISCOVERED_SERVERS[0]);
  assert.equal(result.servers.length, 2);
  assert.notEqual(result.server.id, edited.id);
  assert.equal(result.servers[0].port, 9876);
  assert.equal(result.server.port, 6070);
});
test('form validation accepts real hosts and native pasted fields, rejects listen addresses and full URLs', () => {
  const form = { ...BLANK_FORM, name: 'My server', host: '192.168.1.8' };
  assert.deepEqual(validateForm(form), {});
  for (const host of ['0.0.0.0', '::', '[::]', 'http://host:6070', '999.2.3.4', 'user@host', 'host/path']) {
    assert.ok(validateForm({ ...form, host }).host);
  }
  assert.ok(validateForm({ ...form, port: '0' }).port);
  assert.ok(validateForm({ ...form, mode: 'ws', wsPath: 'events' }).path);
});
test('old links normalize to canonical connection states; deleted scenes are not in the catalogue', () => {
  for (const hash of ['#/home', '#/retry-success', '#/http-stale']) assert.equal(resolveScene(hash), 'connected');
  assert.equal(resolveScene('#/canceled'), 'disconnected');
  assert.equal(resolveScene('#/settings'), 'settings');
  assert.equal(resolveScene('#/unknown', 'unconfigured'), 'unconfigured');
  assert.equal(resolveScene('#/constructor'), 'connected');
  assert.equal(resolveScene('#/__proto__'), 'connected');
  assert.equal(SCENES.length, 18);
  assert.equal(new Set(SCENES.map(s => s.id)).size, SCENES.length);
});
test('simulated transport immediately honors already canceled requests', async () => {
  const abort = new AbortController(); abort.abort();
  await assert.rejects(simulateVerification(SAMPLE_SERVERS[0], abort.signal, 'success'), { name: 'AbortError' });
});
