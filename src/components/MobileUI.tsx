import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { SceneId } from '../data/scenes';
import { getAddress, getScheme, type ServerConfig, type ServerForm } from '../data/servers';
import { Icon, type IconName } from './Icon';

export function AppButton({ children, kind = 'primary', icon, className = '', ...props }:
  ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'outline' | 'tonal' | 'danger' | 'text'; icon?: IconName }) {
  return <button className={`app-button ${kind} ${className}`} {...props}>
    {icon && <Icon name={icon} size={17} />}{children}
  </button>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" className={`m3-switch ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}>
    <motion.span className="switch-thumb" animate={{ x: checked ? 18 : 0 }} transition={{ type: 'spring', stiffness: 520, damping: 32 }}>
      {checked && <Icon name="check" size={13} strokeWidth={2.5} />}
    </motion.span>
  </button>;
}

export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <div className="mobile-intro"><span className="mobile-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{children}</p></div>;
}

export function ProtocolBadge({ server }: { server: Pick<ServerForm, 'mode' | 'tls'> }) {
  return <span className={`protocol-badge ${server.mode === 'ws' ? 'websocket' : ''}`}>{getScheme(server).toUpperCase()}</span>;
}

export function PollingSymbol({ stale = false, inactive = false }: { stale?: boolean; inactive?: boolean }) {
  return <span className={`polling-symbol ${inactive ? 'inactive' : ''}`}>
    <svg className={inactive || stale ? '' : 'polling-orbit'} width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
      <circle cx="21" cy="21" r="16.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 4" />
      <circle cx="21" cy="21" r="11.5" fill="none" stroke="currentColor" strokeWidth="1" opacity=".3" />
    </svg>
    <Icon name={stale ? 'clock' : inactive ? 'unplug' : 'check'} size={16} strokeWidth={2} />
  </span>;
}

export function StatusCard({ scene, server, elapsed = 0, attempt = 1, countdown = 5, compact = false }:
  { scene: SceneId; server: ServerConfig; elapsed?: number; attempt?: number; countdown?: number; compact?: boolean }) {
  const busy = ['auto', 'connecting', 'retrying'].includes(scene);
  const neutral = ['http-stale', 'disconnected', 'canceled', 'unconfigured', 'first', 'retry-wait'].includes(scene);
  const failed = scene === 'failed';
  const empty = scene === 'unconfigured' || scene === 'first';
  const ws = server.mode === 'ws';
  let title = ws ? '实时连接已建立' : '服务器可用';
  let subtitle = ws ? '连接正常，状态实时同步' : `状态已更新 · ${elapsed ? `${elapsed} 秒前` : '刚刚检查'}`;
  let icon: IconName = ws ? 'radio' : 'check';
  if (scene === 'auto') { title = '正在自动连接'; subtitle = '使用上次成功连接的服务器'; icon = 'loading'; }
  if (scene === 'connecting') { title = '正在连接'; subtitle = ws ? '正在建立 WebSocket 实时会话' : '正在检查服务器是否可用'; icon = 'loading'; }
  if (failed) { title = '连接失败'; subtitle = '服务器未响应，请检查网络后重试'; icon = 'alert'; }
  if (scene === 'retrying') { title = '正在重新连接'; subtitle = `第 ${attempt} / 3 次尝试 · 保留原有配置`; icon = 'loading'; }
  if (scene === 'retry-wait') { title = '等待下次重试'; subtitle = `${countdown} 秒后进行第 ${attempt + 1} 次尝试`; icon = 'clock'; }
  if (scene === 'retry-success') { title = '重新连接成功'; subtitle = '连接已恢复，可以继续了'; icon = 'checkCircle'; }
  if (scene === 'http-stale') { title = '状态待更新'; subtitle = '最后更新于 1 分钟前'; icon = 'clock'; }
  if (scene === 'disconnected') { title = ws ? '实时连接已断开' : '已停止状态检查'; subtitle = '服务器配置已保留，随时可以重连'; icon = 'unplug'; }
  if (scene === 'canceled') { title = '已取消连接'; subtitle = '没有更改配置，随时可以重新连接'; icon = 'circle'; }
  if (empty) { title = '尚未配置服务器'; subtitle = '添加一台设备，开始你的本地连接'; icon = 'info'; }
  return <div className={`status-card ${failed ? 'failure' : neutral ? 'neutral' : busy ? 'pending' : 'success'} ${compact ? 'compact' : ''}`} role="status" aria-live="polite">
    <span className={`status-icon ${busy ? 'busy' : ''} ${ws && !neutral && !failed && !busy ? 'live' : ''}`}>
      {!ws && !busy && !failed && !empty && scene !== 'retry-wait' && scene !== 'retry-success'
        ? <PollingSymbol stale={scene === 'http-stale'} inactive={scene === 'disconnected' || scene === 'canceled'} />
        : <Icon name={icon} size={23} className={busy ? 'spin' : ''} />}
    </span>
    <div className="status-copy"><h2>{title}</h2><p aria-live="off">{subtitle}</p></div>
    {!empty && <ProtocolBadge server={server} />}
  </div>;
}

export function ServerDetails({ server, isLast, onCopy }: { server: ServerConfig; isLast: boolean; onCopy: (text: string) => void }) {
  return <section className="server-details">
    <div className="detail-heading"><span>当前服务器</span>{isLast && <span className="last-used"><Icon name="clock" size={11} />上次成功使用</span>}</div>
    <div className="server-identity"><span className="server-glyph"><Icon name="server" size={23} /></span><div><h3>{server.name}</h3><p>{server.host}:{server.port}</p></div></div>
    <div className="address-line"><code>{getAddress(server)}</code><button className="copy-button" title="复制完整地址" aria-label="复制完整地址" onClick={() => onCopy(getAddress(server))}><Icon name="copy" size={13} /></button></div>
    <div className="detail-footer"><span><Icon name={server.tls ? 'lock' : 'shield'} size={12} />{server.tls ? 'TLS 加密' : '未启用 TLS'}</span><span>{server.mode === 'http' ? 'HTTP 轮询' : 'WebSocket 实时连接'}</span></div>
  </section>;
}

export function EmptyArt({ kind = 'server', scanning = false }: { kind?: 'server' | 'scan' | 'home'; scanning?: boolean }) {
  return <div className={`empty-art ${scanning ? 'is-scanning' : ''}`} aria-hidden="true">
    <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
    <div className="art-shape"><Icon name={kind === 'scan' ? 'scan' : kind === 'home' ? 'dashboard' : 'server'} size={34} strokeWidth={1.5} /></div>
    {scanning && <div className="scan-sweep" />}
    <span className="art-dot dot-one" /><span className="art-dot dot-two" />
  </div>;
}