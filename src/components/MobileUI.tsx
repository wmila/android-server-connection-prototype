import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { SceneId } from '../data/scenes';
import { getAddress, getScheme, type ServerConfig, type ServerForm } from '../data/servers';
import type { ConnectionSnapshot } from '../connection/ConnectionController';
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

export function ProtocolBadge({ server }: { server: Pick<ServerForm, 'mode'> }) {
  return <span className="protocol-badge">{getScheme(server).toUpperCase()}</span>;
}

export function StatusCard({ scene, server, connection }: {
  scene: SceneId; server: ServerConfig; connection?: ConnectionSnapshot;
}) {
  const status = connection?.status || 'disconnected';
  const empty = scene === 'unconfigured' || scene === 'first';
  const busy = ['auto', 'connecting', 'retrying'].includes(status);
  const stale = !!connection?.stale;
  const neutral = stale || status === 'disconnected' || status === 'retry-wait' || empty;
  const failed = status === 'failed';
  let title = '服务器可用';
  let subtitle = server.mode === 'http' ? '连接成功' : '实时连接已建立';
  let icon: IconName = 'checkCircle';
  if (status === 'auto') { title = '正在自动连接'; subtitle = '使用上次成功连接的服务器'; icon = 'loading'; }
  if (status === 'connecting') { title = '正在连接'; subtitle = '正在验证服务器是否可用'; icon = 'loading'; }
  if (failed) { title = '连接失败'; subtitle = connection?.error || '请检查服务器与网络'; icon = 'alert'; }
  if (status === 'retrying') { title = '正在重新连接'; subtitle = '第 ' + connection?.attempt + ' / 3 次尝试'; icon = 'loading'; }
  if (status === 'retry-wait') { title = '等待下次重试'; subtitle = connection?.countdown + ' 秒后再次尝试'; icon = 'clock'; }
  if (stale) { title = '连接已建立'; subtitle = '服务器状态可能已过期'; }
  if (connection?.checking && status === 'connected') subtitle = '正在验证服务器状态';
  if (status === 'disconnected') { title = '连接已断开'; subtitle = '配置已保留，随时可以重新连接'; icon = 'unplug'; }
  if (empty) { title = '尚未配置服务器'; subtitle = '添加一台设备，开始连接'; icon = 'info'; }
  return <div className={'status-card ' + (empty ? 'neutral' : failed ? 'failure' : neutral ? 'neutral' : busy ? 'pending' : 'success')} role="status" aria-live="polite" data-connection-state={empty ? 'unconfigured' : stale ? 'stale' : status}>
    <span className={'status-icon ' + (busy ? 'busy' : !neutral && !failed ? 'online' : '')}>
      <Icon name={icon} size={27} className={busy ? 'spin' : ''} />
    </span>
    <div className="status-copy"><h2>{title}</h2><p aria-live="off">{subtitle}</p></div>
    {!empty && <ProtocolBadge server={server} />}
  </div>;
}

export function ServerDetails({ server, isLast }: { server: ServerConfig; isLast: boolean }) {
  return <section className="server-details">
    <div className="detail-heading"><span>当前服务器</span>{isLast && <span className="last-used"><Icon name="clock" size={11} />上次成功使用</span>}</div>
    <div className="server-identity"><span className="server-glyph"><Icon name="server" size={23} /></span><div><h3>{server.name}</h3><p>{server.host}:{server.port}</p></div></div>
    <div className="address-line"><code>{getAddress(server)}</code></div>
  </section>;
}

export function EmptyArt({ kind = 'server', scanning = false }: { kind?: 'server' | 'scan'; scanning?: boolean }) {
  return <div className={`empty-art ${scanning ? 'is-scanning' : ''}`} aria-hidden="true">
    <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
    <div className="art-shape"><Icon name={kind === 'scan' ? 'scan' : 'server'} size={34} strokeWidth={1.5} /></div>
    {scanning && <div className="scan-sweep" />}
    <span className="art-dot dot-one" /><span className="art-dot dot-two" />
  </div>;
}
