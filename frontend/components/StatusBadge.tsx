import type { OrderStatus } from '../lib/api';
import { STATUS_META } from '../lib/format';

export function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    badge: 'bg-stone-100 text-stone-700 ring-stone-500/20',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold ring-1 ring-inset ${meta.badge}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
