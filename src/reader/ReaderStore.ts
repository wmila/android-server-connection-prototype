import type { ConnectionController } from '../connection/ConnectionController.ts';
import type { ServerConfig } from '../data/servers.ts';
import { signInRequest } from './transport.ts';
import { defaultRule, emptyWallet, normalizeNumber, parseWallet, readingKey, resolveReading, validNumber, WALLET_KEY,
  type Reading, type WalletCard, type WalletData } from './model.ts';

export type SubmitOutcome = 'accepted' | 'busy' | 'rejected' | 'unknown';
export type SubmitCard = (server: ServerConfig, card: Pick<WalletCard, 'kind' | 'number'>) => Promise<SubmitOutcome>;
export interface ReaderSnapshot { data: WalletData; busy: boolean; result: string; prompt: Reading | null; held: boolean; storageAvailable: boolean }
export const simulateSubmit = (outcome: SubmitOutcome): Promise<SubmitOutcome> => new Promise(resolve => setTimeout(() => resolve(outcome), 600));
export class ReaderStore {
  private state: ReaderSnapshot;
  private listeners = new Set<() => void>();
  private connection: ConnectionController;
  private submit: SubmitCard;
  private persist: (data: WalletData) => void;
  private revision = 0;
  private unsubscribe: () => void = () => {};
  private alive = true;
  constructor(connection: ConnectionController, submit: SubmitCard, data = emptyWallet(), persist: (data: WalletData) => void = () => {}) {
    this.connection = connection; this.submit = submit; this.persist = persist;
    this.state = { data, busy: false, result: '', prompt: null, held: false, storageAvailable: true };
  }
  start() {
    this.unsubscribe(); this.alive = true;
    let target = this.connection.getSnapshot().server;
    let status = this.connection.getSnapshot().status;
    this.unsubscribe = this.connection.subscribe(() => {
      const next = this.connection.getSnapshot();
      if (target?.id !== next.server?.id || target?.host !== next.server?.host || target?.port !== next.server?.port
        || target?.mode !== next.server?.mode || target?.wsPath !== next.server?.wsPath || (status === 'connected' && next.status !== 'connected')) this.revision++;
      target = next.server; status = next.status;
    });
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<ReaderSnapshot>) { this.state = { ...this.state, ...patch }; if (this.alive) this.listeners.forEach(listener => listener()); }
  update(data: WalletData) {
    this.revision++;
    let storageAvailable = true;
    try { this.persist(data); } catch { storageAvailable = false; }
    this.publish({ data, storageAvailable });
  }
  // Remembering a save decision must not invalidate the simultaneous send intent.
  answerPrompt(save: boolean) {
    const prompt = this.state.prompt;
    if (!prompt) return;
    const key = readingKey(prompt);
    const data = { ...this.state.data, asked: [...new Set([...this.state.data.asked, key])] };
    if (save) {
      const number = prompt.access ?? prompt.source;
      const kind = prompt.access ? 'Access Code' : prompt.kind;
      if (!data.cards.some(card => card.kind === kind && card.number === number)) data.cards = [...data.cards,
        { id: crypto.randomUUID(), name: '新卡 · ' + number.slice(-4), number, kind, accent: '#39746b' }];
    }
    let storageAvailable = true;
    try { this.persist(data); } catch { storageAvailable = false; }
    this.publish({ data, prompt: null, storageAvailable });
  }
  release() { this.publish({ held: false }); }
  reset() { this.update(emptyWallet()); this.publish({ prompt: null, held: false, result: '' }); }
  cancelPending() { this.revision++; }
  feedback(result: string) { this.publish({ result }); }
  async scan(reading: Reading, serverId: string | null) {
    if (this.state.held || this.state.busy) return;
    this.publish({ held: true });
    if (!validNumber(reading.kind, normalizeNumber(reading.source))) { this.feedback('未读取到有效卡片标识'); return; }
    const config = serverId ? this.state.data.rules[serverId] ?? defaultRule() : defaultRule();
    const snapshot = { ...reading, access: config.rule === 'access' ? reading.access : undefined };
    if (!this.state.prompt && !this.state.data.asked.includes(readingKey(reading))) this.publish({ prompt: snapshot });
    try { await this.send(resolveReading(reading, config, this.state.data.cards)); }
    catch (error) { this.feedback((error as Error).message); }
  }
  async send(card: Pick<WalletCard, 'kind' | 'number'>) {
    if (this.state.busy) return;
    const server = this.connection.getSnapshot().server;
    const number = normalizeNumber(card.number);
    if (!validNumber(card.kind, number)) { this.feedback('卡号格式无效，请检查类型与内容'); return; }
    if (!server || this.connection.getSnapshot().status !== 'connected') { this.feedback('请先连接服务器，本次未发送'); return; }
    if (server.mode === 'http' && card.kind !== 'Access Code') { this.feedback('AMNet 不支持仅 UID/IDm，请读取 Access Code 或配置映射'); return; }
    const revision = this.revision;
    this.publish({ busy: true, result: '正在验证 · ' + server.name });
    try {
      const verified = await this.connection.verifyForSend(server.id);
      if (!verified) { this.feedback('无法确认服务器在线，本次未发送'); return; }
      if (!this.alive || revision !== this.revision) { this.feedback('操作或目标已改变，本次未发送'); return; }
      this.feedback('正在提交 · ' + server.name);
      if (server.mode === 'http') signInRequest(server, { ...card, number });
      const outcome = await this.submit(server, { ...card, number });
      const messages: Record<SubmitOutcome, string> = {
        accepted: '服务器已接收，请在游戏端确认', busy: '读卡槽忙，请稍后重试',
        rejected: '卡号格式或请求不符合要求', unknown: '提交结果未知，请先确认游戏端',
      };
      this.feedback(server.name + ' · ' + messages[outcome]);
    } catch { this.feedback(server.name + ' · 提交结果未知，请先确认游戏端'); }
    finally { this.publish({ busy: false }); }
  }
  dispose() { this.alive = false; this.revision++; this.unsubscribe(); }
}
export function loadWallet(): WalletData {
  try { return parseWallet(localStorage.getItem(WALLET_KEY)); } catch { return emptyWallet(); }
}
