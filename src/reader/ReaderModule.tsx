import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Nfc, Send, CreditCard } from 'lucide-react';
import type { ConnectionSnapshot } from '../connection/ConnectionController';
import { getAddress } from '../data/servers';
import { ReaderScreen, WalletScreen, ReaderSettings, RulesSheet } from './ImportedScreens';
import { defaultRule, deleteCard, normalizeNumber, readingKey, saveCard, SAMPLE_READING, validNumber,
  type CardKind, type Reading, type RuleConfig, type WalletCard } from './model';
import { type ReaderStore } from './ReaderStore';
import './reader.css';

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const siblings = document.querySelectorAll<HTMLElement>('.mobile-scroll, .bottom-navigation, .mobile-toolbar');
    siblings.forEach(node => { node.inert = true; });
    const frame = requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('button, input, select')?.focus());
    const marker = crypto.randomUUID();
    let mounted = true;
    // React's discarded development mount must not add a history entry.
    queueMicrotask(() => { if (mounted) history.pushState({ readerSheet: marker }, '', location.href); });
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    function back() { close.current(); }
    window.addEventListener('keydown', key, true);
    window.addEventListener('popstate', back);
    return () => {
      mounted = false;
      cancelAnimationFrame(frame); siblings.forEach(node => { node.inert = false; });
      window.removeEventListener('keydown', key, true); window.removeEventListener('popstate', back);
      if (history.state?.readerSheet === marker) history.back();
      previous?.focus();
    };
  }, []);
  return createPortal(<div className="taplink"><div className="sheet-layer">
    <button className="sheet-backdrop" onClick={onClose} aria-label="关闭" tabIndex={-1} />
    <section className="bottom-sheet" ref={ref} role="dialog" aria-modal="true" aria-labelledby="reader-sheet-title">
      <span className="drag-handle" /><header className="sheet-header"><h2 id="reader-sheet-title">{title}</h2><button onClick={onClose} aria-label="关闭弹窗"><X size={20} /></button></header>
      <div className="sheet-scroll">{children}</div>
    </section>
  </div></div>, document.querySelector('.mobile-display')!);
}

export function ReaderModule({ page, store, connection, serverId, onConnect, onWallet, fixture }: {
  page: 'reader' | 'wallet' | 'settings'; store: ReaderStore; connection: ConnectionSnapshot; serverId: string | null;
  onConnect: () => void; onWallet: () => void; fixture: 'success' | 'identifier-only' | 'failed' | 'unknown';
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const { data } = state;
  const config = (serverId && data.rules[serverId]) || defaultRule();
  const [sheet, setSheet] = useState<'rules' | 'add' | 'manual' | 'detail' | 'binding' | null>(null);
  const [draft, setDraft] = useState<RuleConfig>(config);
  const [tab, setTab] = useState<'cards' | 'bindings'>('cards');
  const [selectedId, setSelectedId] = useState('');
  const [flow, setFlow] = useState<'choose' | 'scan' | 'manual'>('choose');
  const [captured, setCaptured] = useState<Reading | null>(null);
  const [kind, setKind] = useState<CardKind>('Access Code');
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [targetId, setTargetId] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rebind, setRebind] = useState(false);
  useEffect(() => () => { store.cancelPending(); }, [store, page]);
  useEffect(() => { setSheet(null); }, [serverId]);
  const selected = data.cards.find(card => card.id === selectedId);
  const fixed = data.cards.find(card => card.id === config.fixedCardId);
  const ruleName = config.rule === 'raw' ? '原始卡号直发' : config.rule === 'access' ? '读取 Access Code' : config.mappingMode === 'fixed' ? '统一固定卡号' : '逐卡绑定';
  const connectionLabel = !serverId ? '未配置' : connection.stale ? '状态可能已过期' : ({ connected: '已连接', disconnected: '已断开', failed: '连接失败', connecting: '连接中', auto: '自动连接中', retrying: '重连中', 'retry-wait': '等待重连' }[connection.status]);
  const serverName = connection.server?.name ?? '未连接服务器';
  const endpoint = connection.server ? getAddress(connection.server) : '请选择服务器';
  function open(next: typeof sheet) {
    store.cancelPending(); setError(''); setCaptured(null); setFlow('choose'); setConfirmDelete(false); setRebind(false);
    setName(''); setNumber(''); setKind('Access Code'); setTargetId(data.cards[0]?.id ?? ''); setDraft(config); setSheet(next);
  }
  function updateRule(next: RuleConfig) {
    if (!serverId) { setError('请先添加服务器，再配置发送规则'); return false; }
    store.update({ ...data, rules: { ...data.rules, [serverId]: next } }); return true;
  }
  function read(): Reading | null {
    if (fixture === 'failed') { setError('卡片数据读取失败，请重新贴卡'); store.feedback('卡片数据读取失败，本次未发送'); return null; }
    return { ...SAMPLE_READING, source: fixture === 'unknown' ? '02F2A6C88D104B7E' : SAMPLE_READING.source,
      access: fixture === 'identifier-only' ? undefined : SAMPLE_READING.access };
  }
  function capture() {
    const result = read(); setCaptured(result);
    if (result) { setError(''); setNumber(result.access ?? result.source); setKind(result.access ? 'Access Code' : result.kind); setName('新卡'); }
  }
  function save() {
    try {
      let next = saveCard(data, { id: crypto.randomUUID(), name: name.trim() || '未命名卡', number, kind, accent: '#74547f' });
      if (captured) next = { ...next, asked: [...new Set([...next.asked, readingKey(captured)])] };
      store.update(next); setSheet(null); store.feedback('已存入卡包');
    } catch (e) { setError((e as Error).message); }
  }
  function bind() {
    if (!captured || !data.cards.some(card => card.id === targetId)) { setError('请先读取实体卡并选择目标卡号'); return; }
    const key = readingKey(captured);
    const existing = config.bindings.find(binding => readingKey(binding) === key);
    if (existing && existing.cardId !== targetId && !rebind) { setRebind(true); setError('这张实体卡已有绑定，再次确认将改绑到所选卡号。'); return; }
    if (updateRule({ ...config, bindings: [...config.bindings.filter(binding => readingKey(binding) !== key),
      { id: key, source: captured.source, kind: captured.kind, cardId: targetId }] })) {
      const latest = store.getSnapshot().data;
      store.update({ ...latest, asked: [...new Set([...latest.asked, key])] });
      setSheet(null); store.feedback('实体卡绑定已保存，请重新贴卡发送');
    }
  }
  async function send(card: Pick<WalletCard, 'kind' | 'number'>) {
    await store.send(card);
    if (store.getSnapshot().result.includes('服务器已接收') && data.vibration) navigator.vibrate?.(60);
  }
  const form = <div className="manual-form">
    {sheet !== 'manual' && <label className="field-label">名称<input value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="例如：主卡" /></label>}
    <label className="field-label">卡号类型<select value={kind} onChange={e => setKind(e.target.value as CardKind)}><option>Access Code</option><option>IDm</option><option>UID</option></select></label>
    <label className="field-label">卡号<input value={number} inputMode={kind === 'Access Code' ? 'numeric' : 'text'} onChange={e => setNumber(e.target.value)} placeholder={kind === 'Access Code' ? '20 位数字，保留前导零' : kind === 'IDm' ? '16 位十六进制' : '8、14 或 20 位十六进制'} /></label>
    {number && !validNumber(kind, normalizeNumber(number)) && <p role="alert">卡号格式不符合所选类型</p>}
    <button className="primary-button" disabled={!validNumber(kind, normalizeNumber(number)) || state.busy} onClick={sheet === 'manual' ? () => void send({ kind, number }) : save}>{sheet === 'manual' ? '立即发送' : '存入卡包'}</button>
  </div>;
  const result = <>{state.result && <p className="reader-feedback" role="status">{state.result}</p>}{!state.storageAvailable && <p role="alert">本地存储不可用，卡包仅在本次会话保留</p>}</>;
  const prompt = state.prompt && <section className="first-save"><strong>保存这张新卡？</strong><p>{state.prompt.access ? 'Access Code' : state.prompt.kind} · 尾号 {(state.prompt.access ?? state.prompt.source).slice(-4)}</p>
    <button onClick={() => store.answerPrompt(false)}>不保存</button><button onClick={() => store.answerPrompt(true)}>保存到卡包</button></section>;
  return <div className="taplink">
    {page === 'reader' && <><ReaderScreen scanState={state.busy ? 'reading' : state.held ? 'sent' : 'idle'} rule={config.rule} mappingMode={config.mappingMode} ruleName={ruleName} endpoint={endpoint} serverName={serverName} connectionLabel={connectionLabel} fixedCard={fixed}
      onScan={() => { if (sheet) return; const reading = read(); if (reading) void store.scan(reading, serverId); }} onReset={() => store.release()}
      onOpenRules={() => open('rules')} onOpenServer={onConnect} onWallet={onWallet} onManual={() => open('manual')} feedback={<>{result}{prompt}</>} />
      </>}
    {page === 'wallet' && <WalletScreen cards={data.cards} bindings={config.bindings} rule={config.rule} mappingMode={config.mappingMode} ruleName={ruleName} walletTab={tab} fixedCard={fixed} onTab={setTab}
      onOpenRules={() => open('rules')} onAddCard={() => open('add')} onAddBinding={() => open('binding')} onCardDetail={id => { setSelectedId(id); open('detail'); }} onSend={card => void send(card)} />}
    {page === 'settings' && <ReaderSettings ruleName={ruleName} endpoint={endpoint} serverName={serverName} connectionLabel={connectionLabel} vibration={data.vibration}
      onVibration={vibration => store.update({ ...data, vibration })} onOpenServer={onConnect} onOpenRules={() => open('rules')} />}
    {page !== 'reader' && <>{result}{prompt}</>}
    {sheet && <Sheet title={{ rules: '卡号处理', add: '添加卡号', manual: '手动发送', detail: '卡片详情', binding: '绑定实体卡' }[sheet]} onClose={() => setSheet(null)}>
      {sheet === 'rules' && <RulesSheet draftRule={draft.rule} draftMappingMode={draft.mappingMode} cards={data.cards} fixedCardId={draft.fixedCardId}
        onRule={rule => setDraft({ ...draft, rule })} onMappingMode={mappingMode => setDraft({ ...draft, mappingMode })} onFixedCard={fixedCardId => setDraft({ ...draft, fixedCardId })}
        onApply={() => { if (updateRule(draft)) setSheet(null); }} />}
      {sheet === 'manual' && <><p className="sheet-lead">只发送一次，不自动保存，也不应用 NFC 映射。</p>{form}</>}
      {sheet === 'add' && <>{flow === 'choose' ? <div className="add-options"><button onClick={() => setFlow('scan')}><Nfc size={24} /><span><strong>刷卡保存</strong><small>只保存，不发送</small></span></button><button onClick={() => setFlow('manual')}><CreditCard size={24} /><span>手动输入</span></button></div>
        : flow === 'manual' ? form : <><button className="compact-capture" onClick={capture}><Nfc size={24} />{captured ? '重新模拟读取' : '点击模拟 NFC 读取'}</button>{captured && form}</>}</>}
      {sheet === 'binding' && <div className="binding-flow"><p className="sheet-lead">实体卡触发所选身份，绑定本身不发送。</p><button className="compact-capture" onClick={() => { capture(); setRebind(false); }}><Nfc size={24} />{captured ? captured.kind + ' · ' + captured.source.slice(-4) : '点击模拟读取实体卡'}</button>
        <label className="field-label">发送身份<select value={targetId} onChange={e => { setTargetId(e.target.value); setRebind(false); }}><option value="">请选择卡包身份</option>{data.cards.map(card => <option key={card.id} value={card.id}>{card.name} · {card.kind}</option>)}</select></label>
        {!data.cards.length && <p>卡包为空，请先添加卡号。</p>}<button className="primary-button" disabled={!captured || !targetId} onClick={bind}>{rebind ? '确认改绑' : '完成绑定'}</button></div>}
      {sheet === 'detail' && selected && <div className="card-detail-sheet"><div className="detail-identity"><span className="detail-card-icon" style={{ background: selected.accent }}><CreditCard size={25} /></span><span><small>{selected.kind}</small><h3>{selected.name}</h3></span></div>
        <div className="number-block"><span>已保存卡号</span><code>{selected.number.match(/.{1,4}/g)?.join(' ')}</code></div>
        <label className="field-label">重命名<input defaultValue={selected.name} maxLength={60} onBlur={e => { const name = e.target.value.trim(); if (name && name !== selected.name) store.update({ ...data, cards: data.cards.map(card => card.id === selected.id ? { ...card, name } : card) }); }} /></label>
        <div className="detail-bindings"><h4>当前服务器的实体卡绑定</h4>{config.bindings.filter(binding => binding.cardId === selected.id).map(binding => <div key={binding.id}><span>{binding.kind} · {binding.source.slice(-4)}</span><button onClick={() => { setCaptured({ source: binding.source, kind: binding.kind }); setTargetId(binding.cardId); setRebind(false); setSheet('binding'); }}>改绑</button><button onClick={() => updateRule({ ...config, bindings: config.bindings.filter(item => item.id !== binding.id) })}>解绑</button></div>)}</div>
        <button className="primary-button" disabled={state.busy} onClick={() => void send(selected)}><Send size={17} /> 立即发送此卡号</button>
        {confirmDelete && <p role="alert">删除「{selected.name}」并清理所有服务器中关联的绑定和固定目标？</p>}
        <button className="text-action" onClick={() => { if (!confirmDelete) { setConfirmDelete(true); return; } store.update(deleteCard(data, selected.id)); setSheet(null); }}>{confirmDelete ? '确认删除及关联配置' : '删除卡号'}</button>
      </div>}
      {error && <p className="reader-feedback" role="alert">{error}</p>}{(sheet === 'manual' || sheet === 'detail') && result}
    </Sheet>}
  </div>;
}
