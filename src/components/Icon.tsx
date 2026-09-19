import {
  ArrowLeft, ArrowRight, ArrowUpRight, BatteryFull, Check, CheckCircle2,
  ChevronDown, ChevronLeft, ChevronRight, Circle, CircleAlert, CircleDashed,
  CircleHelp, ClipboardPaste, Clock3, Copy, ExternalLink, Home, Info,
  Layers3, LayoutDashboard, Link2, LoaderCircle, LockKeyhole, Maximize2,
  Monitor, MoreHorizontal, Pencil, Play, Plus, Radio, RefreshCw, RotateCcw,
  ScanLine, Server, Settings2, Shield, ShieldCheck, Signal, Smartphone,
  Trash2, Unplug, Wifi, WifiOff, X,
} from 'lucide-react';

const icons = {
  arrowLeft: ArrowLeft, arrowRight: ArrowRight, arrowUpRight: ArrowUpRight,
  battery: BatteryFull, check: Check, checkCircle: CheckCircle2,
  chevronDown: ChevronDown, chevronLeft: ChevronLeft, chevronRight: ChevronRight,
  circle: Circle, alert: CircleAlert, dashed: CircleDashed, help: CircleHelp,
  clipboard: ClipboardPaste, clock: Clock3, copy: Copy, external: ExternalLink,
  home: Home, info: Info, layers: Layers3, dashboard: LayoutDashboard, link: Link2,
  loading: LoaderCircle, lock: LockKeyhole, expand: Maximize2, monitor: Monitor,
  more: MoreHorizontal, pencil: Pencil, play: Play, plus: Plus, radio: Radio,
  refresh: RefreshCw, reset: RotateCcw, scan: ScanLine, server: Server,
  settings: Settings2, shield: Shield, shieldCheck: ShieldCheck, signal: Signal,
  smartphone: Smartphone, trash: Trash2, unplug: Unplug, wifi: Wifi,
  wifiOff: WifiOff, close: X,
};

export type IconName = keyof typeof icons;

export function Icon({ name, size = 20, className = '', strokeWidth = 1.8 }: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const Component = icons[name];
  return <Component size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}