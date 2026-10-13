import { useEffect, useState } from 'react';
import { PAPPU_VARIETIES } from '../../../shared/pappu';
export function PappuSettings() {
  const [date, setDate] = useState('');
  const [variety, setVariety] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false); setMessage(''); setVariety('');
    if (!date) return;
    let active = true;
    setLoading(true);
    fetch('/api/admin/pappu/' + date, { credentials: 'include', cache: 'no-store' }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error('Unable to load this date.');
      if (active) {
        setLoaded(true);
        setMessage(data.variety ? 'Current: ' + PAPPU_VARIETIES[data.variety as keyof typeof PAPPU_VARIETIES].nameEn : 'Wednesday is closed.');
      }
    }).catch(error => { if (active) setMessage(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date]);
  async function save() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/pappu/' + date, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ variety: variety || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Unable to save');
      setMessage('Saved for ' + date + '. Existing orders keep their confirmed variety.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save'); }
    finally { setBusy(false); }
  }
  return <details className="rounded-xl border p-4"><summary className="font-bold cursor-pointer">రోజు పప్పు / Pappu by delivery date</summary>
    <p className="my-3 text-sm">Mon/Thu: Tomato · Tue/Fri: Palakura · Sat/Sun: Thotakura · Wednesday closed. One product, 30 packs/day.</p>
    <div className="flex flex-wrap gap-3"><label>Delivery date<input type="date" disabled={busy} value={date} onChange={e => { setDate(e.target.value); setMessage(''); }} className="block rounded border p-2 text-black" /></label>
    <label>Variety<select disabled={loading || busy} value={variety} onChange={e => setVariety(e.target.value)} className="block rounded border p-2 text-black"><option value="">Use normal rotation</option>{Object.entries(PAPPU_VARIETIES).map(([key, value]) => <option key={key} value={key}>{value.nameTe} / {value.nameEn}</option>)}</select></label>
    <button type="button" disabled={!date || busy || loading || !loaded} onClick={save} className="rounded bg-emerald-800 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save date override'}</button></div><p role="status" className="mt-2 text-sm">{message}</p></details>;
}
