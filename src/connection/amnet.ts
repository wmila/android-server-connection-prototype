import { getAddress, type ServerConfig } from '../data/servers.ts';

export interface ServerInfo {
  apiVersion: 1;
  gameId: string | null;
  serverName: string;
  sessionUptime: number;
  timeSinceLastPoll: number | null;
}
export class VerificationError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
export function parseServerInfo(status: number, body: unknown): ServerInfo {
  if (status !== 200) throw new VerificationError('http', '服务器响应异常 · HTTP ' + status);
  if (!body || typeof body !== 'object') throw new VerificationError('invalid', '服务器信息格式无效');
  const info = body as Record<string, unknown>;
  if (!Number.isInteger(info.apiVersion)) throw new VerificationError('invalid', '服务器信息格式无效');
  if (info.apiVersion !== 1) throw new VerificationError('version', '服务器 API 版本不兼容');
  const seconds = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0;
  if (!(info.gameId === null || typeof info.gameId === 'string' && /^[A-Z]{4}$/.test(info.gameId))
    || typeof info.serverName !== 'string' || [...info.serverName].length > 16
    || !seconds(info.sessionUptime) || !(info.timeSinceLastPoll === null || seconds(info.timeSinceLastPoll))) {
    throw new VerificationError('invalid', '服务器信息格式无效');
  }
  return info as unknown as ServerInfo;
}
export type SimulationOutcome = 'success' | 'timeout' | 'unreachable' | 'invalid' | 'version' | 'http-error';
export type VerifyServer = (server: ServerConfig, signal: AbortSignal) => Promise<ServerInfo | null>;
export function infoRequest(server: ServerConfig) {
  return { method: 'GET', url: getAddress(server), headers: { Accept: 'application/json' } } as const;
}
// The public prototype never fetches LAN addresses. Fixtures exercise AMNet's
// response contract; WebSocket remains a separate simulated session.
export function simulateVerification(server: ServerConfig, signal: AbortSignal, outcome: SimulationOutcome): Promise<ServerInfo | null> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Canceled', 'AbortError')); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException('Canceled', 'AbortError')); };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      try {
        if (outcome === 'timeout') throw new VerificationError('timeout', '连接超时，请检查网络');
        if (outcome === 'unreachable') throw new VerificationError('unreachable', '服务器不可达，请检查地址与端口');
        if (outcome === 'http-error') throw new VerificationError('http', '服务器响应异常 · HTTP 503');
        if (server.mode === 'ws') { resolve(null); return; }
        resolve(parseServerInfo(200, outcome === 'invalid' ? {} : {
          apiVersion: outcome === 'version' ? 2 : 1, gameId: null,
          serverName: 'AMNET-SERVER', sessionUptime: 120, timeSinceLastPoll: null,
        }));
      } catch (error) { reject(error); }
    }, outcome === 'timeout' ? 1600 : 800);
    signal.addEventListener('abort', abort, { once: true });
  });
}
