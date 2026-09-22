import type { IconName } from '../components/Icon';

export type SceneId =
  | 'connected' | 'ws-connected' | 'auto' | 'connecting' | 'failed'
  | 'retrying' | 'retry-wait' | 'disconnected' | 'first' | 'scanning'
  | 'scan' | 'scan-empty' | 'manual' | 'edit' | 'unconfigured'
  | 'manage' | 'manage-empty' | 'settings' | 'reader' | 'wallet';
export type SceneGroup = 'reader' | 'connection' | 'configuration' | 'management' | 'settings';
interface Scene {
  id: SceneId; label: string; title: string; description: string;
  group: SceneGroup; icon: IconName; notes: { title: string; text: string }[];
}
function scene(id: SceneId, label: string, group: SceneGroup, icon: IconName, description: string, notes: [string, string][]): Scene {
  return { id, label, title: label, group, icon, description, notes: notes.map(([title, text]) => ({ title, text })) };
}
export const SCENES: Scene[] = [
  scene('reader', '刷卡', 'reader', 'scan', '本地刷卡设计，复用统一连接状态。', [
    ['按规则发送', '读取 Access Code、统一固定或逐卡绑定；手动发送不受映射改写。'],
    ['可控模拟', '先在连接页连接服务器，再模拟贴卡；一次贴卡最多发送一次，需移开后再次读取。'],
    ['结果准确', '202 只表示接收，429 表示忙碌，超时结果未知，不自动重发。'],
  ]),
  scene('wallet', '卡包', 'reader', 'layers', '保存常用身份，管理实体卡绑定。', [
    ['离线可管理', '录入和绑定本身不发送；服务器断开不影响卡包管理。'],
    ['本机保存', '数据与连接配置分别保存；删除目标同步清理所有服务器的引用。'],
  ]),
  scene('connected', '连接成功 · HTTP', 'connection', 'checkCircle', '连接页就是首页，按你的偏好保持连接。', [
    ['按需验证', '默认首次连接时验证一次，成功后不再后台探测。刷卡或卡包发送前再次验证，均为本地模拟。'],
    ['由你决定是否提醒', '设置中可选择一直显示绿色在线，或超出自定义时长后变灰并提示。'],
    ['一次主动测试', '开启过期提示后才出现重新测试。过期本身不会发送请求。'],
  ]),
  scene('ws-connected', '连接成功 · WebSocket', 'connection', 'radio', '相同的在线语义，一致的颜色。', [
    ['统一连接体验', '协议标签沿用同一主色，绿色图标统一表示在线。断开后使用相同状态。'],
    ['能力边界', '这是独立的 WebSocket 交互模拟，当前 AMNet HTTP 服务没有 WebSocket 接口。'],
  ]),
  scene('auto', '启动自动连接', 'connection', 'loading', '直接连接上次成功使用的服务器。', [
    ['偏好在设置中', '下次打开自动连接可关闭，不会重新扫描设备。'],
    ['连接与页面分开', '连接过程中切到设置页不取消请求，完成后返回连接页可查看结果。'],
  ]),
  scene('connecting', '正在连接', 'connection', 'loading', '一次验证，确认服务器可用。', [
    ['HTTP API v1', 'HTTP 使用 GET /amnet/info，默认端口 6070。'],
    ['可以取消', '取消后进入连接已断开，迟到的请求结果不会重新建立连接。'],
  ]),
  scene('failed', '连接失败', 'connection', 'alert', '保留配置，检查网络后再试。', [
    ['区分失败原因', '模拟超时、不可达、错误响应及 API 版本不兼容。'],
    ['有限重试', '设置中可启用自动重连，最多尝试 3 次，等待间隔可调。'],
  ]),
  scene('retrying', '正在重试', 'connection', 'refresh', '使用原有配置重新连接。', [
    ['回到正常成功状态', '重试成功直接显示连接成功，不增加成功过渡页。'],
    ['随时取消', '取消尝试后进入断开状态，配置保留。'],
  ]),
  scene('retry-wait', '等待下次重试', 'connection', 'clock', '按设置中的间隔等待。', [
    ['独立的等待间隔', '失败重试间隔与在线检查间隔分别设置。'],
    ['有界重试', '最多尝试 3 次，可立即重试，也可取消。'],
  ]),
  scene('disconnected', '连接已断开', 'connection', 'unplug', '连接已断开，配置还在。', [
    ['统一断开语义', '主动断开、取消连接和检测到服务端断开均进入这个状态。'],
    ['主动断开优先', '用户断开后停止验证与重试，直到用户再次主动连接。'],
  ]),
  scene('unconfigured', '尚未配置服务器', 'connection', 'server', '从添加一台服务器开始。', [
    ['连接首页', '没有连接对象时提供添加入口。'],
    ['设置仍可访问', '先选择连接偏好，再添加设备。'],
  ]),
  scene('first', '首次添加', 'configuration', 'plus', '添加局域网中的服务器。', [
    ['两种添加方式', '模拟自动发现，也可分项输入名称、地址和端口。'],
    ['仅在需要时发现', '已保存的服务器可直接连接，启动不自动扫描。'],
  ]),
  scene('scanning', '正在发现', 'configuration', 'scan', '正在查找附近设备。', [
    ['发现是模拟', '本原型不会扫描局域网，AMNet 文档未提供发现协议。'],
    ['可以取消', '取消扫描不删除服务器配置。'],
  ]),
  scene('scan', '发现服务器', 'configuration', 'server', '选中一台，直接添加并连接。', [
    ['一步连接', '使用发现结果直接保存并验证，无需再次进入配置页。'],
    ['避免重复', '同一 HTTP 地址和端口复用已有配置，失败也保留新配置。'],
  ]),
  scene('scan-empty', '未发现服务器', 'configuration', 'scan', '也可以手动添加。', [
    ['保留替代入口', '可重新扫描或分项输入服务器信息。'],
    ['不推断离线', '未发现设备并不等于服务器不可达。'],
  ]),
  scene('manual', '手动添加', 'configuration', 'pencil', '分项填写，一个地址就够了。', [
    ['AMNet 默认值', 'HTTP 端口默认 6070，验证路径固定为 /amnet/info。'],
    ['简洁配置', '保留名称、IP/域名与端口，WebSocket 路径独立保存。'],
  ]),
  scene('edit', '编辑服务器', 'configuration', 'settings', '在服务器管理中维护配置。', [
    ['按需保存', '可以只保存，或保存后连接。'],
    ['默认目标', '只有验证成功才更新上次成功使用的服务器。'],
  ]),
  scene('manage', '已保存的服务器', 'management', 'server', '管理、编辑和连接你的设备。', [
    ['操作集中', '连接页仅保留服务器管理入口，编辑与切换在这里完成。'],
    ['本地保存', '删除需要确认；管理列表本身不触发发现或验证。'],
  ]),
  scene('manage-empty', '没有已保存的设备', 'management', 'server', '添加第一台设备。', [
    ['明确的下一步', '无服务器时显示添加入口。'],
    ['不会丢失偏好', '服务器列表为空时仍保留连接设置。'],
  ]),
  scene('settings', '连接设置', 'settings', 'settings', '少一点探测，按你的习惯连接。', [
    ['默认按需', '首次连接验证一次，后续刷卡前再验证，避免持续请求及终端刷屏。'],
    ['两种显示偏好', '不提示时持续绿色在线；提示时按自定义时长变灰，可重新测试。'],
    ['也可定时检查', '默认 5 秒，间隔可调。切换模式时清理旧计时，不叠加请求。'],
  ]),
];
export const GROUPS: { id: SceneGroup; title: string; english: string; icon: IconName; subtitle: string }[] = [
  { id: 'reader', title: '刷卡与卡包', icon: 'scan', english: 'READER & WALLET', subtitle: '读取、保存与发送' },
  { id: 'connection', title: '日常连接', english: 'DAILY CONNECTION', icon: 'link', subtitle: '从上次成功的连接，继续。' },
  { id: 'configuration', title: '添加与配置', english: 'SERVER CONFIGURATION', icon: 'settings', subtitle: '找到你的设备，直接连接。' },
  { id: 'management', title: '服务器管理', english: 'YOUR SERVERS', icon: 'server', subtitle: '每一台熟悉的设备，都在这里。' },
  { id: 'settings', title: '连接设置', english: 'CONNECTION PREFERENCES', icon: 'settings', subtitle: '连接的节奏，由你决定。' },
];
export const SCENE_IDS = SCENES.map(scene => scene.id);
export function resolveScene(hash: string, fallback: SceneId = 'connected'): SceneId {
  const value = hash.replace(/^#\/?/, '').split('?')[0];
  const aliases: Record<string, SceneId> = {
    home: 'connected', 'retry-success': 'connected', canceled: 'disconnected', 'http-stale': 'connected',
  };
  return Object.prototype.hasOwnProperty.call(aliases, value) ? aliases[value] : (SCENE_IDS.includes(value as SceneId) ? value as SceneId : fallback);
}
export function readScene(fallback: SceneId = 'connected'): SceneId {
  return resolveScene(window.location.hash, fallback);
}
