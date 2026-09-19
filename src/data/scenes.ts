import type { IconName } from '../components/Icon';

export type SceneId =
  | 'connected' | 'ws-connected' | 'http-stale' | 'auto' | 'connecting'
  | 'failed' | 'retrying' | 'retry-wait' | 'retry-success' | 'disconnected'
  | 'canceled' | 'first' | 'scanning' | 'scan' | 'scan-empty' | 'manual'
  | 'edit' | 'unconfigured' | 'manage' | 'manage-empty' | 'home';

export type SceneGroup = 'connection' | 'configuration' | 'management' | 'business';

export interface Scene {
  id: SceneId;
  label: string;
  title: string;
  group: SceneGroup;
  icon: IconName;
  description: string;
  notes: { title: string; text: string }[];
}

export const SCENES: Scene[] = [
  {
    id: 'connected', label: '连接成功 · HTTP', title: '连接成功', group: 'connection', icon: 'checkCircle',
    description: '熟悉的服务器，已经为你准备就绪。',
    notes: [
      { title: '让状态诚实可见', text: '虚线状态环表示 HTTP 轮询。每 5 秒检查一次，顶部提示状态可能并非实时。' },
      { title: '记住成功的连接', text: '只在连接成功后更新默认服务器。下次直接连接，不重复扫描局域网。' },
      { title: '首页，只保留必要操作', text: '连接、重连与切换触手可及。协议和加密设置，留在配置页面。' },
    ],
  },
  {
    id: 'ws-connected', label: '连接成功 · WebSocket', title: '实时连接已建立', group: 'connection', icon: 'radio',
    description: '保持一条连接，让设备状态实时同步。',
    notes: [
      { title: '实时，不等于轮询', text: 'WebSocket 保持双向连接，通过心跳确认活跃状态，不显示 HTTP 轮询提示。' },
      { title: '安全独立设置', text: 'WSS 表示 WebSocket + TLS。切换通信方式不会关闭加密或清空路径。' },
      { title: '主动断开，明确反馈', text: '断开会结束实时会话，但保留配置，随时可以重新连接。' },
    ],
  },
  {
    id: 'auto', label: '启动自动连接', title: '正在自动连接', group: 'connection', icon: 'refresh',
    description: '打开应用，从上次成功的连接继续。',
    notes: [
      { title: '不再重复发现', text: '读取上次成功使用的服务器，直接使用已保存的地址、协议和 TLS 设置。' },
      { title: '始终可以取消', text: '连接过程中提供取消操作，取消不会删除配置或改变默认服务器。' },
      { title: '成功后进入首页', text: '运行演示后，连接成功会自动进入业务首页；失败则停留并保留配置。' },
    ],
  },
  {
    id: 'connecting', label: '正在连接', title: '正在连接', group: 'connection', icon: 'loading',
    description: '正在与你的局域网服务器建立连接。',
    notes: [
      { title: '可感知的等待', text: '轻量旋转指示器清晰传达进行中状态，不把尚未确认的设备标记为可用。' },
      { title: '使用确定的配置', text: 'HTTP 发起状态请求，WebSocket 建立实时会话；两种方式均遵循 TLS 设置。' },
      { title: '让用户掌握节奏', text: '支持取消连接、修改配置或切换服务器，所有操作都会停止当前连接尝试。' },
    ],
  },
  {
    id: 'failed', label: '连接失败', title: '连接失败', group: 'connection', icon: 'alert',
    description: '连接遇到一点问题，配置仍然为你保留。',
    notes: [
      { title: '明确，但不制造焦虑', text: '浅珊瑚红传达异常，给出网络与服务检查建议，并突出重新连接。' },
      { title: '失败不覆盖默认设备', text: '保留当前填写的配置，上次成功的服务器不会被失败的尝试替换。' },
      { title: '不自动降低安全等级', text: 'TLS 或证书错误不会触发明文回退。请检查配置后再主动重试。' },
    ],
  },
  {
    id: 'retrying', label: '正在重试', title: '正在重新连接', group: 'connection', icon: 'refresh',
    description: '使用原有配置，再试一次。',
    notes: [
      { title: '重试过程可见', text: '展示当前尝试次数和进度，最多尝试 3 次，避免无限重连。' },
      { title: '保持原有通信设置', text: '重试沿用已选协议、路径和 TLS 设置，不重新扫描、不自动降级。' },
      { title: '随时停止', text: '点击取消后立即停止后续重试与等待计时，配置保持不变。' },
    ],
  },
  {
    id: 'retry-wait', label: '等待下次重试', title: '稍后，再试一次', group: 'connection', icon: 'clock',
    description: '短暂等待，给设备一点响应时间。',
    notes: [
      { title: '有节奏地重试', text: '失败后等待 5 秒再发起下一次连接，避免持续请求给服务器增加负担。' },
      { title: '等待不等于失控', text: '展示倒计时，并支持立即重试或取消后续尝试。' },
      { title: '状态与尝试分开', text: '等待时不声称服务器可用，只有收到有效响应才更新连接状态。' },
    ],
  },
  {
    id: 'retry-success', label: '重试成功', title: '重新连接成功', group: 'connection', icon: 'checkCircle',
    description: '连接恢复，继续刚才的日常。',
    notes: [
      { title: '用轻量反馈结束等待', text: '状态卡片恢复为浅紫色，清晰说明重连成功，不保留无关错误信息。' },
      { title: '此刻更新默认设备', text: '只有成功响应才写入上次成功使用的服务器，自动连接将使用这份配置。' },
      { title: '继续到业务首页', text: '运行中的连接流程成功后自动进入首页，独立预览则保留这一状态。' },
    ],
  },
  {
    id: 'http-stale', label: 'HTTP 状态待更新', title: '状态，等待确认', group: 'connection', icon: 'clock',
    description: '上次可用，不代表此刻仍然在线。',
    notes: [
      { title: '不把旧状态当成实时', text: 'HTTP 轮询超时后，将卡片改为中性灰，并明确展示最后更新时间。' },
      { title: '允许主动确认', text: '点击立即检查会重新请求服务器状态，成功后恢复可用状态。' },
      { title: '保留正确的边界', text: '状态过期不等同于已确认离线，也不触发协议或 TLS 自动降级。' },
    ],
  },
  {
    id: 'disconnected', label: '连接已断开', title: '已断开，配置还在', group: 'connection', icon: 'unplug',
    description: '暂停连接，不必从头开始。',
    notes: [
      { title: '真正停止连接活动', text: 'HTTP 停止定时检查，WebSocket 关闭实时会话，状态切换为中性灰。' },
      { title: '重新连接不重新扫描', text: '保留名称、地址、协议和加密设置，点击重连直接使用现有配置。' },
      { title: '自动连接由你决定', text: '断开不改变下次打开自动连接的偏好，可以独立关闭此选项。' },
    ],
  },
  {
    id: 'canceled', label: '连接已取消', title: '连接已取消', group: 'connection', icon: 'circle',
    description: '停在这里，或在准备好之后继续。',
    notes: [
      { title: '取消即时生效', text: '取消会清除连接与重试计时，不会在后台再次自动发起连接。' },
      { title: '配置完整保留', text: '取消不会删除设备，也不会更新上次成功使用的服务器。' },
      { title: '下一步足够清晰', text: '可以重新连接、修改配置，或切换到另一台已保存的服务器。' },
    ],
  },
  {
    id: 'first', label: '首次使用', title: '从第一台设备开始', group: 'configuration', icon: 'plus',
    description: '没有配置时，直接进入引导。',
    notes: [
      { title: '不给空白的连接页', text: '首次使用且没有已保存服务器时，应用直接进入添加服务器页面。' },
      { title: '发现与连接是两件事', text: '通过局域网服务发现找到设备，再选择 HTTP 或 WebSocket 通信。' },
      { title: '手动配置始终可用', text: '不依赖发现结果，随时切换到手动输入，也可以直接粘贴完整地址。' },
    ],
  },
  {
    id: 'scanning', label: '正在扫描', title: '发现附近的设备', group: 'configuration', icon: 'scan',
    description: '只在添加设备时，探索你的局域网。',
    notes: [
      { title: '先发现，再选协议', text: '原生应用可使用 mDNS / DNS-SD 发现服务，不用 HTTP 与 WebSocket 分别扫描网段。' },
      { title: '同一设备只出现一次', text: '使用服务标识去重，读取设备提供的通信能力，不重复列出同一服务器。' },
      { title: '网页中的模拟边界', text: '浏览器无法直接执行原生 mDNS 扫描。本原型模拟发现过程，不访问真实局域网。' },
    ],
  },
  {
    id: 'scan', label: '发现服务器', title: '你的设备，在这里', group: 'configuration', icon: 'server',
    description: '选择设备，再确认你偏好的通信方式。',
    notes: [
      { title: '一台设备，一个结果', text: '设备同时支持 HTTP 与 WebSocket 时仍只显示一次，并列出支持能力。' },
      { title: '选择不是立即连接', text: '选择设备后预填名称、地址与端口，进入配置页确认路径、协议和 TLS。' },
      { title: '尊重已经填写的设置', text: '发现结果不会清空路径或关闭加密，最终连接地址始终实时可见。' },
    ],
  },
  {
    id: 'scan-empty', label: '未发现设备', title: '暂时没有找到', group: 'configuration', icon: 'wifiOff',
    description: '发现不到，也可以手动连接。',
    notes: [
      { title: '给出可操作的建议', text: '提示检查 Wi-Fi 和服务发现功能，而不是直接认定服务器离线。' },
      { title: '两条清晰的下一步', text: '可以重新扫描，也可以手动输入 IP 或域名，不把扫描作为连接前提。' },
      { title: '不尝试不安全回退', text: '没有发现设备时不会扫描明文端口或关闭 TLS 来试探连接。' },
    ],
  },
  {
    id: 'manual', label: '手动添加', title: '按你的方式连接', group: 'configuration', icon: 'pencil',
    description: '必要的配置，清晰地放在一起。',
    notes: [
      { title: '协议与加密互相独立', text: 'HTTP / WebSocket 单选，TLS 独立开关，组合为 HTTP、HTTPS、WS 或 WSS。' },
      { title: '切换不丢内容', text: '分别记住请求路径和 WebSocket 路径，切换通信方式不清空名称与地址。' },
      { title: '完整地址，实时预览', text: '支持粘贴地址自动解析。已开启的 TLS 不会因为粘贴明文地址而自动关闭。' },
    ],
  },
  {
    id: 'edit', label: '编辑服务器', title: '微调，不必重来', group: 'configuration', icon: 'settings',
    description: '保留已填内容，确认每一次修改。',
    notes: [
      { title: '修改与连接分开', text: '可仅保存修改，也可以保存并重新连接。仅保存不会改变默认服务器。' },
      { title: '安全设置不隐式变化', text: 'HTTP 切换为 WebSocket 时保留 TLS 开关，不自动更换端口或降低加密。' },
      { title: '连接前检查配置', text: '验证名称、主机、端口和路径，错误在对应字段显示，不丢失已填内容。' },
    ],
  },
  {
    id: 'unconfigured', label: '尚未配置', title: '给连接一个起点', group: 'configuration', icon: 'circle',
    description: '一个明确的空状态，一个明确的下一步。',
    notes: [
      { title: '中性，不是错误', text: '灰色状态卡表示尚未配置，不使用连接失败的珊瑚红色。' },
      { title: '只保留一个主操作', text: '点击添加服务器进入发现与手动输入流程，不堆叠高级设置。' },
      { title: '没有配置就不自动连接', text: '应用启动时检测到空配置，会直接进入首次使用引导。' },
    ],
  },
  {
    id: 'manage', label: '已保存的服务器', title: '设备，有条不紊', group: 'management', icon: 'server',
    description: '管理你的每一台设备，轻松切换。',
    notes: [
      { title: '区分当前与上次成功', text: '当前连接表示活跃设备，上次成功使用表示下次自动连接的默认目标。' },
      { title: '操作就近呈现', text: '每台设备可以连接、编辑和删除。删除需要确认，不会操作服务器端的数据。' },
      { title: '管理页不扫描', text: '这里只读取已保存设备，点击添加后才进入局域网发现流程。' },
    ],
  },
  {
    id: 'manage-empty', label: '没有已保存的设备', title: '留白，等待第一台设备', group: 'management', icon: 'server',
    description: '简单开始，把设备慢慢带到这里。',
    notes: [
      { title: '空列表也有方向', text: '突出添加服务器，无连接对象时不显示无效的连接按钮。' },
      { title: '删除最后一台设备', text: '清除对应连接与默认设备记录，下次启动直接进入首次配置。' },
      { title: '本地保存', text: '原型使用浏览器本地存储保存配置，刷新后仍可继续使用。' },
    ],
  },
  {
    id: 'home', label: '业务首页', title: '连接之后，回到日常', group: 'business', icon: 'home',
    description: '让连接退到身后，让内容走到眼前。',
    notes: [
      { title: '简单的业务占位', text: '连接成功后进入首页，保留轻量连接状态，为后续业务内容留出空间。' },
      { title: '状态语义保持一致', text: 'HTTP 仍标识轮询，WebSocket 仍标识实时连接，不因进入首页而改变。' },
      { title: '随时回到连接管理', text: '可以查看当前连接或打开服务器管理，不需要重新配置或扫描。' },
    ],
  },
];

export const GROUPS: { id: SceneGroup; title: string; english: string; icon: IconName; subtitle: string }[] = [
  { id: 'connection', title: '日常连接', english: 'DAILY CONNECTION', icon: 'link', subtitle: '从上次成功的连接，继续。' },
  { id: 'configuration', title: '添加与配置', english: 'SERVER CONFIGURATION', icon: 'settings', subtitle: '找到你的设备，按你的方式连接。' },
  { id: 'management', title: '服务器管理', english: 'YOUR SERVERS', icon: 'server', subtitle: '每一台熟悉的设备，都在这里。' },
  { id: 'business', title: '业务首页', english: 'YOUR LOCAL SPACE', icon: 'dashboard', subtitle: '连接已就绪，把空间留给你的日常。' },
];

export const SCENE_IDS = SCENES.map((scene) => scene.id);

export function readScene(fallback: SceneId = 'connected'): SceneId {
  const value = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return SCENE_IDS.includes(value as SceneId) ? value as SceneId : fallback;
}