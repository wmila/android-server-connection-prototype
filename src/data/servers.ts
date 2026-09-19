export type CommunicationMode = 'http' | 'ws';

export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  mode: CommunicationMode;
  wsPath: string;
  lastSuccess?: number;
}
export interface ServerForm {
  name: string;
  host: string;
  port: string;
  mode: CommunicationMode;
  wsPath: string;
}
export interface Preferences {
  autoConnect: boolean;
  autoReconnect: boolean;
  httpMode: 'demand' | 'poll';
  pollIntervalSeconds: number;
  warnWhenStale: boolean;
  staleAfterSeconds: number;
  retryIntervalSeconds: number;
}
export const DEFAULT_PREFERENCES: Preferences = {
  autoConnect: true, autoReconnect: false, httpMode: 'demand',
  pollIntervalSeconds: 5, warnWhenStale: false, staleAfterSeconds: 60, retryIntervalSeconds: 5,
};
export const SETTING_LIMITS = {
  pollIntervalSeconds: { min: 1, max: 3600 },
  staleAfterSeconds: { min: 1, max: 86400 },
  retryIntervalSeconds: { min: 1, max: 3600 },
} as const;
export interface SavedState {
  servers: ServerConfig[];
  lastSuccessId: string | null;
  preferences: Preferences;
}
// Retain the key so deployed v1 configurations upgrade in place.
export const STORAGE_KEY = 'localink-prototype-v1';
export const AMNET_INFO_PATH = '/amnet/info';
export const SAMPLE_SERVERS: ServerConfig[] = [
  { id: 'study', name: '书房 · AMNet', host: '192.168.1.8', port: 6070, mode: 'http', wsPath: '/ws' },
  { id: 'media', name: '工作室 · WebSocket', host: '192.168.1.100', port: 8080, mode: 'ws', wsPath: '/ws' },
];
export const DISCOVERED_SERVERS = [
  { id: 'studio-found', name: '工作室服务器', host: '192.168.1.108', port: 6070 },
  { id: 'living-found', name: '客厅服务器', host: '192.168.1.128', port: 6070 },
];
export const BLANK_FORM: ServerForm = { name: '', host: '', port: '6070', mode: 'http', wsPath: '/ws' };
export const toForm = (server: ServerConfig): ServerForm => ({
  name: server.name, host: server.host, port: String(server.port), mode: server.mode, wsPath: server.wsPath,
});
export const getScheme = (server: Pick<ServerForm, 'mode'>) => server.mode === 'http' ? 'http' : 'ws';
export function getAddress(server: ServerForm | ServerConfig) {
  const host = server.host.includes(':') && !server.host.startsWith('[') ? '[' + server.host + ']' : server.host;
  return getScheme(server) + '://' + (host || '192.168.1.8') + ':' + (server.port || '6070')
    + (server.mode === 'http' ? AMNET_INFO_PATH : server.wsPath);
}
export function normalizePreferences(value: unknown): Preferences {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const preferences = { ...DEFAULT_PREFERENCES };
  for (const key of ['autoConnect', 'autoReconnect', 'warnWhenStale'] as const) {
    if (typeof raw[key] === 'boolean') preferences[key] = raw[key];
  }
  if (raw.httpMode === 'demand' || raw.httpMode === 'poll') preferences.httpMode = raw.httpMode;
  for (const key of Object.keys(SETTING_LIMITS) as (keyof typeof SETTING_LIMITS)[]) {
    const value = raw[key];
    const { min, max } = SETTING_LIMITS[key];
    if (typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max) preferences[key] = value;
  }
  return preferences;
}
export const createInitialState = (): SavedState => ({
  servers: SAMPLE_SERVERS.map(server => ({ ...server })), lastSuccessId: 'study', preferences: { ...DEFAULT_PREFERENCES },
});
export function parseSavedState(raw: string | null): SavedState {
  try {
    const parsed = JSON.parse(raw || 'null');
    if (!parsed || !Array.isArray(parsed.servers)) return createInitialState();
    // Preserve custom ports and intentionally empty lists; discard obsolete fields.
    const servers: ServerConfig[] = parsed.servers.filter((server: Partial<ServerConfig> | null) =>
      server && typeof server.id === 'string' && typeof server.name === 'string' && typeof server.host === 'string'
      && Number.isInteger(server.port) && server.port! > 0 && server.port! <= 65535
      && (server.mode === 'http' || server.mode === 'ws'),
    ).map((server: ServerConfig) => ({
      id: server.id, name: server.name, host: server.host, port: server.port, mode: server.mode,
      wsPath: typeof server.wsPath === 'string' && server.wsPath.startsWith('/') && !/[\s#]/.test(server.wsPath) ? server.wsPath : '/ws',
      ...(Number.isFinite(server.lastSuccess) ? { lastSuccess: server.lastSuccess } : {}),
    }));
    return {
      servers,
      lastSuccessId: servers.some(server => server.id === parsed.lastSuccessId) ? parsed.lastSuccessId : null,
      preferences: normalizePreferences(parsed.preferences ?? { autoConnect: parsed.autoConnect }),
    };
  } catch { return createInitialState(); }
}
export function readSavedState(): SavedState {
  try { return parseSavedState(localStorage.getItem(STORAGE_KEY)); }
  catch { return createInitialState(); }
}
export function addDiscoveredServer(servers: ServerConfig[], device: typeof DISCOVERED_SERVERS[number]) {
  const existing = servers.find(server => server.mode === 'http'
    && server.host.toLowerCase() === device.host.toLowerCase() && server.port === device.port);
  // An earlier discovery may have been edited to a different host or port.
  // Never reuse its id for a new endpoint, or a successful response would overwrite both.
  let id = device.id;
  let suffix = 1;
  while (!existing && servers.some(server => server.id === id)) id = device.id + '-' + suffix++;
  const server: ServerConfig = existing || { ...device, id, mode: 'http', wsPath: '/ws' };
  return { server, servers: existing ? servers : [...servers, server] };
}
export type FormErrors = Partial<Record<'name' | 'host' | 'port' | 'path', string>>;
export function validateForm(form: ServerForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = '请为服务器填写一个名称';
  const host = form.host.trim();
  if (!host) errors.host = '请输入 IP 地址或域名';
  else if (host === '0.0.0.0' || host === '::' || host === '[::]') errors.host = '请填写服务器实际 IP，不能使用监听地址';
  else if (/\s|\/|\?|#|@/.test(host) || host.includes('://')) errors.host = '只填写 IP 或域名，不包含协议与路径';
  else if (/^[\d.]+$/.test(host) && (host.split('.').length !== 4 || host.split('.').some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255))) errors.host = '请输入有效的 IPv4 地址';
  else {
    try { new URL('http://' + (host.includes(':') && !host.startsWith('[') ? '[' + host + ']' : host)); }
    catch { errors.host = '请输入有效的 IP 地址或域名'; }
  }
  if (!/^\d+$/.test(form.port) || Number(form.port) < 1 || Number(form.port) > 65535) errors.port = '范围为 1–65535';
  if (form.mode === 'ws' && (!form.wsPath.startsWith('/') || /[\s#]/.test(form.wsPath))) errors.path = '路径须以 / 开头，且不能包含空格或 #';
  return errors;
}
