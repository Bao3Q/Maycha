import type { OrderStatus } from '../lib/api';
import { STATUS_META } from '../lib/format';

export function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    badge: 'bg-stone-100 text-stone-700 ring-stone-500/20',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${meta.badge}`}
    >
      {meta.label}
    </span>
  );
}
