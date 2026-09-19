import { motion } from 'framer-motion';
import type { RefObject } from 'react';
import type { SceneId } from '../data/scenes';
import { DISCOVERED_SERVERS, getAddress, type FormErrors, type ServerConfig, type ServerForm } from '../data/servers';
import { Icon } from './Icon';
import { AppButton, EmptyArt, PageIntro, ProtocolBadge, ServerDetails, StatusCard, Toggle } from './MobileUI';

export interface ConnectionActions {
  reconnect: (retry?: boolean, checkOnly?: boolean, skipWait?: boolean) => void;
  cancel: () => void;
  disconnect: () => void;
  edit: () => void;
  manage: () => void;
  add: () => void;
  home: () => void;
  copy: (text: string) => void;
  toggleAuto: () => void;
}

export function ConnectionScreen({ scene, server, autoConnect, lastSuccessId, serverCount, elapsed, attempt, countdown, flowActive, actions }: {
  scene: SceneId; server: ServerConfig; autoConnect: boolean; lastSuccessId: string | null;
  serverCount: number; elapsed: number; attempt: number; countdown: number; flowActive: boolean; actions: ConnectionActions;
}) {
  const busy = ['auto', 'connecting', 'retrying', 'retry-wait'].includes(scene);
  const success = ['connected', 'ws-connected', 'retry-success'].includes(scene);
  const retry = scene === 'retrying' || scene === 'retry-wait';
  const empty = scene === 'unconfigured';
  const ws = server.mode === 'ws';
  return <div className="connection-screen">
    <PageIntro eyebrow="LOCAL CONNECTION" title="服务器连接">与你的设备，保持连接。</PageIntro>
    {!ws && !empty && <div className={`connection-notice ${scene === 'http-stale' ? 'warning' : ''}`}><Icon name={scene === 'http-stale' ? 'clock' : 'info'} size={14} /><p>{scene === 'http-stale' ? '暂未获取最新状态，以下信息可能已过期。' : <>HTTP 每 5 秒检查一次，显示的是最近状态，<br />可能存在延迟。</>}</p></div>}
    <StatusCard scene={scene} server={server} elapsed={elapsed} attempt={attempt} countdown={countdown} />
    {empty ? <div className="unconfigured-content"><EmptyArt /><h2>连接，从一台设备开始</h2><p>添加你的局域网服务器，<br />让熟悉的设备触手可及。</p><AppButton icon="plus" onClick={actions.add}>添加服务器</AppButton><div className="quiet-note"><Icon name="shieldCheck" size={13} />本地连接，安心访问</div></div> : <>
      {retry && <div className="retry-progress"><div><span><Icon name={scene === 'retry-wait' ? 'clock' : 'refresh'} size={14} />{scene === 'retry-wait' ? '等待再次尝试' : '重试进行中'}</span><span>{attempt} / 3</span></div><div className="progress-track"><motion.span initial={{ width: '0%' }} animate={{ width: `${attempt / 3 * 100}%` }} transition={{ duration: .8, ease: 'easeOut' }} /></div><p>{scene === 'retry-wait' ? `${countdown} 秒后将自动重试，也可以立即重试。` : '正在沿用已保存的通信设置。'}</p></div>}
      <ServerDetails server={server} isLast={server.id === lastSuccessId} onCopy={actions.copy} />
      {scene === 'failed' && <div className="failure-help"><h3>可以检查一下</h3><p>手机与服务器是否连接到同一 Wi-Fi？<br />服务器是否已启动，地址与端口是否正确？</p><span>连接超时 · ETIMEDOUT</span></div>}
      <div className="connection-actions">
        {busy ? <><AppButton kind="outline" onClick={actions.cancel}>取消连接</AppButton>{scene === 'retry-wait' && <AppButton kind="text" onClick={() => actions.reconnect(true, false, true)}>立即重试<Icon name="arrowRight" size={14} /></AppButton>}</>
          : success ? <><AppButton icon="arrowRight" onClick={actions.home}>进入首页</AppButton><AppButton kind="text" onClick={actions.disconnect}>{ws ? '断开连接' : '停止状态检查'}</AppButton></>
            : <AppButton icon="refresh" kind={scene === 'failed' ? 'danger' : 'primary'} onClick={() => actions.reconnect(scene === 'failed', scene === 'http-stale')}>{scene === 'http-stale' ? '立即检查' : '重新连接'}</AppButton>}
        <div className="secondary-actions"><button onClick={actions.edit}><Icon name="pencil" size={14} />修改配置</button><span /><button onClick={actions.manage}><Icon name="link" size={14} />切换服务器</button></div>
      </div>
      <div className="auto-connect-row"><div><h3>下次打开自动连接</h3><p>直接连接上次成功的服务器，无需重新扫描</p></div><Toggle checked={autoConnect} onChange={actions.toggleAuto} label="下次打开自动连接" /></div>
      <button className="manage-link" onClick={actions.manage}><span><h3>管理已保存的服务器</h3><p>{serverCount} 台设备，随时切换你的连接</p></span><Icon name="chevronRight" size={17} /></button>
      {(scene === 'failed' || retry) && <p className="security-footnote"><Icon name="lock" size={11} />保留原有协议与 TLS 设置，不自动降级</p>}
      {flowActive && success && <p className="redirect-note"><Icon name="loading" size={12} className="spin" />即将进入首页</p>}
    </>}
  </div>;
}

export function DiscoveryScreen({ scene, addingAdditional, onScan, onCancel, onManual, onSelect }: {
  scene: SceneId; addingAdditional: boolean; onScan: () => void; onCancel: () => void; onManual: () => void;
  onSelect: (device: typeof DISCOVERED_SERVERS[number]) => void;
}) {
  const first = scene === 'first';
  const showFirstUse = first && !addingAdditional;
  const scanning = scene === 'scanning';
  const found = scene === 'scan';
  return <div className="discovery-screen">
    <PageIntro eyebrow="FIND YOUR SERVER" title={showFirstUse ? '连接你的服务器' : '添加服务器'}>让你的设备相遇在同一个局域网。</PageIntro>
    {showFirstUse && <StatusCard scene="first" server={{ id: '', name: '', host: '', port: 8080, mode: 'http', tls: false, httpPath: '/api', wsPath: '/ws' }} />}
    <div className="discovery-tabs"><button className="selected" aria-pressed="true"><Icon name="scan" size={16} />自动发现</button><button onClick={onManual} aria-pressed="false"><Icon name="pencil" size={15} />手动输入</button></div>
    <div className="section-label"><h3>附近的服务器 {found && <span>2 台</span>}</h3><button onClick={onScan} disabled={scanning}><Icon name={scanning ? 'loading' : 'refresh'} size={13} className={scanning ? 'spin' : ''} />{scanning ? '扫描中' : first ? '开始扫描' : '重新扫描'}</button></div>
    {found ? <div className="discovery-results">{DISCOVERED_SERVERS.map((device, index) => <motion.button className="discovered-device" key={device.id} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .1 }} onClick={() => onSelect(device)}>
      <span className="server-glyph"><Icon name="server" size={22} /></span><span className="discovered-copy"><strong>{device.name}</strong><code>{device.host}:{device.port}</code><small>HTTP / WebSocket · 支持 TLS</small></span><span className="select-device">选择</span>
    </motion.button>)}<p className="discovered-count">发现完成，已合并同一设备的服务</p><button className="manual-shortcut" onClick={onManual}>没有找到设备？手动输入地址<Icon name="arrowRight" size={14} /></button></div>
      : <div className={`discovery-empty ${first ? 'first-discovery' : ''}`}><EmptyArt kind="scan" scanning={scanning} /><h2>{first ? '从附近的服务器开始' : scanning ? '正在发现附近设备' : '暂未发现服务器'}</h2><p>{first ? <>连接到同一 Wi-Fi，发现可用的服务器，<br />然后选择你偏好的通信方式。</> : scanning ? <>正在通过局域网服务发现查找设备，<br />请稍候，让连接慢慢靠近。</> : <>请确认设备在同一网络且已开启服务发现，<br />也可以手动输入服务器地址。</>}</p><AppButton className="compact-button" kind={scanning ? 'outline' : 'primary'} icon={scanning ? undefined : first ? 'scan' : 'pencil'} onClick={scanning ? onCancel : first ? onScan : onManual}>{scanning ? '取消扫描' : first ? '开始扫描' : '手动添加'}</AppButton></div>}
    <div className="discovery-footnote"><Icon name="info" size={14} /><p>设备发现与通信方式相互独立。<br />每台设备只显示一次，协议与 TLS 可在下一步设置。</p></div>
  </div>;
}

export function ServerFormScreen({ editing, form, errors, urlInput, urlParsed, urlRef, onChange, onUrlChange, onPaste, onDiscover, onSave }: {
  editing: boolean; form: ServerForm; errors: FormErrors; urlInput: string; urlParsed: boolean;
  urlRef: RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<ServerForm>) => void; onUrlChange: (value: string) => void;
  onPaste: () => void; onDiscover: () => void; onSave: (connect: boolean) => void;
}) {
  const pathKey = form.mode === 'http' ? 'httpPath' : 'wsPath';
  return <form className="server-form-screen" onSubmit={(event) => { event.preventDefault(); onSave(true); }} noValidate>
    <PageIntro eyebrow="SERVER CONFIGURATION" title={editing ? '编辑服务器' : '手动添加'}>{editing ? '一点调整，让连接恰到好处。' : '一个地址，连接你的本地世界。'}</PageIntro>
    {!editing && <div className="discovery-tabs"><button type="button" onClick={onDiscover} aria-pressed="false"><Icon name="scan" size={16} />自动发现</button><button type="button" className="selected" aria-pressed="true"><Icon name="pencil" size={15} />手动输入</button></div>}
    <div className={`paste-address ${urlParsed ? 'parsed' : ''}`}><input ref={urlRef} aria-label="粘贴完整地址以自动解析" aria-invalid={!!errors.url} value={urlInput} placeholder="粘贴完整地址，自动解析" onChange={(event) => onUrlChange(event.target.value)} spellCheck={false} autoCapitalize="none" maxLength={2048} /><button type="button" title="从剪贴板粘贴地址" aria-label="从剪贴板粘贴地址" onClick={onPaste}><Icon name={urlParsed ? 'checkCircle' : 'clipboard'} size={17} /></button></div>
    {errors.url && <p className="field-error" role="alert">{errors.url}</p>}
    <section className="form-section"><h2>基本信息</h2>
      <label className={`form-field ${errors.name ? 'invalid' : ''}`}><span>服务器名称</span><input name="server-name" value={form.name} placeholder="例如：书房 · Home Server" onChange={(event) => onChange({ name: event.target.value })} maxLength={40} aria-invalid={!!errors.name} />{errors.name && <small role="alert">{errors.name}</small>}</label>
      <div className="host-port-fields"><label className={`form-field ${errors.host ? 'invalid' : ''}`}><span>IP 地址或域名</span><input name="host" value={form.host} placeholder="192.168.1.8" onChange={(event) => event.target.value.includes('://') ? onUrlChange(event.target.value) : onChange({ host: event.target.value })} spellCheck={false} autoCapitalize="none" aria-invalid={!!errors.host} />{errors.host && <small role="alert">{errors.host}</small>}</label><label className={`form-field ${errors.port ? 'invalid' : ''}`}><span>端口</span><input name="port" inputMode="numeric" value={form.port} placeholder="8080" maxLength={5} onChange={(event) => onChange({ port: event.target.value })} aria-invalid={!!errors.port} />{errors.port && <small role="alert">{errors.port}</small>}</label></div>
    </section>
    <section className="form-section communication-section"><h2>通信设置</h2>
      <div className="protocol-selector" role="radiogroup" aria-label="通信方式" onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'http' : event.key === 'End' ? 'ws' : form.mode === 'http' ? 'ws' : 'http';
        onChange({ mode: next });
        event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next === 'http' ? 0 : 1]?.focus();
      }}><button type="button" role="radio" tabIndex={form.mode === 'http' ? 0 : -1} aria-checked={form.mode === 'http'} className={form.mode === 'http' ? 'selected' : ''} onClick={() => onChange({ mode: 'http' })}><Icon name={form.mode === 'http' ? 'checkCircle' : 'circle'} size={15} />HTTP</button><button type="button" role="radio" tabIndex={form.mode === 'ws' ? 0 : -1} aria-checked={form.mode === 'ws'} className={form.mode === 'ws' ? 'selected' : ''} onClick={() => onChange({ mode: 'ws' })}><Icon name={form.mode === 'ws' ? 'checkCircle' : 'circle'} size={15} />WebSocket</button></div>
      <p className="protocol-explanation">{form.mode === 'http' ? '按需请求，每 5 秒轮询更新服务器状态。' : '保持双向连接，实时接收服务器状态更新。'}</p>
      <div className="tls-setting"><Icon name={form.tls ? 'shieldCheck' : 'shield'} size={21} /><div><h3>TLS 加密</h3><p>{form.tls ? '加密已开启，不会自动降级' : '保护设备之间的通信'}</p></div><Toggle checked={form.tls} onChange={() => onChange({ tls: !form.tls })} label="TLS 加密" /></div>
      <label className={`form-field path-field ${errors.path ? 'invalid' : ''}`}><span>{form.mode === 'http' ? '请求路径' : 'WebSocket 路径'}</span><input name="path" value={form[pathKey]} onChange={(event) => onChange({ [pathKey]: event.target.value })} spellCheck={false} aria-invalid={!!errors.path} />{errors.path && <small role="alert">{errors.path}</small>}</label>
    </section>
    <div className="address-preview"><div><span>完整连接地址</span><ProtocolBadge server={form} /></div><code aria-live="polite">{getAddress(form)}</code>{form.tls && <small><Icon name="lock" size={10} />TLS 加密，始终校验服务器证书</small>}</div>
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

export function HomeScreen({ server, elapsed, onConnection }: { server: ServerConfig; elapsed: number; onConnection: () => void }) {
  return <div className="home-screen"><PageIntro eyebrow="YOUR LOCAL SPACE" title="首页">连接就绪，欢迎回来。</PageIntro><StatusCard scene={server.mode === 'http' ? 'connected' : 'ws-connected'} server={server} elapsed={elapsed} compact />
    <div className="home-empty"><EmptyArt kind="home" /><h2>一切就绪</h2><p>这里将承载你的业务内容，<br />现在，你可以开始探索了。</p><span className="home-placeholder">YOUR SPACE, YOUR POSSIBILITIES</span></div>
    <button className="home-server-summary" onClick={onConnection}><span className="server-glyph"><Icon name="server" size={20} /></span><span><strong>{server.name}</strong><code>{getAddress(server)}</code></span><Icon name="chevronRight" size={16} /></button><AppButton kind="tonal" icon="link" onClick={onConnection}>查看连接</AppButton><p className="home-footer">本地连接 · 自在访问</p>
  </div>;
}