import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, X } from 'lucide-react';
import type { MenuItem } from '../../shared/menuCatalog.ts';
import { FoodArtwork } from './FoodArtwork';
import { MenuAvailabilityBadge } from './MenuAvailabilityBadge';
import type { MenuStatus } from '../utils/menuAvailability';

function serving(item: MenuItem, te:boolean): string {
  if (item.saleUnit === 'PACK') return (item.gramsPerUnit ?? 120) + (te ? ' గ్రా / ప్యాక్' : ' g / pack');
  if (item.saleUnit === 'PIECE') return te ? 'ఒక్కొక్కటి' : 'Per piece';
  return item.piecesPerUnit === null ? (te ? 'ఒక ప్లేట్' : 'Per plate') :
    item.piecesPerUnit + (te ? ' ముక్కలు / ప్లేట్' : ' pieces / plate');
}
const money=(paisa:number)=>'₹'+(paisa/100).toLocaleString('en-IN',{maximumFractionDigits:2});

export function FoodDetailDialog({item,te,status,deliveryDate,quantity,maxQuantity,canIncrease,onAdjust,onClose,previewOnly}:{
  item:MenuItem; te:boolean;status:MenuStatus;deliveryDate:string;quantity:number;
  maxQuantity:number;canIncrease:boolean;onAdjust:(adjustment:number)=>void;onClose:()=>void;previewOnly:boolean;
}) {
  const titleId=useId(),descriptionId=useId(),dialogRef=useRef<HTMLDivElement>(null),closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const savedOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    closeRef.current?.focus();
    function handleKey(event:KeyboardEvent){
      if(event.key==='Escape'){ event.preventDefault(); onClose(); return; }
      if(event.key!=='Tab'||!dialogRef.current) return;
      const elements=[...dialogRef.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      if(!elements.length){ event.preventDefault(); return; }
      const first=elements[0]!,last=elements[elements.length-1]!;
      if(event.shiftKey&&(document.activeElement===first||!dialogRef.current.contains(document.activeElement))){
        event.preventDefault(); last.focus();
      }else if(!event.shiftKey&&(document.activeElement===last||!dialogRef.current.contains(document.activeElement))){
        event.preventDefault();first.focus();
      }
    }
    document.addEventListener('keydown',handleKey);
    return()=>{document.removeEventListener('keydown',handleKey);document.body.style.overflow=savedOverflow;previous?.focus();};
  },[onClose]);

  const locked= !previewOnly && (status==='sold-out'||status==='checking'||status==='error'||status==='unavailable');
  const maxed= quantity>=maxQuantity;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#19221b]/60 p-0 sm:items-center sm:p-4" data-testid="food-detail-overlay">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
        className="solara-food-dialog flex max-h-[calc(100dvh-0.5rem)] w-full max-w-lg min-w-0 flex-col overflow-hidden rounded-t-2xl border border-[#e6dece] bg-[#FAF6ED] shadow-2xl dark:border-stone-700 dark:bg-[#211f1c] sm:max-h-[min(90dvh,780px)] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e6dece] px-4 py-3 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#A44732]">{te?'వంటకం వివరాలు':'FOOD DETAILS'}</p>
          <button ref={closeRef} type="button" aria-label={te?'వివరాలు మూసివేయండి':'Close food details'} onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#384B35] hover:bg-[#eee8dc] focus-visible:outline-2 focus-visible:outline-[#A44732] dark:text-stone-100 dark:hover:bg-stone-800">
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-5 sm:px-6">
          <div className="mx-auto w-full max-w-xs overflow-hidden rounded-xl border border-[#e6dece] sm:max-w-sm">
            <FoodArtwork itemId={item.id} className="aspect-[4/3] w-full" />
          </div>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
            <h2 id={titleId} className="solara-display min-w-0 flex-1 text-2xl leading-snug text-[#384B35] dark:text-stone-100 sm:text-3xl">{te?item.nameTe:item.nameEn}</h2>
            <span className="shrink-0 font-serif text-2xl text-[#A44732]">{money(item.pricePaisa)}</span>
          </div>
          <p id={descriptionId} className="mt-2 text-sm text-[#5f584f] dark:text-stone-300">{serving(item,te)}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2"><MenuAvailabilityBadge status={status} te={te} /></div>
          <dl className="mt-4 grid min-w-0 gap-3 border-t border-[#e6dece] pt-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-[#756f67] dark:text-stone-300">{te?'సమయం':'Session'}</dt>
              <dd className="mt-1 font-semibold text-[#384B35] dark:text-stone-100">{item.mealPeriod==='MORNING'?(te?'ఉదయం':'Morning'):(te?'సాయంత్రం':'Evening')}</dd></div>
            <div><dt className="text-xs text-[#756f67] dark:text-stone-300">{te?'డెలివరీ తేదీ':'Delivery date'}</dt>
              <dd className="mt-1 font-semibold text-[#384B35] dark:text-stone-100">{deliveryDate}</dd></div>
            {item.minimumQuantity>1&&<div><dt className="text-xs text-[#756f67] dark:text-stone-300">{te?'కనీస పరిమాణం':'Minimum quantity'}</dt>
              <dd className="mt-1 font-semibold text-[#384B35] dark:text-stone-100">{item.minimumQuantity}</dd></div>}
            {item.includesChutney&&<div><dt className="text-xs text-[#756f67] dark:text-stone-300">{te?'చట్నీ':'Chutney'}</dt>
              <dd className="mt-1 font-semibold text-[#384B35] dark:text-stone-100">{te?'కలిపి ఉంటుంది':'Included'}</dd></div>}
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-[#756f67] dark:text-stone-300">
            {previewOnly?(te?'ఇది నమూనా కార్ట్ మాత్రమే. కొత్త మెనూ ఆర్డర్లు ఇంకా ప్రారంభం కాలేదు.':'Sample cart only. New-menu ordering is not open yet.'):
              (te?'స్టాక్ ప్రస్తుత అంచనా మాత్రమే. ఆర్డర్‌కు ముందు సర్వర్‌లో మళ్లీ ధృవీకరిస్తాం.':'Availability is an estimate; the server verifies stock again before checkout.')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#e6dece] bg-[#FAF6ED] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:bg-[#211f1c] sm:px-6">
          <span className="text-xs font-semibold text-[#384B35] dark:text-stone-200">{te?'పరిమాణం':'Quantity'}: {quantity}</span>
          {quantity>0 ? <div className="flex items-center rounded-lg border border-[#c7bcb0]">
            <button type="button" aria-label={'Decrease '+item.nameEn+(previewOnly?' sample quantity':' quantity')} onClick={()=>onAdjust(-1)} className="min-h-11 min-w-11 text-[#A44732]"><Minus size={16} className="mx-auto" /></button>
            <span aria-label={item.nameEn+' modal quantity'} className="min-w-7 text-center text-sm font-bold">{quantity}</span>
            <button type="button" aria-label={'Increase '+item.nameEn+(previewOnly?' sample quantity':' quantity')} disabled={maxed||locked} onClick={()=>onAdjust(1)} className="min-h-11 min-w-11 text-[#A44732] disabled:opacity-40"><Plus size={16} className="mx-auto" /></button>
          </div> :
            <button type="button" aria-label={'Add '+item.nameEn+(previewOnly?' to sample cart':' to cart')} disabled={!canIncrease||locked}
              onClick={()=>onAdjust(1)} className="min-h-11 rounded-lg bg-[#A44732] px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {te?'జోడించండి +':'Add +'}
            </button>}
        </div>
      </div>
    </div>,document.body
  );
}
