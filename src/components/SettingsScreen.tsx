import { useEffect, useId, useState } from 'react';
import { SETTING_LIMITS, type Preferences } from '../data/servers';
import { PageIntro, Toggle } from './MobileUI';
import { Icon } from './Icon';

function SecondsField({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const id = useId();
  useEffect(() => setDraft(String(value)), [value]);
  const valid = /^\d+$/.test(draft) && Number(draft) >= min && Number(draft) <= max;
  return <div className="seconds-field">
    <label htmlFor={id}>{label}</label>
    <div><input id={id} type="number" inputMode="numeric" min={min} max={max} step={1} value={draft}
      aria-invalid={!valid} aria-describedby={!valid ? id + '-error' : undefined}
      onChange={event => {
        const input = event.target.value;
        setDraft(input);
        if (/^\d+$/.test(input) && Number(input) >= min && Number(input) <= max) onChange(Number(input));
      }} onBlur={() => { if (!valid) setDraft(String(value)); }} /><span>秒</span></div>
    {!valid && <small id={id + '-error'} role="alert">请输入 {min}–{max} 秒，暂时保留原设置</small>}
  </div>;
}

export function SettingsScreen({ preferences, onChange }: {
  preferences: Preferences; onChange: (patch: Partial<Preferences>) => void;
}) {
  const p = preferences;
  return <div className="settings-screen">
    <PageIntro eyebrow="YOUR CONNECTION, YOUR PACE" title="连接设置">少一点探测，按你的习惯连接。</PageIntro>
    <section className="settings-section" aria-labelledby="verification-title">
      <h2 id="verification-title"><Icon name="shieldCheck" size={17} />HTTP 在线验证</h2>
      <fieldset className="setting-choices"><legend className="sr-only">HTTP 在线验证方式</legend>
        <label className={'setting-choice ' + (p.httpMode === 'demand' ? 'selected' : '')}>
          <input type="radio" name="http-mode" value="demand" checked={p.httpMode === 'demand'} onChange={() => onChange({ httpMode: 'demand' })} />
          <span><strong>按需验证 <em>推荐</em></strong><small>首次连接时验证，成功后不定时探测。</small></span>
        </label>
        <label className={'setting-choice ' + (p.httpMode === 'poll' ? 'selected' : '')}>
          <input type="radio" name="http-mode" value="poll" checked={p.httpMode === 'poll'} onChange={() => onChange({ httpMode: 'poll' })} />
          <span><strong>定时轮询</strong><small>按设定间隔检查服务器是否仍在线。</small></span>
        </label>
      </fieldset>
      {p.httpMode === 'demand' ? <>
        <p className="setting-hint">减少服务器请求与终端日志输出。</p>
        <div className="nested-settings">
          <fieldset className="setting-choices"><legend>状态过期提示</legend>
            <label className="preference-option"><input type="radio" name="stale-hint" checked={!p.warnWhenStale} onChange={() => onChange({ warnWhenStale: false })} /><span><strong>不提示，保持在线显示</strong><small>持续显示绿色在线图标，不随时间变灰。</small></span></label>
            <label className="preference-option"><input type="radio" name="stale-hint" checked={p.warnWhenStale} onChange={() => onChange({ warnWhenStale: true })} /><span><strong>超过指定时长后提示</strong><small>状态变灰并提示可能已过期，可重新测试。</small></span></label>
          </fieldset>
          {p.warnWhenStale && <div className="nested-settings threshold-settings">
            <SecondsField label="过期提醒时长" value={p.staleAfterSeconds} {...SETTING_LIMITS.staleAfterSeconds} onChange={staleAfterSeconds => onChange({ staleAfterSeconds })} />
            <p className="setting-hint">只改变提示，不会自动发送验证请求。</p>
          </div>}
        </div>
      </> : <div className="nested-settings">
        <SecondsField label="轮询间隔" value={p.pollIntervalSeconds} {...SETTING_LIMITS.pollIntervalSeconds} onChange={pollIntervalSeconds => onChange({ pollIntervalSeconds })} />
        <p className="setting-hint">默认 5 秒。更长的间隔可减少请求与日志。</p>
      </div>}
    </section>
    <section className="settings-section" aria-labelledby="reconnection-title">
      <h2 id="reconnection-title"><Icon name="refresh" size={17} />连接偏好</h2>
      <div className="setting-toggle"><div><h3>下次打开自动连接</h3><p>直接连接上次成功使用的服务器。</p></div><Toggle checked={p.autoConnect} onChange={() => onChange({ autoConnect: !p.autoConnect })} label="下次打开自动连接" /></div>
      <div className="setting-toggle"><div><h3>失败后自动重连</h3><p>最多尝试 3 次，主动断开后不会重连。</p></div><Toggle checked={p.autoReconnect} onChange={() => onChange({ autoReconnect: !p.autoReconnect })} label="失败后自动重连" /></div>
      {p.autoReconnect && <div className="nested-settings"><SecondsField label="重试等待间隔" value={p.retryIntervalSeconds} {...SETTING_LIMITS.retryIntervalSeconds} onChange={retryIntervalSeconds => onChange({ retryIntervalSeconds })} /></div>}
    </section>
    <p className="settings-saved"><Icon name="check" size={13} />设置自动保存</p>
  </div>;
}
