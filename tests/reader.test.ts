import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConnectionController } from '../src/connection/ConnectionController.ts';
import { DEFAULT_PREFERENCES, SAMPLE_SERVERS } from '../src/data/servers.ts';
import type { VerifyServer, ServerInfo } from '../src/connection/amnet.ts';
import { ReaderStore, type SubmitOutcome } from '../src/reader/ReaderStore.ts';
import { signInRequest } from '../src/reader/transport.ts';
import { defaultRule, deleteCard, emptyWallet, parseWallet, readingKey, resolveReading, SAMPLE_READING, saveCard, validNumber, type WalletCard } from '../src/reader/model.ts';

const card: WalletCard = { id: 'test', name: '测试卡', kind: 'Access Code', number: '00000000000000000001', accent: '#74547f' };
const info: ServerInfo = { apiVersion: 1, gameId: null, serverName: 'TEST', sessionUptime: 1, timeSinceLastPoll: null };
test('AMNet submission describes only cardId and never forwards trigger IDm', () => {
  const request = signInRequest(SAMPLE_SERVERS[0], card);
  assert.equal(request.method, 'POST'); assert.equal(request.url, 'http://192.168.1.8:6070/amnet/signin');
  assert.deepEqual(JSON.parse(request.body), { cardId: card.number });
  assert.throws(() => signInRequest(SAMPLE_SERVERS[1], card), /尚未定义/);
});
test('removing the last server clears the shared target', async () => {
  const t = setup(); t.connection.clearServer(); await t.store.send(card);
  assert.equal(t.connection.getSnapshot().server, null); assert.equal(t.sent.length, 0); t.stop();
});
function setup(verify: VerifyServer = async () => info, outcome: SubmitOutcome = 'accepted') {
  const connection = new ConnectionController(DEFAULT_PREFERENCES, verify, () => {});
  const sent: { server: string; number: string }[] = [];
  const store = new ReaderStore(connection, async (server, card) => { sent.push({ server: server.id, number: card.number }); return outcome; });
  store.start(); connection.preview(SAMPLE_SERVERS[0], 'connected');
  return { connection, store, sent, stop: () => { store.dispose(); connection.dispose(); } };
}
test('card validation preserves zeros and distinguishes Access Code, IDm and UID', () => {
  assert.equal(validNumber('Access Code', card.number), true);
  assert.equal(validNumber('Access Code', 'AAAAAAAAAAAAAAAAAAAA'), false);
  assert.equal(validNumber('Access Code', '１２３４５６７８９０１２３４５６７８９０'), false);
  assert.equal(validNumber('IDm', SAMPLE_READING.source), true);
  assert.equal(validNumber('UID', '00112233445566'), true);
  assert.equal(validNumber('UID', SAMPLE_READING.source), false);
  assert.equal(saveCard(emptyWallet(), card).cards[0].number, card.number);
  assert.throws(() => saveCard(saveCard(emptyWallet(), card), { ...card, id: 'other' }), /已在卡包/);
});
test('missing mappings never fall back and identifier-only cannot decode Access Code', () => {
  const rule = { ...defaultRule(), rule: 'mapping' as const, mappingMode: 'fixed' as const, fixedCardId: card.id };
  assert.equal(resolveReading(SAMPLE_READING, rule, [card]).number, card.number);
  assert.throws(() => resolveReading(SAMPLE_READING, rule, []), /固定卡号/);
  assert.throws(() => resolveReading(SAMPLE_READING, { ...rule, mappingMode: 'per-card' }, [card]), /尚未绑定/);
  const bound = { ...rule, mappingMode: 'per-card' as const, bindings: [{ id: 'b', ...SAMPLE_READING, cardId: card.id }] };
  assert.equal(resolveReading(SAMPLE_READING, bound, [card]).number, card.number);
  assert.throws(() => resolveReading({ ...SAMPLE_READING, access: undefined }, defaultRule(), [card]), /未能读取/);
});
test('wallet persistence and deletion preserve decisions and clean all server references', () => {
  const data = saveCard(emptyWallet(), card); data.asked = [readingKey(SAMPLE_READING)];
  data.rules.a = { ...defaultRule(), fixedCardId: card.id, bindings: [{ id: 'b', source: SAMPLE_READING.source, kind: 'IDm', cardId: card.id }] };
  data.rules.b = { ...data.rules.a, mappingMode: 'fixed' };
  const parsed = parseWallet(JSON.stringify(data)); assert.equal(parsed.cards[0].number, card.number);
  const deleted = deleteCard(parsed, card.id); assert.deepEqual(deleted.asked, data.asked);
  assert.equal(deleted.rules.a.bindings.length, 0); assert.equal(deleted.rules.b.fixedCardId, '');
  assert.deepEqual(parseWallet(JSON.stringify(deleted)).cards, []); assert.deepEqual(parseWallet('{'), emptyWallet());
});
test('explicit send validates exactly once and bypasses NFC mapping', async () => {
  const t = setup(); t.store.update({ ...emptyWallet(), rules: { study: { ...defaultRule(), rule: 'mapping' } } });
  await t.store.send(card); assert.equal(t.connection.getSnapshot().validationCount, 1);
  assert.deepEqual(t.sent, [{ server: 'study', number: card.number }]);
  assert.match(t.store.getSnapshot().result, /服务器已接收，请在游戏端确认/); t.stop();
});
test('unsupported, invalid and disconnected sends never probe or submit', async () => {
  const t = setup(); await t.store.send({ kind: 'IDm', number: SAMPLE_READING.source });
  await t.store.send({ kind: 'Access Code', number: '1' }); assert.equal(t.connection.getSnapshot().validationCount, 0);
  t.connection.disconnect(); await t.store.send(card); assert.equal(t.sent.length, 0); t.stop();
});
test('failed preflight has no automatic submission or verification retries', async () => {
  const t = setup(async () => { throw new Error('offline'); }); t.connection.setPreferences({ ...DEFAULT_PREFERENCES, autoReconnect: true });
  await t.store.send(card); assert.equal(t.sent.length, 0); assert.equal(t.connection.getSnapshot().validationCount, 1);
  assert.equal(t.connection.getSnapshot().status, 'disconnected'); t.stop();
});
test('concurrent presses share one intent and target switch rejects delayed validation', async () => {
  let resolve!: (value: ServerInfo) => void;
  const t = setup(() => new Promise(done => { resolve = done; }));
  const first = t.store.send(card); const second = t.store.send(card);
  t.connection.preview(SAMPLE_SERVERS[1], 'connected'); resolve(info); await Promise.all([first, second]);
  assert.equal(t.sent.length, 0); assert.equal(t.connection.getSnapshot().server?.id, SAMPLE_SERVERS[1].id); t.stop();
});
test('rule edits and page changes invalidate preflight without replaying', async () => {
  for (const change of ['rule', 'page'] as const) {
    let resolve!: (value: ServerInfo) => void;
    const t = setup(() => new Promise(done => { resolve = done; })); const pending = t.store.send(card);
    if (change === 'rule') t.store.update(emptyWallet()); else t.store.cancelPending();
    resolve(info); await pending; assert.equal(t.sent.length, 0); t.stop();
  }
});
test('send shares in-flight verification rather than probing twice', async () => {
  let resolve!: (value: ServerInfo) => void;
  const t = setup(() => new Promise(done => { resolve = done; }));
  t.connection.setPreferences({ ...DEFAULT_PREFERENCES, warnWhenStale: true });
  t.connection.previewExpired(); t.connection.recheck();
  const pending = t.store.send(card); resolve(info); await pending;
  assert.equal(t.connection.getSnapshot().validationCount, 1); assert.equal(t.sent.length, 1); t.stop();
});
test('held card sends once, first-save refusal persists without blocking sends', async () => {
  const t = setup(); await t.store.scan(SAMPLE_READING, 'study'); t.store.answerPrompt(false);
  await t.store.scan(SAMPLE_READING, 'study'); assert.equal(t.sent.length, 1); assert.equal(t.store.getSnapshot().data.cards.length, 0);
  t.store.release(); await t.store.scan(SAMPLE_READING, 'study');
  assert.equal(t.sent.length, 2); assert.equal(t.store.getSnapshot().prompt, null); t.stop();
});
test('saving first read snapshot does not cancel its simultaneous send', async () => {
  let resolve!: (value: ServerInfo) => void;
  const t = setup(() => new Promise(done => { resolve = done; })); const pending = t.store.scan(SAMPLE_READING, 'study');
  t.store.answerPrompt(true); resolve(info); await pending;
  assert.equal(t.sent.length, 1); assert.equal(t.store.getSnapshot().data.cards[0].number, SAMPLE_READING.access); t.stop();
});
test('mapped first-save stores original identifier instead of pretending target was read from card', async () => {
  const t = setup(); t.store.update({ ...saveCard(emptyWallet(), card), rules: { study: { ...defaultRule(), rule: 'mapping', mappingMode: 'fixed', fixedCardId: card.id } } });
  await t.store.scan(SAMPLE_READING, 'study'); t.store.answerPrompt(true);
  const saved = t.store.getSnapshot().data.cards[1]; assert.equal(saved.kind, 'IDm'); assert.equal(saved.number, SAMPLE_READING.source); t.stop();
});
for (const [outcome, message] of [['busy', '读卡槽忙'], ['rejected', '不符合要求'], ['unknown', '提交结果未知']] as const) {
  test(outcome + ' is not game success or disconnection and never replays', async () => {
    const t = setup(undefined, outcome); await t.store.send(card);
    assert.equal(t.sent.length, 1); assert.equal(t.connection.getSnapshot().status, 'connected');
    assert.match(t.store.getSnapshot().result, new RegExp(message)); t.stop();
  });
}
