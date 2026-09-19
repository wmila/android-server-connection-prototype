import { motion } from 'framer-motion';
import type { SceneId } from '../data/scenes';
import { DISCOVERED_SERVERS, SAMPLE_SERVERS, getAddress, type FormErrors, type ServerConfig, type ServerForm } from '../data/servers';
import type { ConnectionSnapshot } from '../connection/ConnectionController';
import { Icon } from './Icon';
import { AppButton, EmptyArt, PageIntro, ProtocolBadge, ServerDetails, StatusCard } from './MobileUI';

export interface ConnectionActions {
  reconnect: () => void;
  cancel: () => void;
  disconnect: () => void;
  manage: () => void;
  add: () => void;
  recheck: () => void;
  retryNow: () => void;
}
export function ConnectionScreen({ scene, server, lastSuccessId, serverCount, connection, actions }: {
  scene: SceneId; server: ServerConfig; lastSuccessId: string | null; serverCount: number;
  connection: ConnectionSnapshot; actions: ConnectionActions;
}) {
  const busy = ['auto', 'connecting', 'retrying', 'retry-wait'].includes(connection.status);
  const online = connection.status === 'connected';
  const empty = scene === 'unconfigured';
  return <div className="connection-screen">
    <PageIntro eyebrow="LOCAL CONNECTION" title="服务器连接">与你的设备，保持连接。</PageIntro>
    <StatusCard scene={scene} server={server} connection={connection} />
    {empty ? <div className="unconfigured-content"><EmptyArt /><h2>连接，从一台设备开始</h2><p>添加你的局域网服务器，<br />让熟悉的设备触手可及。</p><AppButton icon="plus" onClick={actions.add}>添加服务器</AppButton></div> : <>
      {connection.stale && <div className="connection-notice warning"><Icon name="info" size={14} /><p>服务器状态可能已过期，可按需重新测试。</p></div>}
      <ServerDetails server={server} isLast={server.id === lastSuccessId} />
      {connection.error && (connection.status === 'failed' || connection.status === 'disconnected') && <div className="failure-help"><h3>连接未就绪</h3><p>{connection.error}</p><p>请确认设备在同一网络，服务器已启动，地址与端口正确。</p></div>}
      <div className="connection-actions">
        {busy ? <>
          <AppButton kind="outline" onClick={actions.cancel}>取消连接</AppButton>
          {connection.status === 'retry-wait' && <AppButton kind="text" onClick={actions.retryNow}>立即重试</AppButton>}
        </> : online ? <>
          {connection.stale && <AppButton icon="refresh" onClick={actions.recheck} disabled={connection.checking}>{connection.checking ? '正在测试…' : '重新测试'}</AppButton>}
          <AppButton kind="outline" icon="unplug" onClick={actions.disconnect}>断开连接</AppButton>
        </> : <AppButton icon="refresh" onClick={actions.reconnect}>重新连接</AppButton>}
      </div>
      <button className="manage-link" onClick={actions.manage}><span><h3>管理已保存的服务器</h3><p>{serverCount} 台设备</p></span><Icon name="chevronRight" size={17} /></button>
    </>}
  </div>;
}

export function DiscoveryScreen({ scene, addingAdditional, onScan, onCancel, onManual, onSelect }: {
  scene: SceneId; addingAdditional: boolean; onScan: () => void; onCancel: () => void; onManual: () => void;
  onSelect: (device: typeof DISCOVERED_SERVERS[number]) => void;
}) {
  const first = scene === 'first';
  const scanning = scene === 'scanning';
  const found = scene === 'scan';
  return <div className="discovery-screen">
    <PageIntro eyebrow="FIND YOUR SERVER" title={first && !addingAdditional ? '连接你的服务器' : '添加服务器'}>让你的设备相遇在同一个局域网。</PageIntro>
    {first && !addingAdditional && <StatusCard scene="first" server={SAMPLE_SERVERS[0]} />}
    <div className="discovery-tabs"><button className="selected" aria-pressed="true"><Icon name="scan" size={16} />自动发现</button><button onClick={onManual} aria-pressed="false"><Icon name="pencil" size={15} />手动输入</button></div>
    <div className="section-label"><h3>附近的服务器 {found && <span>{DISCOVERED_SERVERS.length} 台</span>}</h3><button onClick={onScan} disabled={scanning}><Icon name={scanning ? 'loading' : 'refresh'} size={13} className={scanning ? 'spin' : ''} />{scanning ? '扫描中' : first ? '开始扫描' : '重新扫描'}</button></div>
    {found ? <div className="discovery-results">{DISCOVERED_SERVERS.map((device, index) => <motion.button className="discovered-device" key={device.id} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .1 }} onClick={() => onSelect(device)}>
      <span className="server-glyph"><Icon name="server" size={22} /></span><span className="discovered-copy"><strong>{device.name}</strong><code>{device.host}:{device.port}</code><small>HTTP</small></span><span className="select-device">连接</span>
    </motion.button>)}<p className="discovered-count">选择设备后直接添加并连接</p><button className="manual-shortcut" onClick={onManual}>没有找到设备？手动输入地址<Icon name="arrowRight" size={14} /></button></div>
      : <div className={'discovery-empty ' + (first ? 'first-discovery' : '')}><EmptyArt kind="scan" scanning={scanning} /><h2>{first ? '从附近的服务器开始' : scanning ? '正在发现附近设备' : '暂未发现服务器'}</h2><p>{scanning ? '正在查找设备，请稍候。' : first ? '选择一台服务器，即可添加并连接。' : '可以重新扫描，或手动输入服务器地址。'}</p><AppButton className="compact-button" kind={scanning ? 'outline' : 'primary'} icon={scanning ? undefined : first ? 'scan' : 'pencil'} onClick={scanning ? onCancel : first ? onScan : onManual}>{scanning ? '取消扫描' : first ? '开始扫描' : '手动添加'}</AppButton></div>}
  </div>;
}

export function ServerFormScreen({ editing, form, errors, onChange, onDiscover, onSave }: {
  editing: boolean; form: ServerForm; errors: FormErrors;
  onChange: (patch: Partial<ServerForm>) => void; onDiscover: () => void; onSave: (connect: boolean) => void;
}) {
  return <form className="server-form-screen" onSubmit={event => { event.preventDefault(); onSave(true); }} noValidate>
    <PageIntro eyebrow="SERVER CONFIGURATION" title={editing ? '编辑服务器' : '手动添加'}>填写服务器信息，开始连接。</PageIntro>
    {!editing && <div className="discovery-tabs"><button type="button" onClick={onDiscover}><Icon name="scan" size={16} />自动发现</button><button type="button" className="selected" aria-pressed="true"><Icon name="pencil" size={15} />手动输入</button></div>}
    <section className="form-section"><h2>基本信息</h2>
      <label className={'form-field ' + (errors.name ? 'invalid' : '')}><span>服务器名称</span><input name="server-name" value={form.name} placeholder="例如：书房 · AMNet" onChange={event => onChange({ name: event.target.value })} maxLength={40} aria-invalid={!!errors.name} />{errors.name && <small role="alert">{errors.name}</small>}</label>
      <div className="host-port-fields"><label className={'form-field ' + (errors.host ? 'invalid' : '')}><span>IP 地址或域名</span><input name="host" value={form.host} placeholder="192.168.1.8" onChange={event => onChange({ host: event.target.value })} spellCheck={false} autoCapitalize="none" aria-invalid={!!errors.host} />{errors.host && <small role="alert">{errors.host}</small>}</label><label className={'form-field ' + (errors.port ? 'invalid' : '')}><span>端口</span><input name="port" inputMode="numeric" value={form.port} placeholder="6070" maxLength={5} onChange={event => onChange({ port: event.target.value })} aria-invalid={!!errors.port} />{errors.port && <small role="alert">{errors.port}</small>}</label></div>
    </section>
    <section className="form-section communication-section"><h2>通信设置</h2>
      <div className="protocol-selector" role="radiogroup" aria-label="通信方式" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const mode = event.key === 'Home' ? 'http' : event.key === 'End' ? 'ws' : form.mode === 'http' ? 'ws' : 'http';
        onChange({ mode });
        event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[mode === 'http' ? 0 : 1]?.focus();
      }}>{(['http', 'ws'] as const).map(mode => <button key={mode} type="button" role="radio" tabIndex={form.mode === mode ? 0 : -1} aria-checked={form.mode === mode} className={form.mode === mode ? 'selected' : ''} onClick={() => onChange({ mode })}><Icon name={form.mode === mode ? 'checkCircle' : 'circle'} size={15} />{mode === 'http' ? 'HTTP' : 'WebSocket'}</button>)}</div>
      <p className="protocol-explanation">{form.mode === 'http' ? '验证方式可在连接设置中选择。' : '建立实时会话，断开后可重新连接。'}</p>
      {form.mode === 'ws' && <label className={'form-field path-field ' + (errors.path ? 'invalid' : '')}><span>WebSocket 路径</span><input name="path" value={form.wsPath} onChange={event => onChange({ wsPath: event.target.value })} spellCheck={false} aria-invalid={!!errors.path} />{errors.path && <small role="alert">{errors.path}</small>}</label>}
    </section>
    <div className="address-preview"><div><span>完整连接地址</span><ProtocolBadge server={form} /></div><code aria-live="polite">{getAddress(form)}</code></div>
    <div className="form-submit"><AppButton type="submit" icon={editing ? 'check' : 'arrowRight'}>{editing ? '保存并重新连接' : '保存并连接'}</AppButton><AppButton type="button" kind="text" onClick={() => onSave(false)}>{editing ? '仅保存修改' : '仅保存配置'}</AppButton></div>
  </form>;
}

export function ManageScreen({ servers, empty, currentId, lastSuccessId, onConnect, onEdit, onDelete, onAdd, onView }: {
  servers: ServerConfig[]; empty: boolean; currentId: string | null; lastSuccessId: string | null;
  onConnect: (server: ServerConfig) => void; onEdit: (server: ServerConfig) => void;
  onDelete: (server: ServerConfig) => void; onAdd: () => void; onView: (server: ServerConfig) => void;
}) {
  const list = empty ? [] : servers;
  return <div className="management-screen"><PageIntro eyebrow="SAVED SERVERS" title="服务器管理">你的每一台设备，都有自己的位置。</PageIntro><div className="section-label"><h3>已保存的服务器</h3><span>{list.length} 台设备</span></div>
    {list.length === 0 ? <div className="management-empty"><EmptyArt /><h2>还没有保存的服务器</h2><p>添加第一台设备，<br />让未来的连接少一点等待。</p><AppButton icon="plus" onClick={onAdd}>添加服务器</AppButton></div> : <><div className="saved-server-list">{list.map((server, index) => <motion.section className={`saved-server ${currentId === server.id ? 'is-current' : ''}`} key={server.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }}>
      <div className="saved-server-top"><span className="server-glyph"><Icon name="server" size={23} /></span><div className="saved-server-name"><h3>{server.name}</h3><p>{server.host}:{server.port}</p></div><ProtocolBadge server={server} /></div>
      {(currentId === server.id || lastSuccessId === server.id) && <div className="server-tags">{currentId === server.id && <span><i />当前连接</span>}{lastSuccessId === server.id && <span>上次成功使用</span>}</div>}
      <div className="saved-address"><code>{getAddress(server)}</code></div>
      <div className="saved-server-actions"><button className={currentId === server.id ? 'view-connection' : 'connect-device'} onClick={() => currentId === server.id ? onView(server) : onConnect(server)}><Icon name={currentId === server.id ? 'checkCircle' : 'wifi'} size={15} />{currentId === server.id ? '查看连接' : '连接'}</button><div><button aria-label={`编辑${server.name}`} title="编辑服务器" onClick={() => onEdit(server)}><Icon name="pencil" size={15} /></button><button className="delete-server" aria-label={`删除${server.name}`} title="删除服务器" onClick={() => onDelete(server)}><Icon name="trash" size={15} /></button></div></div>
    </motion.section>)}</div><AppButton icon="plus" onClick={onAdd}>添加服务器</AppButton></>}
    <p className="management-footnote"><Icon name="shieldCheck" size={12} />配置仅存于本地，添加设备时才会扫描</p>
  </div>;
}
