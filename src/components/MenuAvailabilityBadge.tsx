import { AlertCircle, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { statusLabels, type MenuStatus } from '../utils/menuAvailability';

export function MenuAvailabilityBadge({ status, te }: { status: MenuStatus; te:boolean }) {
  const style = status === 'available' || status === 'preorder'
    ? 'border-emerald-700/20 bg-emerald-50 text-emerald-800 dark:border-emerald-600/30 dark:bg-emerald-950/50 dark:text-emerald-200'
    : status === 'sold-out'
      ? 'border-red-700/20 bg-red-50 text-red-800 dark:border-red-700/30 dark:bg-red-950/40 dark:text-red-200'
      : 'border-amber-700/20 bg-amber-50 text-amber-900 dark:border-amber-700/30 dark:bg-amber-950/40 dark:text-amber-200';
  const Icon = status === 'available' || status === 'preorder' ? CheckCircle2 :
    status === 'sold-out' ? XCircle : status === 'error' ? AlertCircle : Clock3;
  return <span data-testid="food-availability" className={'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold leading-tight ' + style}>
    <Icon size={12} aria-hidden="true" className="shrink-0" />{te ? statusLabels[status].te : statusLabels[status].en}
  </span>;
}
