export const PAPPU_VARIETIES = {
  TOMATO: { nameEn: 'Tomato Pappu', nameTe: 'టమాటా పప్పు' },
  PALAKURA: { nameEn: 'Palakura Pappu', nameTe: 'పాలకూర పప్పు' },
  THOTAKURA: { nameEn: 'Thotakura Pappu', nameTe: 'తోటకూర పప్పు' },
} as const;
export type PappuVariety = keyof typeof PAPPU_VARIETIES;
export function pappuForDate(date: string): PappuVariety | null {
  const day = new Date(date + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) throw new Error('Invalid delivery date');
  const weekday = day.getUTCDay();
  return weekday === 3 ? null : weekday === 1 || weekday === 4 ? 'TOMATO' : weekday === 2 || weekday === 5 ? 'PALAKURA' : 'THOTAKURA';
}
