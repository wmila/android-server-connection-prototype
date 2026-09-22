import type { ServerConfig } from '../data/servers.ts';
import { getAddress } from '../data/servers.ts';
import { validNumber, type WalletCard } from './model.ts';

/** Request description only. The prototype never contacts the LAN. */
export function signInRequest(server: ServerConfig, card: Pick<WalletCard, 'kind' | 'number'>) {
  if (server.mode !== 'http') throw new Error('WebSocket 正式业务协议尚未定义');
  if (card.kind !== 'Access Code' || !validNumber(card.kind, card.number)) throw new Error('AMNet 需要 20 位 Access Code');
  return {
    url: getAddress(server).replace(/\/amnet\/info$/, '/amnet/signin'),
    method: 'POST' as const,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId: card.number }),
  };
}
