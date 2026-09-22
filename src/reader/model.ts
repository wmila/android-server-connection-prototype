export type OutputRule = 'raw' | 'access' | 'mapping';
export type MappingMode = 'fixed' | 'per-card';
export type CardKind = 'Access Code' | 'IDm' | 'UID';
export interface WalletCard { id: string; name: string; number: string; kind: CardKind; accent: string }
export interface Binding { id: string; source: string; kind: 'IDm' | 'UID'; cardId: string }
export interface RuleConfig { rule: OutputRule; mappingMode: MappingMode; fixedCardId: string; bindings: Binding[] }
export interface WalletData { cards: WalletCard[]; rules: Record<string, RuleConfig>; asked: string[]; vibration: boolean }
export interface Reading { source: string; kind: 'IDm' | 'UID'; access?: string }
export const WALLET_KEY = 'localink-wallet-v1';
export const defaultRule = (): RuleConfig => ({ rule: 'access', mappingMode: 'per-card', fixedCardId: '', bindings: [] });
export const emptyWallet = (): WalletData => ({ cards: [], rules: {}, asked: [], vibration: true });
// Public prototype fixtures only; no NFC hardware or decoder is invoked.
export const SAMPLE_READING: Reading = { source: '01F2A6C88D104B7E', kind: 'IDm', access: '00000000000000000001' };
export const normalizeNumber = (value: string) => value.replace(/\s/g, '').toUpperCase();
export function validNumber(kind: CardKind, value: string): boolean {
  if (kind === 'Access Code') return /^[0-9]{20}$/.test(value);
  if (kind === 'IDm') return /^[0-9A-F]{16}$/.test(value);
  return /^(?:[0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$/.test(value);
}
export const readingKey = (reading: Reading) => reading.kind + ':' + normalizeNumber(reading.source);
export function parseWallet(raw: string | null): WalletData {
  const result = emptyWallet();
  try {
    const value = JSON.parse(raw || 'null');
    if (!value || typeof value !== 'object') return result;
    const ids = new Set<string>();
    if (Array.isArray(value.cards)) for (const card of value.cards) {
      if (!card || typeof card.id !== 'string' || ids.has(card.id) || typeof card.name !== 'string' || typeof card.number !== 'string'
        || !['Access Code', 'IDm', 'UID'].includes(card.kind) || !validNumber(card.kind, normalizeNumber(card.number))) continue;
      ids.add(card.id);
      result.cards.push({ id: card.id, name: card.name, number: normalizeNumber(card.number), kind: card.kind,
        accent: /^#[0-9a-f]{6}$/i.test(card.accent) ? card.accent : '#74547f' });
    }
    if (value.rules && typeof value.rules === 'object') for (const [id, config] of Object.entries(value.rules)) {
      if (!config || typeof config !== 'object' || ['__proto__', 'constructor', 'prototype'].includes(id)) continue;
      const source = config as Partial<RuleConfig>;
      const rule = defaultRule();
      if (source.rule && ['raw', 'access', 'mapping'].includes(source.rule)) rule.rule = source.rule;
      if (source.mappingMode === 'fixed') rule.mappingMode = 'fixed';
      if (typeof source.fixedCardId === 'string' && ids.has(source.fixedCardId)) rule.fixedCardId = source.fixedCardId;
      const keys = new Set<string>();
      if (Array.isArray(source.bindings)) for (const binding of source.bindings) {
        if (!binding || !['IDm', 'UID'].includes(binding.kind) || typeof binding.source !== 'string' || !ids.has(binding.cardId)
          || !validNumber(binding.kind, normalizeNumber(binding.source))) continue;
        const key = readingKey(binding);
        if (keys.has(key)) continue;
        keys.add(key);
        rule.bindings.push({ ...binding, id: key, source: normalizeNumber(binding.source) });
      }
      result.rules[id] = rule;
    }
    if (Array.isArray(value.asked)) result.asked = [...new Set<string>(value.asked.filter((key: unknown) => typeof key === 'string'))];
    if (typeof value.vibration === 'boolean') result.vibration = value.vibration;
  } catch { /* Invalid wallet data never resets connection preferences. */ }
  return result;
}
export function saveCard(data: WalletData, card: WalletCard): WalletData {
  const number = normalizeNumber(card.number);
  if (!validNumber(card.kind, number)) throw new Error('卡号格式无效，请检查类型与内容');
  if (data.cards.some(item => item.kind === card.kind && item.number === number)) throw new Error('这个卡号已在卡包中');
  return { ...data, cards: [...data.cards, { ...card, number }] };
}
export function deleteCard(data: WalletData, id: string): WalletData {
  return { ...data, cards: data.cards.filter(card => card.id !== id), rules: Object.fromEntries(Object.entries(data.rules).map(([key, rule]) =>
    [key, { ...rule, fixedCardId: rule.fixedCardId === id ? '' : rule.fixedCardId, bindings: rule.bindings.filter(binding => binding.cardId !== id) }])) };
}
export function resolveReading(reading: Reading, config: RuleConfig, cards: WalletCard[]): Pick<WalletCard, 'kind' | 'number'> {
  if (!validNumber(reading.kind, normalizeNumber(reading.source))) throw new Error('无法取得有效实体卡标识');
  if (config.rule === 'raw') return { kind: reading.kind, number: normalizeNumber(reading.source) };
  if (config.rule === 'access') {
    if (!reading.access || !validNumber('Access Code', reading.access)) throw new Error('未能读取 Access Code，请重新贴卡或手动输入');
    return { kind: 'Access Code', number: reading.access };
  }
  const id = config.mappingMode === 'fixed' ? config.fixedCardId : config.bindings.find(binding => readingKey(binding) === readingKey(reading))?.cardId;
  const target = cards.find(card => card.id === id);
  if (!target) throw new Error(config.mappingMode === 'fixed' ? '请先选择固定卡号' : '这张卡尚未绑定，请前往卡包绑定');
  return target;
}
