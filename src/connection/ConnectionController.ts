import { normalizePreferences, type Preferences, type ServerConfig } from '../data/servers.ts';
import { type ServerInfo, type VerifyServer } from './amnet.ts';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'auto' | 'failed' | 'retrying' | 'retry-wait';
export interface ConnectionSnapshot {
  server: ServerConfig | null;
  status: ConnectionStatus;
  stale: boolean;
  lastVerifiedAt: number | null;
  attempt: number;
  countdown: number;
  checking: boolean;
  error: string | null;
  info: ServerInfo | null;
  validationCount: number;
}
export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(timer: unknown): void;
}
const clock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: timer => clearTimeout(timer as ReturnType<typeof setTimeout>),
};

/** Owns the connection independently of routes. Navigation never starts a request. */
export class ConnectionController {
  private state: ConnectionSnapshot = {
    server: null, status: 'disconnected', stale: false, lastVerifiedAt: null,
    attempt: 1, countdown: 0, checking: false, error: null, info: null, validationCount: 0,
  };
  private listeners = new Set<() => void>();
  private preferences: Preferences;
  private verify: VerifyServer;
  private clock: Clock;
  private onSuccess: (server: ServerConfig) => void;
  private timer: unknown;
  private request: AbortController | null = null;
  private requestKind: 'connect' | 'poll' | 'recheck' | null = null;
  private generation = 0;
  private retryAt = 0;
  private retryAttempt = 1;
  private recovering = false;

  constructor(preferences: Preferences, verify: VerifyServer, onSuccess: (server: ServerConfig) => void, scheduler: Clock = clock) {
    this.preferences = normalizePreferences(preferences);
    this.verify = verify;
    this.onSuccess = onSuccess;
    this.clock = scheduler;
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<ConnectionSnapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private clearTimer() { if (this.timer !== undefined) this.clock.clearTimeout(this.timer); this.timer = undefined; }
  private stop() {
    this.clearTimer();
    this.generation++;
    this.request?.abort();
    this.request = null;
    this.requestKind = null;
  }
  dispose() { this.stop(); }
  setPreferences(preferences: Preferences) {
    const old = this.preferences;
    this.preferences = normalizePreferences(preferences);
    if (this.requestKind === 'poll' && this.preferences.httpMode !== 'poll') {
      this.stop();
      this.publish({ checking: false });
    }
    if (this.state.status === 'retry-wait') {
      if (!this.preferences.autoReconnect) this.disconnect();
      else if (old.retryIntervalSeconds !== this.preferences.retryIntervalSeconds) this.waitForRetry(this.retryAttempt);
    } else if (this.state.status === 'connected') this.scheduleConnected();
  }
  connect(server: ServerConfig, automatic = false) {
    this.stop();
    this.recovering = false;
    this.publish({ server, status: automatic ? 'auto' : 'connecting', attempt: 1, countdown: 0,
      lastVerifiedAt: null, stale: false, error: null, info: null, checking: false });
    void this.check('connect');
  }
  disconnect() {
    this.stop();
    this.publish({ status: 'disconnected', stale: false, checking: false, countdown: 0 });
  }
  remoteDisconnect() {
    if (this.state.status !== 'connected') return;
    this.stop();
    this.recovering = true;
    this.publish({ status: 'disconnected', checking: false, stale: false, error: '服务器连接已断开' });
    if (this.preferences.autoReconnect) this.waitForRetry(1);
  }
  recheck() {
    if (this.state.status !== 'connected' || !this.state.stale || this.state.checking) return;
    this.clearTimer();
    void this.check('recheck');
  }
  private async check(kind: 'connect' | 'poll' | 'recheck') {
    const server = this.state.server;
    if (!server || this.request) return;
    const generation = this.generation;
    const request = new AbortController();
    this.request = request;
    this.requestKind = kind;
    this.publish({ checking: true, validationCount: this.state.validationCount + 1 });
    try {
      const info = await this.verify(server, request.signal);
      if (generation !== this.generation || request.signal.aborted) return;
      this.request = null; this.requestKind = null;
      const successfulServer = { ...server, lastSuccess: this.clock.now() };
      this.publish({ server: successfulServer, status: 'connected', lastVerifiedAt: this.clock.now(),
        stale: false, error: null, checking: false, countdown: 0, info });
      this.onSuccess(successfulServer);
      this.scheduleConnected();
    } catch (error) {
      if (generation !== this.generation || request.signal.aborted) return;
      this.request = null; this.requestKind = null;
      if (kind !== 'connect') this.recovering = true;
      this.publish({ status: kind === 'connect' && !this.recovering ? 'failed' : 'disconnected', checking: false, stale: false,
        error: error instanceof Error ? error.message : '服务器验证失败' });
      // An explicit stale-state retest is exactly one request, even if retries are enabled.
      if (kind !== 'recheck' && this.preferences.autoReconnect && (kind !== 'connect' || this.state.attempt < 3)) {
        this.waitForRetry(kind === 'connect' ? this.state.attempt + 1 : 1);
      }
    }
  }
  private waitForRetry(attempt: number) {
    this.clearTimer();
    this.retryAttempt = attempt;
    this.retryAt = this.clock.now() + this.preferences.retryIntervalSeconds * 1000;
    const tick = () => {
      const countdown = Math.max(0, Math.ceil((this.retryAt - this.clock.now()) / 1000));
      if (countdown === 0) {
        this.publish({ status: 'retrying', attempt, countdown: 0 });
        void this.check('connect');
      } else {
        this.publish({ status: 'retry-wait', countdown });
        this.timer = this.clock.setTimeout(tick, Math.min(1000, this.retryAt - this.clock.now()));
      }
    };
    tick();
  }
  retryNow() {
    if (this.state.status !== 'retry-wait') return;
    this.clearTimer();
    this.publish({ status: 'retrying', attempt: this.retryAttempt, countdown: 0 });
    void this.check('connect');
  }
  private scheduleConnected() {
    this.clearTimer();
    if (this.state.status !== 'connected' || !this.state.server) return;
    const http = this.state.server.mode === 'http';
    const { httpMode, warnWhenStale, staleAfterSeconds, pollIntervalSeconds } = this.preferences;
    const expiresIn = (this.state.lastVerifiedAt ?? this.clock.now()) + staleAfterSeconds * 1000 - this.clock.now();
    this.publish({ stale: http && httpMode === 'demand' && warnWhenStale && expiresIn <= 0 });
    if (!http || this.state.checking) return;
    if (httpMode === 'poll') {
      this.timer = this.clock.setTimeout(() => { void this.check('poll'); }, pollIntervalSeconds * 1000);
    } else if (warnWhenStale && expiresIn > 0) {
      this.timer = this.clock.setTimeout(() => this.scheduleConnected(), expiresIn);
    }
  }
  // Workbench fixtures do not persist fictitious successes.
  preview(server: ServerConfig, status: ConnectionStatus) {
    this.stop();
    this.recovering = false;
    this.publish({ server, status, stale: false, error: status === 'failed' ? '连接超时，请检查网络' : null,
      checking: false, attempt: 1, countdown: this.preferences.retryIntervalSeconds,
      lastVerifiedAt: status === 'connected' ? this.clock.now() : null, info: null });
    if (status === 'connected') this.scheduleConnected();
  }
  previewExpired() {
    if (this.state.status !== 'connected' || this.state.server?.mode !== 'http'
      || this.preferences.httpMode !== 'demand' || !this.preferences.warnWhenStale) return;
    this.publish({ lastVerifiedAt: this.clock.now() - this.preferences.staleAfterSeconds * 1000 });
    this.scheduleConnected();
  }
}
