import {useEffect,useState} from 'react';
import {MENU_CATALOG} from '../../../shared/menuCatalog.ts';
import type {PauseReason} from '../../../server/services/smartMenuService.ts';

type Pause={itemId:string;reason:PauseReason};
type Settings={
  holidayClosed:boolean;holidayReason:string;
  morningCutoffIst:string|null;eveningCutoffIst:string|null;
  curryName:string;curryNameTe:string;pauses:Pause[];
};
const empty:Settings={
  holidayClosed:false,holidayReason:'',
  morningCutoffIst:null,eveningCutoffIst:null,
  curryName:'',curryNameTe:'',pauses:[]
};
const todayIst=()=>new Date(Date.now()+330*60_000).toISOString().slice(0,10);
export function SmartMenuControls(){
  const [date,setDate]=useState(todayIst);
  const [data,setData]=useState<Settings>(empty);
  const [options,setOptions]=useState<string[]>([]);
  const [loading,setLoading]=useState(true);
  const [loaded,setLoaded]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    let active=true;
    setLoading(true);setLoaded(false);setData(empty);setMessage('');
    fetch('/api/admin/smart-menu/'+date,{credentials:'include',cache:'no-store'}).then(async r=>{
      if (!r.ok) throw new Error('Cannot load menu controls for this date');
      return r.json();
    }).then(value=>{if(active)setData({
      holidayClosed:value.holidayClosed===true,holidayReason:value.holidayReason||'',
      morningCutoffIst:value.morningCutoffIst??null,eveningCutoffIst:value.eveningCutoffIst??null,
      curryName:value.curryName||'',curryNameTe:value.curryNameTe||'',
      pauses:Array.isArray(value.pauses)?value.pauses:[]
    });if(active)setLoaded(true);}).catch(e=>{if(active)setMessage(e.message)}).finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false;};
  },[date]);
  useEffect(()=>{fetch('/api/admin/smart-menu/options',{credentials:'include',cache:'no-store'})
    .then(r=>r.ok?r.json():{options:[]}).then(v=>setOptions(v.options||[])).catch(()=>{});},[]);
  function update<K extends keyof Settings>(key:K,value:Settings[K]){
    setData(p=>({...p,[key]:value}));
  }
  function pauseFor(itemId:string):PauseReason|null {
    return data.pauses.find(p=>p.itemId===itemId)?.reason??null;
  }
  function setPause(itemId:string,reason:PauseReason|null){
    update('pauses',reason
      ? [...data.pauses.filter(x=>x.itemId!==itemId),{itemId,reason}]
      : data.pauses.filter(x=>x.itemId!==itemId));
  }
  async function save(){
    if(!loaded || busy || loading)return;
    setBusy(true);setMessage('');
    try{
      const r=await fetch('/api/admin/smart-menu/'+date,{
        method:'PUT',credentials:'include',
        headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},
        body:JSON.stringify(data)
      });
      const value=await r.json();
      if(!r.ok)throw new Error(value.error||'Unable to save changes');
      setMessage('Saved. Only new orders use these controls. Existing paid orders are unchanged.');
    }catch(e){setMessage(e instanceof Error?e.message:'Save failed');}
    finally{setBusy(false);}
  }
  return <details className="rounded-xl border border-stone-300 bg-white p-4 text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100">
    <summary className="cursor-pointer font-bold">Smart Menu Availability · Owner Controls</summary>
    <p className="mt-2 text-sm">Date-specific availability. Stock caps stay unchanged. Wednesday remains closed. Cutoffs can only be earlier than the regular 30-minute lead.</p>
    <label className="mt-3 block text-sm">Delivery date (IST)
      <input aria-label="Smart menu delivery date" type="date" min={todayIst()} value={date} disabled={busy}
        onChange={e=>setDate(e.target.value)} className="ml-2 rounded border p-2 text-black"/>
    </label>
    {loading ? <p role="status">Loading…</p> : <div className="mt-4 space-y-4">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={data.holidayClosed} onChange={e=>update('holidayClosed',e.target.checked)}/>
        Special holiday — stop new orders for both sessions
      </label>
      {data.holidayClosed && <label className="block text-sm">Holiday reason
        <input value={data.holidayReason} maxLength={120} onChange={e=>update('holidayReason',e.target.value)}
          className="mt-1 block w-full rounded border p-2 text-black" placeholder="Optional customer notice"/>
      </label>}
      <fieldset className="rounded border p-3">
        <legend className="font-semibold">Today's Curry / రోజు కూర</legend>
        <label className="block text-sm">Curry name (required before customers can order curry)
          <input list="saved-curry-names" value={data.curryName} maxLength={60}
            onChange={e=>update('curryName',e.target.value)} placeholder="Enter or select curry name"
            className="mt-1 block w-full rounded border p-2 text-black"/>
          <datalist id="saved-curry-names">{options.map(x=><option value={x} key={x}/>)}</datalist>
        </label>
        <label className="mt-2 block text-sm">Telugu name (optional)
          <input value={data.curryNameTe} maxLength={60} onChange={e=>update('curryNameTe',e.target.value)}
            className="mt-1 block w-full rounded border p-2 text-black"/>
        </label>
        <p className="text-xs">₹50 · 100 g / pack · 30 packs/day</p>
      </fieldset>
      <fieldset className="rounded border p-3">
        <legend className="font-semibold">Optional earlier order cutoff (IST)</legend>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">Morning (latest 10:30)
            <input type="time" max="10:30" value={data.morningCutoffIst??''} onChange={e=>update('morningCutoffIst',e.target.value||null)}
              className="ml-2 rounded border p-2 text-black"/>
          </label>
          <label className="text-sm">Evening (latest 19:30)
            <input type="time" max="19:30" value={data.eveningCutoffIst??''} onChange={e=>update('eveningCutoffIst',e.target.value||null)}
              className="ml-2 rounded border p-2 text-black"/>
          </label>
        </div>
      </fieldset>
      <fieldset className="rounded border p-3">
        <legend className="font-semibold">Pause item / Ingredient shortage</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MENU_CATALOG.map(item=><label key={item.id} className="flex flex-col gap-1 text-sm">
            <span>{item.nameTe} / {item.nameEn}</span>
            <select aria-label={'Availability for '+item.nameEn} value={pauseFor(item.id)||''}
              onChange={e=>setPause(item.id,(e.target.value||null) as PauseReason|null)}
              className="w-full rounded border p-2 text-black">
              <option value="">Available (subject to stock)</option>
              <option value="PAUSED">Temporarily paused</option>
              <option value="INGREDIENT_SHORTAGE">Ingredient shortage</option>
            </select>
          </label>)}
        </div>
      </fieldset>
      <button disabled={busy||loading||!loaded||!date} onClick={save} type="button" className="rounded bg-emerald-800 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {busy?'Saving…':'Save availability settings'}
      </button>
      <p role="status" className="text-sm">{message}</p>
    </div>}
  </details>;
}
