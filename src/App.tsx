import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from './components/Icon';
import { AppButton } from './components/MobileUI';
import { ConnectionScreen, DiscoveryScreen, HomeScreen, ManageScreen, ServerFormScreen } from './components/MobileScreens';
import { GROUPS, SCENES, readScene, type SceneGroup, type SceneId } from './data/scenes';
import { BLANK_FORM, SAMPLE_SERVERS, STORAGE_KEY, parseAddress, readSavedState, toForm, validateForm, type DISCOVERED_SERVERS, type FormErrors, type ServerConfig, type ServerForm } from './data/servers';

const WS_SCENES: SceneId[] = ['ws-connected', 'retrying', 'retry-wait', 'retry-success'];
const SUCCESS_SCENES: SceneId[] = ['connected', 'ws-connected', 'retry-success', 'home'];

function Brand({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'small-brand' : ''}`}><span className="brand-mark"><Icon name="link" size={small ? 19 : 25} strokeWidth={2.2} /></span><span className="brand-name">近联<span>LOCALINK</span></span></div>;
}

export default function App() {
  const [saved, setSaved] = useState(readSavedState);
  const [scene, setScene] = useState<SceneId>(() => readScene(saved.servers.length ? 'connected' : 'first'));
  const [activeServer, setActiveServer] = useState<ServerConfig>(() =>
    WS_SCENES.includes(scene) ? saved.servers.find((server) => server.mode === 'ws') || SAMPLE_SERVERS[1]
      : scene === 'connected' || scene === 'http-stale' ? saved.servers.find((server) => server.mode === 'http') || SAMPLE_SERVERS[0]
      : saved.servers.find((server) => server.id === saved.lastSuccessId) || saved.servers[0] || SAMPLE_SERVERS[0]);
  const [currentId, setCurrentId] = useState<string | null>(() => SUCCESS_SCENES.includes(scene) ? activeServer.id : null);
  const [form, setForm] = useState<ServerForm>(() => scene === 'edit' ? toForm(activeServer) : { ...BLANK_FORM });
  const [editTargetId, setEditTargetId] = useState<string | null>(() => scene === 'edit' ? activeServer.id : null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [urlInput, setUrlInput] = useState('');
  const [urlParsed, setUrlParsed] = useState(false);
  const [addingAdditional, setAddingAdditional] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [countdown, setCountdown] = useState(5);
  const [flowActive, setFlowActive] = useState(false);
  const [connectionOutcome, setConnectionOutcome] = useState<'success' | 'failure'>('success');
  const [scanOutcome, setScanOutcome] = useState<'found' | 'empty'>('found');
  const [toast, setToast] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ServerConfig | null>(null);
  const [workbenchDialog, setWorkbenchDialog] = useState<'about' | 'reset' | null>(null);
  const [focusMode, setFocusMode] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'app');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<SceneGroup, boolean>>({ connection: true, configuration: false, management: true, business: true });
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const workbenchDialogRef = useRef<HTMLDivElement>(null);
  const autoLaunchRequested = useRef(new URLSearchParams(window.location.search).get('mode') === 'app' && !window.location.hash);
  const currentScene = SCENES.find((item) => item.id === scene)!;
  const currentGroup = GROUPS.find((group) => group.id === currentScene.group)!;
  const sceneIndex = SCENES.findIndex((item) => item.id === scene);
  const isDiscovery = ['first', 'scanning', 'scan', 'scan-empty'].includes(scene);
  const isForm = scene === 'manual' || scene === 'edit';
  const isManage = scene === 'manage' || scene === 'manage-empty';
  const deviceScale = Math.min(focusMode ? .96 : .94, Math.max(.76, (viewportHeight - (focusMode ? 118 : 206)) / 806));

  function stopFlows() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setFlowActive(false);
  }

  function later(callback: () => void, delay: number) {
    timers.current.push(setTimeout(callback, delay));
  }

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3400);
  }

  function navigate(next: SceneId, preserveFlow = false) {
    if (!preserveFlow) stopFlows();
    setScene(next);
    setMobileNavOpen(false);
    if (window.location.hash !== `#/${next}`) window.history.pushState(null, '', `#/${next}`);
    const group = SCENES.find((item) => item.id === next)!.group;
    setExpanded((previous) => ({ ...previous, [group]: true }));
  }

  function selectScene(next: SceneId) {
    let target = activeServer;
    if (next === 'connected' || next === 'http-stale') target = saved.servers.find((server) => server.mode === 'http') || SAMPLE_SERVERS[0];
    if (WS_SCENES.includes(next)) target = saved.servers.find((server) => server.mode === 'ws') || SAMPLE_SERVERS[1];
    setActiveServer(target);
    setAttempt(next === 'retry-wait' ? 2 : 1);
    setCountdown(5);
    setElapsed(0);
    setDeleteTarget(null);
    setToast('');
    if (SUCCESS_SCENES.includes(next)) setCurrentId(target.id);
    if (['auto', 'connecting', 'failed', 'retrying', 'retry-wait', 'disconnected', 'canceled'].includes(next)) setCurrentId(null);
    if (next === 'manual' || next === 'first') {
      setForm({ ...BLANK_FORM }); setEditTargetId(null); setErrors({}); setUrlInput(''); setUrlParsed(false);
      setAddingAdditional(false);
    }
    if (next === 'edit') {
      setForm(toForm(target)); setEditTargetId(target.id); setErrors({}); setUrlInput(''); setUrlParsed(false);
    }
    navigate(next);
  }

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
  }, [saved]);

  useEffect(() => {
    function resize() { setViewportHeight(window.innerHeight); }
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    function onHistory() { selectScene(readScene(saved.servers.length ? 'connected' : 'first')); }
    window.addEventListener('popstate', onHistory);
    window.addEventListener('hashchange', onHistory);
    return () => { window.removeEventListener('popstate', onHistory); window.removeEventListener('hashchange', onHistory); };
  }, [saved, activeServer]);

  useEffect(() => {
    mobileScrollRef.current?.scrollTo({ top: 0 });
    document.title = `${currentScene.label} · 近联 Localink`;
  }, [scene, currentScene.label]);

  useEffect(() => {
    if (activeServer.mode !== 'http' || !SUCCESS_SCENES.includes(scene)) return;
    // This is a visual polling simulation, not a real request to the user's LAN.
    const interval = setInterval(() => setElapsed((value) => (value + 1) % 5), 1000);
    return () => clearInterval(interval);
  }, [scene, activeServer.mode]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key === 'Escape') {
        setDeleteTarget(null); setWorkbenchDialog(null); setMobileNavOpen(false);
        if (!deleteTarget && !workbenchDialog) setFocusMode(false);
        return;
      }
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) || target.isContentEditable || deleteTarget || workbenchDialog || focusMode) return;
      if (event.key === 'ArrowRight' && sceneIndex < SCENES.length - 1) { event.preventDefault(); selectScene(SCENES[sceneIndex + 1].id); }
      if (event.key === 'ArrowLeft' && sceneIndex > 0) { event.preventDefault(); selectScene(SCENES[sceneIndex - 1].id); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sceneIndex, saved, activeServer, deleteTarget, workbenchDialog, focusMode]);

  useEffect(() => {
    if (!deleteTarget && !workbenchDialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const activeDialogRef = workbenchDialog ? workbenchDialogRef : deleteDialogRef;
    const frame = requestAnimationFrame(() => activeDialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const buttons = activeDialogRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, [tabindex="0"]');
      if (!buttons?.length) return;
      const first = buttons[0]; const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', trapFocus);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', trapFocus); previousFocus?.focus(); };
  }, [deleteTarget, workbenchDialog]);

  async function copyText(value: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      showToast('已复制到剪贴板');
    } catch { showToast('无法访问剪贴板，请长按或选中地址复制'); }
  }

  function startConnection(server: ServerConfig, options: { retry?: boolean; automatic?: boolean; checkOnly?: boolean; skipWait?: boolean } = {}) {
    stopFlows();
    setActiveServer(server); setCurrentId(null); setFlowActive(true); setElapsed(0);
    const outcome = connectionOutcome;
    const retry = !!options.retry;
    const initialAttempt = options.skipWait ? Math.min(attempt + 1, 3) : 1;
    setAttempt(initialAttempt); setCountdown(5);

    function finish() {
      const successfulServer = { ...server, lastSuccess: Date.now() };
      setSaved((previous) => ({ ...previous, servers: previous.servers.some((item) => item.id === server.id) ? previous.servers.map((item) => item.id === server.id ? successfulServer : item) : [...previous.servers, successfulServer], lastSuccessId: server.id }));
      setActiveServer(successfulServer); setCurrentId(server.id); setElapsed(0);
      navigate(retry ? 'retry-success' : server.mode === 'ws' ? 'ws-connected' : 'connected', true);
      if (options.checkOnly) { setFlowActive(false); showToast('已获取最新服务器状态'); }
      else later(() => { navigate('home', true); setFlowActive(false); }, 1600);
    }

    function runAttempt(number: number) {
      setAttempt(number);
      navigate(retry ? 'retrying' : options.automatic ? 'auto' : 'connecting', true);
      later(() => {
        if (outcome === 'success' && (!retry || number >= 2 || options.skipWait)) { finish(); return; }
        if (retry && number < 3) {
          setCountdown(5); navigate('retry-wait', true);
          for (let second = 1; second < 5; second++) later(() => setCountdown(5 - second), second * 1000);
          later(() => runAttempt(number + 1), 5000);
        } else {
          navigate('failed', true); setFlowActive(false);
          if (retry) showToast('已尝试 3 次，配置已保留，请检查网络');
        }
      }, retry ? 1500 : 2200);
    }
    runAttempt(initialAttempt);
  }

  function launchApp() {
    if (!saved.servers.length) { setCurrentId(null); openAdd(); return; }
    const target = saved.servers.find((server) => server.id === saved.lastSuccessId) || saved.servers[0];
    setActiveServer(target);
    if (saved.autoConnect && saved.lastSuccessId) startConnection(target, { automatic: true });
    else { setCurrentId(null); navigate('disconnected'); showToast(saved.autoConnect ? '尚无成功连接记录，请手动连接一次' : '自动连接已关闭，点击重新连接即可开始'); }
  }

  function openEdit(server: ServerConfig) {
    setActiveServer(server); setForm(toForm(server)); setEditTargetId(server.id);
    setErrors({}); setUrlInput(''); setUrlParsed(false); navigate('edit');
  }

  function openAdd() {
    setForm({ ...BLANK_FORM }); setEditTargetId(null); setErrors({}); setUrlInput(''); setUrlParsed(false);
    setAddingAdditional(saved.servers.length > 0 && scene !== 'unconfigured' && scene !== 'manage-empty');
    navigate('first');
  }

  function beginScan() {
    stopFlows(); setFlowActive(true); setEditTargetId(null); navigate('scanning', true);
    later(() => { navigate(scanOutcome === 'found' ? 'scan' : 'scan-empty', true); setFlowActive(false); }, 2600);
  }

  function selectDiscovered(device: typeof DISCOVERED_SERVERS[number]) {
    setForm((previous) => ({ ...previous, name: device.name, host: device.host, port: String(device.port) }));
    setEditTargetId(null); setErrors({}); setUrlInput(''); setUrlParsed(false); navigate('manual');
    showToast('已填入设备信息，请确认通信与加密设置');
  }

  function changeUrl(value: string) {
    setUrlInput(value);
    const parsed = parseAddress(value, form);
    if (parsed) {
      setForm(parsed); setUrlParsed(true); setErrors({});
      if (form.tls && /^(http|ws):\/\//i.test(value.trim())) showToast('地址已解析，保留当前 TLS 加密设置');
    } else {
      setUrlParsed(false);
      setErrors((previous) => ({ ...previous, url: value.includes('://') ? '请输入有效的 HTTP、HTTPS、WS 或 WSS 完整地址' : undefined }));
    }
  }

  async function pasteUrl() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { urlRef.current?.focus(); showToast('剪贴板为空，请输入完整地址'); return; }
      changeUrl(text);
      if (!parseAddress(text, form)) showToast('地址未能识别，请检查协议、主机与路径');
    } catch { urlRef.current?.focus(); showToast('请在地址输入框中粘贴完整地址'); }
  }

  function saveForm(connect: boolean) {
    const nextErrors = validateForm(form);
    if (urlInput.trim() && !urlParsed) nextErrors.url = '请修正完整地址，或清空此栏后使用下方配置';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      requestAnimationFrame(() => nextErrors.url ? urlRef.current?.focus() : deviceRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const existing = saved.servers.find((server) => server.id === editTargetId);
    const server: ServerConfig = {
      id: editTargetId || `server-${Date.now().toString(36)}`, name: form.name.trim(), host: form.host.trim(),
      port: Number(form.port), mode: form.mode, tls: form.tls, httpPath: form.httpPath, wsPath: form.wsPath,
      ...(existing?.lastSuccess ? { lastSuccess: existing.lastSuccess } : {}),
    };
    setSaved((previous) => ({ ...previous, servers: previous.servers.some((item) => item.id === server.id) ? previous.servers.map((item) => item.id === server.id ? server : item) : [...previous.servers, server] }));
    setActiveServer(server);
    if (currentId === server.id) setCurrentId(null);
    if (connect) startConnection(server);
    else { navigate('manage'); showToast('配置已保存，仅成功连接才会更新默认服务器'); }
  }

  function deleteServer() {
    if (!deleteTarget) return;
    const remaining = saved.servers.filter((server) => server.id !== deleteTarget.id);
    const nextDefault = saved.lastSuccessId === deleteTarget.id ? [...remaining].filter((server) => server.lastSuccess).sort((a, b) => (b.lastSuccess || 0) - (a.lastSuccess || 0))[0]?.id || null : saved.lastSuccessId;
    setSaved((previous) => ({ ...previous, servers: remaining, lastSuccessId: nextDefault }));
    if (currentId === deleteTarget.id) setCurrentId(null);
    if (activeServer.id === deleteTarget.id) setActiveServer(remaining[0] || SAMPLE_SERVERS[0]);
    setDeleteTarget(null); navigate(remaining.length ? 'manage' : 'manage-empty'); showToast('服务器已从本地移除');
  }

  function resetPrototype() {
    stopFlows();
    setSaved({ servers: SAMPLE_SERVERS.map((server) => ({ ...server })), lastSuccessId: 'study', autoConnect: true });
    setActiveServer(SAMPLE_SERVERS[0]); setCurrentId('study'); setForm({ ...BLANK_FORM }); setErrors({});
    setConnectionOutcome('success'); setScanOutcome('found'); setWorkbenchDialog(null);
    setDeleteTarget(null); setAddingAdditional(false);
    setEditTargetId(null); setUrlInput(''); setUrlParsed(false); setAttempt(1); setCountdown(5); setElapsed(0);
    navigate('connected'); showToast('已恢复初始场景与示例服务器');
  }

  function viewConnection(server?: ServerConfig) {
    if (!saved.servers.length) { navigate('unconfigured'); return; }
    const target = server || saved.servers.find((item) => item.id === currentId) || activeServer;
    setActiveServer(target); navigate(currentId === target.id ? target.mode === 'ws' ? 'ws-connected' : 'connected' : 'disconnected');
  }

  function goBack() {
    if (isForm) navigate(editTargetId ? 'manage' : 'first');
    else if (isDiscovery) navigate(saved.servers.length ? 'manage' : 'unconfigured');
    else if (isManage || scene === 'home') viewConnection();
    else navigate(saved.servers.length ? 'manage' : 'manage-empty');
  }

  function runScenario() {
    if (isDiscovery) { beginScan(); return; }
    if (isForm) { saveForm(true); return; }
    if (scene === 'unconfigured' || scene === 'manage-empty' || (isManage && !saved.servers.length)) { openAdd(); return; }
    if (scene === 'connected' || scene === 'ws-connected' || scene === 'home' || scene === 'auto') { launchApp(); return; }
    startConnection(activeServer, { retry: ['failed', 'retrying', 'retry-wait', 'retry-success'].includes(scene), checkOnly: scene === 'http-stale' });
  }

  useEffect(() => {
    // A shared scene stays still; opening the app without a scene runs normal startup.
    if (autoLaunchRequested.current) launchApp();
  }, []);

  const quickScenes: SceneId[] = currentScene.group === 'configuration' ? ['first', 'scan', 'manual']
    : currentScene.group === 'management' ? ['manage', 'manage-empty']
      : currentScene.group === 'business' ? ['home', 'connected']
        : ['retrying', 'retry-wait', 'retry-success'].includes(scene) ? ['retrying', 'retry-wait', 'retry-success']
          : ['connected', 'failed', 'disconnected'];
  const demoLabel = isDiscovery ? '演示设备发现' : isForm ? '验证并连接' : scene === 'unconfigured' || scene === 'manage-empty' ? '开始添加设备' : ['connected', 'ws-connected', 'auto', 'home'].includes(scene) ? '播放启动连接流程' : '播放连接流程';
  const toolbarTitle = isDiscovery || isForm ? '服务器设置' : isManage ? '服务器管理' : '连接';

  return <MotionConfig reducedMotion="user"><div className={`workbench ${focusMode ? 'focus-mode' : ''}`}>
    {mobileNavOpen && <button className="sidebar-scrim" aria-label="关闭场景导航" onClick={() => setMobileNavOpen(false)} />}
    <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`} aria-label="原型场景导航">
      <div className="sidebar-brand"><Brand /><button className="mobile-close icon-button" aria-label="关闭导航" onClick={() => setMobileNavOpen(false)}><Icon name="close" size={19} /></button></div>
      <button className="sidebar-project" aria-label="打开连接体验首页" onClick={() => selectScene(saved.servers.length ? 'connected' : 'first')}><span className="project-symbol"><Icon name="layers" size={17} /></span><span className="project-copy"><strong>连接体验</strong><span>Android 交互原型</span></span><span className="project-dot" /></button>
      <div className="nav-heading"><span>场景导航</span><span>21 个独立页面</span></div>
      <nav className="scene-navigation">{GROUPS.map((group) => <div className="nav-group" key={group.id}><button className={`group-button ${currentScene.group === group.id ? 'active-group' : ''}`} onClick={() => setExpanded((previous) => ({ ...previous, [group.id]: !previous[group.id] }))} aria-expanded={expanded[group.id]}><Icon name={group.icon} size={15} /><span>{group.title}</span><span className="group-count">{SCENES.filter((item) => item.group === group.id).length.toString().padStart(2, '0')}</span><Icon name="chevronDown" size={13} className={expanded[group.id] ? '' : 'collapsed'} /></button>
        <AnimatePresence initial={false}>{expanded[group.id] && <motion.div className="group-scenes" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .2 }}>{SCENES.filter((item) => item.group === group.id).map((item) => <a key={item.id} href={`#/${item.id}`} onClick={(event) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); selectScene(item.id); }} className={`scene-link ${scene === item.id ? 'active' : ''}`} aria-current={scene === item.id ? 'page' : undefined}><Icon name={item.icon} size={13} /><span>{item.label}</span>{scene === item.id && <span className="active-scene-dot" />}</a>)}</motion.div>}</AnimatePresence>
      </div>)}</nav>
      <div className="sidebar-footer"><span className="prototype-version"><span />交互原型<span>v1.0</span></span><button onClick={() => setWorkbenchDialog('about')}>本地模拟，无需连接设备<Icon name="help" size={14} /></button></div>
    </aside>

    <div className="workspace">
      <header className="workspace-topbar"><div className="topbar-breadcrumb">{focusMode ? <button className="back-to-workbench" onClick={() => setFocusMode(false)}><Icon name="arrowLeft" size={16} />返回工作台</button> : <><button className="mobile-menu icon-button" aria-label="打开场景导航" onClick={() => setMobileNavOpen(true)}><Icon name="layers" size={20} /></button><span className="breadcrumb-icon"><Icon name="smartphone" size={16} /></span><span>近联 Android</span><Icon name="chevronRight" size={12} /><strong>连接体验</strong></>}</div>
        <div className="topbar-actions"><span className="material-label"><span />Material 3</span><span className="topbar-divider" /><button className="icon-button share-button" title="复制当前场景链接" aria-label="复制当前场景链接" onClick={() => { const url = new URL(window.location.href); url.hash = `/${scene}`; void copyText(url.toString()); }}><Icon name="link" size={17} /></button><button className="icon-button" title={focusMode ? '重新启动应用' : '重置原型'} aria-label={focusMode ? '重新启动应用' : '重置原型'} onClick={() => focusMode ? launchApp() : setWorkbenchDialog('reset')}><Icon name="reset" size={17} /></button><button className="preview-button" onClick={() => focusMode ? setMobileNavOpen(true) : setFocusMode(true)}><Icon name={focusMode ? 'layers' : 'play'} size={14} />{focusMode ? '切换场景' : '交互预览'}{!focusMode && <Icon name="arrowUpRight" size={14} />}</button></div>
      </header>

      <main className="workspace-main">
        <div className="workspace-heading"><div><p className="section-eyebrow">{currentGroup.english}</p><div className="workspace-title-line"><h1>{currentGroup.title}</h1><span>{currentGroup.subtitle}</span></div></div><div className="scene-pagination"><button aria-label="上一个场景" disabled={sceneIndex === 0} onClick={() => selectScene(SCENES[sceneIndex - 1].id)}><Icon name="chevronLeft" size={17} /></button><span><b>{(sceneIndex + 1).toString().padStart(2, '0')}</b><i>/</i>21</span><button aria-label="下一个场景" disabled={sceneIndex === SCENES.length - 1} onClick={() => selectScene(SCENES[sceneIndex + 1].id)}><Icon name="chevronRight" size={17} /></button></div></div>

        <div className="preview-layout">
          <section className="phone-stage" aria-label="Android 应用预览">
            <div className="device-caption" style={{ width: 390 * deviceScale }}><span><Icon name="smartphone" size={12} />ANDROID PREVIEW</span><button title="在独立窗口打开此页面" aria-label="在独立窗口打开此页面" onClick={() => { const url = new URL(window.location.href); url.searchParams.set('mode', 'app'); url.hash = `/${scene}`; window.open(url.toString(), '_blank', 'noopener,noreferrer'); }}><span>390 × 806</span><Icon name="external" size={12} /></button></div>
            <div className="device-container" style={{ '--device-scale': deviceScale, width: 390 * deviceScale, height: 806 * deviceScale } as CSSProperties}>
              <div className="device-hardware" ref={deviceRef}><span className="device-side-button volume" /><span className="device-side-button power" /><span className="camera-cutout" />
                <div className="mobile-display"><div className="android-statusbar"><span>9:41</span><div><Icon name="signal" size={13} strokeWidth={2.6} /><Icon name="wifi" size={13} strokeWidth={2.6} /><span className="android-battery"><span /></span></div></div>
                  <div className="mobile-toolbar">{scene === 'home' ? <Brand small /> : <div><button className="mobile-icon-button" aria-label="返回上一页" onClick={goBack}><Icon name="arrowLeft" size={19} /></button><span>{toolbarTitle}</span></div>}<button className="mobile-icon-button toolbar-servers" aria-label="管理服务器" title="管理服务器" onClick={() => navigate(saved.servers.length ? 'manage' : 'manage-empty')}><Icon name="server" size={20} /></button></div>
                  <div className="mobile-scroll" ref={mobileScrollRef}><AnimatePresence mode="wait" initial={false}><motion.div className="mobile-page" key={scene} initial={{ opacity: 0, x: 7 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }} transition={{ duration: .16, ease: 'easeOut' }}>
                    {isDiscovery ? <DiscoveryScreen scene={scene} addingAdditional={addingAdditional} onScan={beginScan} onCancel={() => { navigate('first'); showToast('扫描已取消，可以重新扫描或手动添加'); }} onManual={() => { setEditTargetId(null); navigate('manual'); }} onSelect={selectDiscovered} />
                      : isForm ? <ServerFormScreen editing={scene === 'edit'} form={form} errors={errors} urlInput={urlInput} urlParsed={urlParsed} urlRef={urlRef} onChange={(patch) => { setForm((previous) => ({ ...previous, ...patch })); setErrors({}); }} onUrlChange={changeUrl} onPaste={() => void pasteUrl()} onDiscover={() => navigate('first')} onSave={saveForm} />
                        : isManage ? <ManageScreen servers={saved.servers} empty={scene === 'manage-empty'} currentId={currentId} lastSuccessId={saved.lastSuccessId} onConnect={(server) => startConnection(server)} onEdit={openEdit} onDelete={setDeleteTarget} onAdd={openAdd} onView={viewConnection} />
                          : scene === 'home' ? <HomeScreen server={activeServer} elapsed={elapsed} onConnection={() => viewConnection()} />
                            : <ConnectionScreen scene={scene} server={activeServer} autoConnect={saved.autoConnect} lastSuccessId={saved.lastSuccessId} serverCount={saved.servers.length} elapsed={elapsed} attempt={attempt} countdown={countdown} flowActive={flowActive} actions={{
                              reconnect: (retry, checkOnly, skipWait) => startConnection(activeServer, { retry, checkOnly, skipWait }),
                              cancel: () => { setCurrentId(null); navigate('canceled'); showToast('连接已取消，配置已保留'); },
                              disconnect: () => { setCurrentId(null); navigate('disconnected'); showToast(activeServer.mode === 'http' ? '已停止轮询检查，配置已保留' : '实时连接已断开，配置已保留'); },
                              edit: () => openEdit(activeServer), manage: () => navigate(saved.servers.length ? 'manage' : 'manage-empty'), add: openAdd,
                              home: () => navigate('home'), copy: (text) => void copyText(text),
                              toggleAuto: () => { setSaved((previous) => ({ ...previous, autoConnect: !previous.autoConnect })); showToast(saved.autoConnect ? '已关闭下次打开自动连接' : '下次打开将直接连接上次成功的服务器'); },
                            }} />}
                  </motion.div></AnimatePresence></div>
                  <div className="android-navigation"><span /></div>
                  <AnimatePresence>{toast && <motion.div key="toast" className="mobile-toast" role="status" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><span>{toast}</span><button aria-label="关闭提示" onClick={() => setToast('')}><Icon name="close" size={14} /></button></motion.div>}</AnimatePresence>
                  <AnimatePresence>{deleteTarget && <motion.div className="mobile-dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteTarget(null)}><motion.div className="m3-dialog" ref={deleteDialogRef} role="alertdialog" aria-modal="true" aria-labelledby="delete-title" initial={{ y: 14, scale: .96 }} animate={{ y: 0, scale: 1 }} onClick={(event) => event.stopPropagation()}><Icon name="trash" size={25} /><h2 id="delete-title">删除这台服务器？</h2><p>将从本地移除「{deleteTarget.name}」的配置。{currentId === deleteTarget.id && '当前连接也会断开。'}<br /><br />此操作不会删除服务器上的任何数据。</p><div className="dialog-actions"><AppButton kind="text" onClick={() => setDeleteTarget(null)}>取消</AppButton><AppButton kind="text" className="danger-text" onClick={deleteServer}>删除服务器</AppButton></div></motion.div></motion.div>}</AnimatePresence>
                </div>
              </div>
            </div>
            <div className="device-bottom-caption"><span className={`preview-live-dot ${flowActive ? 'running' : ''}`} />{flowActive ? '演示正在运行，可随时取消' : '可交互预览'}<span className="caption-separator">·</span><span>{currentScene.label}</span></div>
          </section>

          <aside className="scene-inspector" aria-label="当前场景说明"><AnimatePresence mode="wait" initial={false}><motion.div key={scene} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .18 }}>
            <div className="inspector-eyebrow"><span>{(sceneIndex + 1).toString().padStart(2, '0')}</span><i />{currentScene.group === 'connection' ? '连接状态' : '场景说明'}</div><h2>{currentScene.title}</h2><p className="inspector-description">{currentScene.description}</p>
            {currentScene.group === 'connection' && <div className="preview-protocol"><div><span>通信方式</span><span>切换预览</span></div><div className="desktop-segmented"><button className={activeServer.mode === 'http' ? 'selected' : ''} onClick={() => selectScene('connected')} aria-pressed={activeServer.mode === 'http'}>{activeServer.mode === 'http' && <Icon name="check" size={13} />}HTTP</button><button className={activeServer.mode === 'ws' ? 'selected' : ''} onClick={() => selectScene('ws-connected')} aria-pressed={activeServer.mode === 'ws'}>{activeServer.mode === 'ws' && <Icon name="check" size={13} />}WebSocket</button></div></div>}
            <div className="design-notes" aria-label="设计说明">{currentScene.notes.map((note, index) => <div className="design-note" key={note.title}><span>{(index + 1).toString().padStart(2, '0')}</span><div><h4>{note.title}</h4><p>{note.text}</p></div></div>)}</div>
            <div className="quick-states"><div className="inspector-section-heading"><h3>{currentScene.group === 'connection' ? '更多连接状态' : '相关场景'}</h3><span>独立预览</span></div>{quickScenes.map((id) => { const item = SCENES.find((entry) => entry.id === id)!; return <button className={`quick-state ${scene === id ? 'selected' : ''} ${id === 'failed' ? 'error-state' : ''}`} key={id} onClick={() => selectScene(id)}><span className={`quick-state-symbol ${id}`}><Icon name={item.icon} size={15} /></span><span>{id === 'connected' ? '连接成功' : item.label}</span>{scene === id ? <Icon name="check" size={14} /> : <Icon name="arrowUpRight" size={13} />}</button>; })}</div>
            <div className="flow-demo">{(currentScene.group === 'connection' || isManage || isForm) && <label><span>模拟连接结果</span><select aria-label="模拟连接结果" value={connectionOutcome} onChange={(event) => setConnectionOutcome(event.target.value as 'success' | 'failure')}><option value="success">连接成功</option><option value="failure">连接超时</option></select></label>}{isDiscovery && <label><span>模拟发现结果</span><select aria-label="模拟发现结果" value={scanOutcome} onChange={(event) => setScanOutcome(event.target.value as 'found' | 'empty')}><option value="found">发现 2 台设备</option><option value="empty">未发现设备</option></select></label>}<button className="play-flow-button" onClick={runScenario}><Icon name="play" size={13} />{demoLabel}<Icon name="arrowRight" size={14} /></button></div>
            <button className="simulation-note" onClick={() => setWorkbenchDialog('about')}><Icon name="info" size={13} /><span>{storageAvailable ? '设备发现与连接均为本地模拟' : '本地存储不可用，配置仅在本次会话保留'}</span></button>
          </motion.div></AnimatePresence></aside>
        </div>
        <footer className="workspace-footer"><span>LESS FRICTION. MORE CONNECTION.</span><span><kbd>←</kbd><kbd>→</kbd>切换场景</span></footer>
      </main>
    </div>
    <AnimatePresence>{workbenchDialog && <motion.div className="workbench-dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setWorkbenchDialog(null)}><motion.div className="workbench-dialog" ref={workbenchDialogRef} role="dialog" aria-modal="true" aria-labelledby="workbench-dialog-title" initial={{ opacity: 0, y: 15, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(event) => event.stopPropagation()}><button className="dialog-close icon-button" aria-label="关闭对话框" onClick={() => setWorkbenchDialog(null)}><Icon name="close" size={18} /></button><span className="dialog-illustration"><Icon name={workbenchDialog === 'about' ? 'link' : 'reset'} size={28} /></span><h2 id="workbench-dialog-title">{workbenchDialog === 'about' ? '近联，让本地连接更简单' : '恢复原型的初始状态？'}</h2>{workbenchDialog === 'about' ? <><p>一个遵循 Material 3 的 Android 局域网连接原型，包含 21 个可以独立打开的场景。</p><div className="about-details"><p><Icon name="smartphone" size={17} /><span>独立场景会停留，便于检查细节。点击播放流程或在交互预览中重新启动，可体验完整流程。</span></p><p><Icon name="scan" size={17} /><span>预置两台示例服务器，扫描与连接均为模拟。原生应用应使用 mDNS / DNS-SD 进行服务发现。</span></p><p><Icon name="shieldCheck" size={17} /><span>配置保存在当前浏览器，TLS 不会自动降级。仅连接成功后才会更新默认设备。</span></p></div><AppButton onClick={() => setWorkbenchDialog(null)}>开始探索</AppButton></> : <><p>这会移除你在原型中添加或修改的配置，恢复两台示例服务器、自动连接偏好和初始场景。</p><p className="reset-hint">仅影响当前浏览器内的原型数据。</p><div className="dialog-actions"><AppButton kind="text" onClick={() => setWorkbenchDialog(null)}>取消</AppButton><AppButton onClick={resetPrototype}>确认重置</AppButton></div></>}</motion.div></motion.div>}</AnimatePresence>
  </div></MotionConfig>;
}
