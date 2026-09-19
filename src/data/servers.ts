export type CommunicationMode = 'http' | 'ws';

export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  mode: CommunicationMode;
  tls: boolean;
  httpPath: string;
  wsPath: string;
  lastSuccess?: number;
}

export interface ServerForm {
  name: string;
  host: string;
  port: string;
  mode: CommunicationMode;
  tls: boolean;
  httpPath: string;
  wsPath: string;
}

export interface SavedState {
  servers: ServerConfig[];
  lastSuccessId: string | null;
  autoConnect: boolean;
}

export const STORAGE_KEY = 'localink-prototype-v1';

export const SAMPLE_SERVERS: ServerConfig[] = [
  { id: 'study', name: '书房 · Home Server', host: '192.168.1.8', port: 8080, mode: 'http', tls: false, httpPath: '/api', wsPath: '/ws', lastSuccess: 1735725600000 },
  { id: 'media', name: '家庭媒体服务器', host: '192.168.1.100', port: 8080, mode: 'ws', tls: true, httpPath: '/api', wsPath: '/app' },
];

export const DISCOVERED_SERVERS = [
  { id: 'studio-found', name: '工作室服务器', host: '192.168.1.108', port: 8080 },
  { id: 'living-found', name: '客厅媒体中心', host: '192.168.1.128', port: 8080 },
];

export const BLANK_FORM: ServerForm = {
  name: '', host: '', port: '8080', mode: 'http', tls: false, httpPath: '/api', wsPath: '/ws',
};

export function toForm(server: ServerConfig): ServerForm {
  return { name: server.name, host: server.host, port: String(server.port), mode: server.mode, tls: server.tls, httpPath: server.httpPath, wsPath: server.wsPath };
}

export function getScheme(server: Pick<ServerForm, 'mode' | 'tls'>) {
  return `${server.mode === 'http' ? 'http' : 'ws'}${server.tls ? 's' : ''}`;
}

export function getAddress(server: ServerForm | ServerConfig) {
  const host = server.host.includes(':') && !server.host.startsWith('[') ? `[${server.host}]` : server.host;
  const path = server.mode === 'http' ? server.httpPath : server.wsPath;
  return `${getScheme(server)}://${host || '192.168.1.8'}:${server.port || '8080'}${path.startsWith('/') ? path : `/${path}`}`;
}

export function readSavedState(): SavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedState;
      if (Array.isArray(parsed.servers) && parsed.servers.every((server) =>
        typeof server.id === 'string' && typeof server.name === 'string' &&
        typeof server.host === 'string' && Number.isInteger(server.port) &&
        server.port > 0 && server.port <= 65535 &&
        (server.mode === 'http' || server.mode === 'ws') && typeof server.tls === 'boolean' &&
        typeof server.httpPath === 'string' && typeof server.wsPath === 'string'
      )) {
        return {
          servers: parsed.servers,
          lastSuccessId: parsed.servers.some((server) => server.id === parsed.lastSuccessId) ? parsed.lastSuccessId : null,
          autoConnect: typeof parsed.autoConnect === 'boolean' ? parsed.autoConnect : true,
        };
      }
    }
  } catch {
    // A blocked or outdated local store should not prevent opening the prototype.
  }
  return { servers: SAMPLE_SERVERS.map((server) => ({ ...server })), lastSuccessId: 'study', autoConnect: true };
}

export function parseAddress(value: string, current: ServerForm): ServerForm | null {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    const secure = url.protocol === 'https:' || url.protocol === 'wss:';
    const mode = url.protocol.startsWith('http') ? 'http' : 'ws';
    const path = `${url.pathname || '/'}${url.search}`;
    return {
      ...current,
      host: url.hostname,
      port: url.port || (secure ? '443' : '80'),
      mode,
      // Parsing a plaintext URL must never silently disable an existing TLS preference.
      tls: current.tls || secure,
      [mode === 'http' ? 'httpPath' : 'wsPath']: path,
    };
  } catch {
    return null;
  }
}

export type FormErrors = Partial<Record<'name' | 'host' | 'port' | 'path' | 'url', string>>;

export function validateForm(form: ServerForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = '请为服务器填写一个名称';
  const host = form.host.trim();
  if (!host) errors.host = '请输入 IP 地址或域名';
  else if (/\s|\/|\?|#|@/.test(host) || host.includes('://')) errors.host = '只填写 IP 或域名，不包含协议与路径';
  else if (/^[\d.]+$/.test(host) && (host.split('.').length !== 4 || host.split('.').some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255))) errors.host = '请输入有效的 IPv4 地址';
  else {
    try { new URL(`http://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}`); }
    catch { errors.host = '请输入有效的 IP 地址或域名'; }
  }
  if (!/^\d+$/.test(form.port) || Number(form.port) < 1 || Number(form.port) > 65535) errors.port = '范围为 1-65535';
  const path = form.mode === 'http' ? form.httpPath : form.wsPath;
  if (!path.startsWith('/') || /\s|#/.test(path)) errors.path = '路径须以 / 开头，且不能包含空格或 #';
  return errors;
}