import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  CreditCard,
  LockKeyhole,
  Nfc,
  Plus,
  RadioTower,
  RotateCcw,
  Send,
  Server,
  Smartphone,
  Unplug,
  WalletCards,
  Wifi,
  Zap,
} from "lucide-react";
import type { WalletCard, Binding, OutputRule, MappingMode } from "./model";
type ScanState = "idle" | "reading" | "sent";
const groupNumber = (value: string) => value.match(/.{1,4}/g)?.join(" ") ?? value;
const maskEndpoint = (value: string) => value.replace(/^https?:\/\/|^ws:\/\//, "");
export function ReaderScreen({
  scanState,
  rule,
  mappingMode,
  ruleName,
  endpoint,
  serverName,
  connectionLabel,
  fixedCard,
  onScan,
  onReset,
  onOpenRules,
  onOpenServer,
  onWallet,
  onManual,
  feedback,
}: {
  scanState: ScanState;
  rule: OutputRule;
  mappingMode: MappingMode;
  ruleName: string;
  endpoint: string;
  serverName: string;
  connectionLabel: string;
  fixedCard: WalletCard | undefined;
  onScan: () => void;
  onReset: () => void;
  onOpenRules: () => void;
  onOpenServer: () => void;
  onWallet: () => void;
  onManual: () => void;
  feedback: React.ReactNode;
}) {
  const targetName =
    rule === "mapping"
      ? mappingMode === "fixed"
        ? (fixedCard?.name ?? "未选择固定卡号")
        : "按实体卡匹配"
      : rule === "access"
        ? "20 位 Access Code"
        : "原始 IDm / UID";

  return (
    <>
      <header className="topbar reader-topbar">
        <div>
          <p className="brand-mark">TAPLINK</p>
          <h1>读卡</h1>
        </div>
        <button className="connection-chip" onClick={onOpenServer}>
          <span className={connectionLabel === "已连接" ? "status-dot" : "status-dot offline"} />
          {serverName}
          <ChevronRight size={15} />
        </button>
      </header>

      <section className="reader-body">
        <button className="rule-inline" onClick={onOpenRules}>
          <span>
            <RouteGlyph />
            输出规则
          </span>
          <strong>{ruleName}</strong>
          <ChevronRight size={17} />
        </button>

        <div className={`scan-stage scan-${scanState}`}>
          <div className="nfc-orbit">
            <span className="orbit orbit-one" />
            <span className="orbit orbit-two" />
            <motion.button
              className="scan-core"
              disabled={scanState === "reading"}
              whileTap={{ scale: 0.95 }}
              onClick={scanState === "sent" ? onReset : onScan}
              aria-label={scanState === "sent" ? "模拟移开卡片" : "模拟 NFC 读卡"}
            >
              {scanState === "sent" ? (
                <RotateCcw size={40} strokeWidth={2.4} />
              ) : (
                <Nfc size={44} strokeWidth={1.8} />
              )}
            </motion.button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              className="scan-copy"
              key={scanState}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
            >
              <h2>
                {scanState === "idle" && "将卡片贴近手机背面"}
                {scanState === "reading" && "正在处理卡片..."}
                {scanState === "sent" && "本次处理完成"}
              </h2>
              <p>
                {scanState === "idle" && "应用保持在前台时自动感应"}
                {scanState === "reading" && "请暂时不要移开卡片"}
                {scanState === "sent" && "移开卡片后可再次读取"}
              </p>
            </motion.div>
          </AnimatePresence>

          {scanState === "sent" && (
            <motion.div
              className="send-result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span>当前规则</span>
              <span>{targetName}</span>
            </motion.div>
          )}

          {scanState === "idle" && (
            <button className="simulate-link" onClick={onScan}>
              原型中点击此处模拟刷卡
            </button>
          )}
        </div>

        {feedback}
        <div className="reader-actions">
          <button onClick={onManual}>
            <CreditCard size={20} />
            <span>
              <strong>手动输入</strong>
              <small>直接发送一个卡号</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button onClick={onWallet}>
            <WalletCards size={20} />
            <span>
              <strong>从卡包发送</strong>
              <small>无需寻找实体卡</small>
            </span>
            <ChevronRight size={18} />
          </button>
        </div>

        <button className="server-line" onClick={onOpenServer}>
          <Wifi size={15} />
          <span>{connectionLabel} · {maskEndpoint(endpoint)}</span>
          
        </button>
      </section>
    </>
  );
}


export function WalletScreen({
  cards,
  bindings,
  rule,
  mappingMode,
  ruleName,
  walletTab,
  fixedCard,
  onTab,
  onOpenRules,
  onAddCard,
  onAddBinding,
  onCardDetail,
  onSend,
}: {
  cards: WalletCard[];
  bindings: Binding[];
  rule: OutputRule;
  mappingMode: MappingMode;
  ruleName: string;
  walletTab: "cards" | "bindings";
  fixedCard: WalletCard | undefined;
  onTab: (tab: "cards" | "bindings") => void;
  onOpenRules: () => void;
  onAddCard: () => void;
  onAddBinding: () => void;
  onCardDetail: (cardId: string) => void;
  onSend: (card: WalletCard) => void;
}) {
  return (
    <>
      <header className="topbar wallet-topbar">
        <div>
          <p className="eyebrow">我的身份</p>
          <h1>卡包</h1>
        </div>
        <motion.button
          className="round-add"
          whileTap={{ scale: 0.9 }}
          onClick={onAddCard}
          aria-label="添加卡号"
        >
          <Plus size={23} />
        </motion.button>
      </header>

      <div className="wallet-intro">
        <p>保存常用卡号；映射规则下，实体卡用来触发选定身份。</p>
        <button onClick={onOpenRules}>
          <RouteGlyph />
          <span>当前规则</span>
          <strong>{ruleName}</strong>
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="segmented" role="tablist">
        <button
          className={walletTab === "cards" ? "active" : ""}
          onClick={() => onTab("cards")}
          role="tab"
          aria-selected={walletTab === "cards"}
        >
          卡号 <span>{cards.length}</span>
        </button>
        <button
          className={walletTab === "bindings" ? "active" : ""}
          onClick={() => onTab("bindings")}
          role="tab"
          aria-selected={walletTab === "bindings"}
        >
          实体卡绑定 <span>{mappingMode === "fixed" ? (fixedCard ? 1 : 0) : bindings.length}</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {walletTab === "cards" ? (
          <motion.section
            key="cards"
            className="wallet-list"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
          >
            <div className="section-heading">
              <div>
                <h2>已保存的卡号</h2>
                <p>Access Code 可直接发送；UID/IDm 需目标协议支持</p>
              </div>
            </div>

            {cards.length === 0 && <p className="empty-state">卡包还是空的，添加第一张卡吧。</p>}
            {cards.map((card, index) => (
              <motion.article
                className="wallet-card"
                key={card.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                style={{ "--card-accent": card.accent } as React.CSSProperties}
              >
                <button
                  className="card-main"
                  onClick={() => onCardDetail(card.id)}
                >
                  <span className="card-symbol">
                    <CreditCard size={20} />
                  </span>
                  <span className="card-copy">
                    <span className="card-title-row">
                      <strong>{card.name}</strong>
                      <small>{card.kind}</small>
                    </span>
                    <code>{groupNumber(card.number)}</code>
                    <span className="binding-count">
                      {bindings.filter((binding) => binding.cardId === card.id).length >
                      0
                        ? `${bindings.filter((binding) => binding.cardId === card.id).length} 张实体卡可触发`
                        : "尚未绑定实体卡"}
                    </span>
                  </span>
                </button>
                <button
                  className="send-card"
                  onClick={() => onSend(card)}
                  aria-label={`发送${card.name}`}
                >
                  <Send size={18} />
                  发送
                </button>
              </motion.article>
            ))}

            <button className="text-action" onClick={onAddCard}>
              <Plus size={17} />
              添加一个卡号
            </button>
          </motion.section>
        ) : (
          <motion.section
            key="bindings"
            className="binding-list"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
          >
            <div className="section-heading">
              <div>
                <h2>触发关系</h2>
                <p>左侧读到的实体卡，转换为右侧卡号再发送</p>
              </div>
              <CircleHelp size={19} />
            </div>

            {rule !== "mapping" ? (
              <div className="empty-mapping">
                <Unplug size={28} />
                <h3>当前规则不使用映射</h3>
                <p>切换到“映射到卡包身份”后，实体卡绑定才会生效。</p>
                <button onClick={onOpenRules}>更改规则</button>
              </div>
            ) : mappingMode === "fixed" ? (
              <div className="fixed-map">
                <div className="map-node source-node">
                  <span className="node-icon">
                    <RadioTower size={20} />
                  </span>
                  <span>
                    <small>任意实体卡</small>
                    <strong>任意 IDm / UID</strong>
                  </span>
                </div>
                <span className="down-link">
                  <ArrowDown size={19} />
                </span>
                <div className="map-node target-node">
                  <span
                    className="target-accent"
                    style={{ background: fixedCard?.accent }}
                  />
                  <span>
                    <small>固定发送</small>
                    <strong>{(fixedCard?.name ?? "未选择固定卡号")}</strong>
                    <code>{groupNumber((fixedCard?.number ?? ""))}</code>
                  </span>
                </div>
                <button className="outline-button" onClick={onOpenRules}>
                  更换固定卡号
                </button>
              </div>
            ) : (
              <>
                <div className="mapping-table-head">
                  <span>实体触发卡</span>
                  <span />
                  <span>发送身份</span>
                </div>
                <div className="mapping-rows">
                  {bindings.map((binding) => {
                    const target = cards.find(
                      (card) => card.id === binding.cardId,
                    );
                    if (!target) return null;
                    return (
                      <button
                        className="mapping-row"
                        key={binding.id}
                        onClick={() => onCardDetail(target.id)}
                      >
                        <span className="mapping-source">
                          <small>IDm / UID</small>
                          <code>{groupNumber(binding.source)}</code>
                        </span>
                        <span className="mapping-arrow">
                          <ArrowRight size={18} />
                        </span>
                        <span className="mapping-target">
                          <i style={{ background: target.accent }} />
                          <span>
                            <strong>{target.name}</strong>
                            <small>{target.kind}</small>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button className="text-action" onClick={onAddBinding}>
                  <Plus size={17} />
                  绑定一张实体卡
                </button>
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}


export function ReaderSettings({
  ruleName,
  endpoint,
  serverName,
  connectionLabel,
  vibration,
  onVibration,
  onOpenServer,
  onOpenRules,
}: {
  ruleName: string;
  endpoint: string;
  serverName: string;
  connectionLabel: string;
  vibration: boolean;
  onVibration: (enabled: boolean) => void;
  onOpenServer: () => void;
  onOpenRules: () => void;
}) {
  return (
    <>
      <header className="topbar settings-topbar">
        <div>
          <p className="eyebrow">NFC Relay</p>
          <h1>设置</h1>
        </div>
      </header>

      <section className="settings-section">
        <h2>连接</h2>
        <button className="settings-row" onClick={onOpenServer}>
          <span className="settings-icon online">
            <Server size={20} />
          </span>
          <span className="settings-copy">
            <strong>{serverName}</strong>
            <small>{maskEndpoint(endpoint)}</small>
          </span>
          <span className="online-label">{connectionLabel}</span>
          <ChevronRight size={18} />
        </button>
      </section>

      <section className="settings-section">
        <h2>读卡与发送</h2>
        <button className="settings-row" onClick={onOpenRules}>
          <span className="settings-icon purple">
            <RouteGlyph />
          </span>
          <span className="settings-copy">
            <strong>卡号处理</strong>
            <small>{ruleName}</small>
          </span>
          <ChevronRight size={18} />
        </button>
        <div className="settings-row static-row">
          <span className="settings-icon orange">
            <Zap size={20} />
          </span>
          <span className="settings-copy">
            <strong>读取后直接发送</strong>
            <small>新卡询问一次是否保存，发送不等待选择</small>
          </span>
          <span className="always-on">始终</span>
        </div>
        <div className="settings-row static-row">
          <span className="settings-icon gray">
            <Smartphone size={20} />
          </span>
          <span className="settings-copy">
            <strong>发送成功后振动</strong>
            <small>便于不看屏幕确认结果</small>
          </span>
          <button
            className={`switch ${vibration ? "on" : ""}`}
            onClick={() => onVibration(!vibration)}
            aria-label="切换振动"
          >
            <span />
          </button>
        </div>
      </section>

      <div className="settings-note">
        <LockKeyhole size={18} />
        <p>卡号保存在当前浏览器；首次新卡询问一次，也可从卡包主动添加。</p>
      </div>

      <p className="version">NFC Relay · Prototype 0.1</p>
    </>
  );
}


export function RulesSheet({
  draftRule,
  draftMappingMode,
  cards,
  fixedCardId,
  onRule,
  onMappingMode,
  onFixedCard,
  onApply,
}: {
  draftRule: OutputRule;
  draftMappingMode: MappingMode;
  cards: WalletCard[];
  fixedCardId: string;
  onRule: (rule: OutputRule) => void;
  onMappingMode: (mode: MappingMode) => void;
  onFixedCard: (id: string) => void;
  onApply: () => void;
}) {
  const options: Array<{
    id: OutputRule;
    title: string;
    detail: string;
  }> = [
    {
      id: "raw",
      title: "原始卡号直发",
      detail: "发送原始标识；AMNet 不支持 UID/IDm-only",
    },
    {
      id: "access",
      title: "读取 Access Code",
      detail: "继续读取卡内数据取得 Access Code，不是仅凭 UID/IDm 转换",
    },
    {
      id: "mapping",
      title: "映射到卡包身份",
      detail: "实体卡触发一个已保存的目标卡号",
    },
  ];

  return (
    <div className="rules-sheet">
      <p className="sheet-lead">
        规则保存在当前服务器下。只有明确发送时才验证并提交。
      </p>

      <div className="radio-list">
        {options.map((option) => (
          <button
            className={draftRule === option.id ? "selected" : ""}
            key={option.id}
            onClick={() => onRule(option.id)}
          >
            <RadioMark selected={draftRule === option.id} />
            <span>
              <strong>{option.title}</strong>
              <small>{option.detail}</small>
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence>
        {draftRule === "mapping" && (
          <motion.div
            className="mapping-options"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <h3>映射方式</h3>
            <button
              className={draftMappingMode === "fixed" ? "selected" : ""}
              onClick={() => onMappingMode("fixed")}
            >
              <RadioMark selected={draftMappingMode === "fixed"} />
              <span>
                <strong>统一固定卡号</strong>
                <small>任意实体卡都发送同一个目标卡号</small>
              </span>
            </button>
            <button
              className={draftMappingMode === "per-card" ? "selected" : ""}
              onClick={() => onMappingMode("per-card")}
            >
              <RadioMark selected={draftMappingMode === "per-card"} />
              <span>
                <strong>逐卡绑定</strong>
                <small>不同实体卡分别对应一个目标卡号</small>
              </span>
            </button>

            {draftMappingMode === "fixed" && (
              <div className="fixed-picker">
                <label>固定发送</label>
                <div>
                  {cards.map((card) => (
                    <button
                      key={card.id}
                      className={fixedCardId === card.id ? "active" : ""}
                      onClick={() => onFixedCard(card.id)}
                    >
                      <i style={{ background: card.accent }} />
                      <span>{card.name}</span>
                      {fixedCardId === card.id && <Check size={17} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <button className="primary-button" onClick={onApply}>
        应用此规则
      </button>
    </div>
  );
}


export function RadioMark({ selected }: { selected: boolean }) {
  return <span className={`radio-mark ${selected ? "selected" : ""}`} />;
}


export function RouteGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16" cy="16" r="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4 6v2.2c0 1.1.9 2 2 2h8c1.1 0 2 .9 2 2V14"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="m12.5 6.7 2.3-2.3a1.7 1.7 0 0 1 2.4 0l.4.4a1.7 1.7 0 0 1 0 2.4l-2.3 2.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
