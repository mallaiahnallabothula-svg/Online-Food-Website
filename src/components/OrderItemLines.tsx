import type { OrderLine } from '../types';
import { useLanguage } from '../context/LanguageContext';

export function OrderItemLines({ items }: { items: readonly OrderLine[] }) {
  const { language } = useLanguage();
  return <ul className="space-y-1 text-sm" aria-label="Order items">{items.map(line =>
    <li key={line.itemId}>{language === 'te' ? line.nameTe : line.nameEn} × {line.quantity}{' '}
      {line.saleUnit === 'PACK' ? 'packs (120 g)' : line.saleUnit === 'PLATE' ? 'plates' : 'pieces'} — ₹{(line.lineTotalPaisa / 100).toFixed(2)}
    </li>)}</ul>;
}
