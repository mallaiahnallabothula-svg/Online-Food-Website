// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import fs from 'node:fs';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext.tsx';
import { UpcomingMenuSection } from '../src/components/UpcomingMenuSection.tsx';
import { SolaraEditorialContent } from '../src/components/SolaraEditorialContent.tsx';
import { FoodDetailDialog } from '../src/components/FoodDetailDialog.tsx';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';
import { getNextPreorderDeliverySlot } from '../shared/preorderScheduling.ts';
import { availabilityForItem, validateMenuStatus, STATUS_RECHECK_MS } from '../src/utils/menuAvailability.ts';

const now = new Date('2026-10-10T00:30:00.000Z'); // Saturday 6 AM IST
const makeStatus=(period:'MORNING'|'EVENING', clock=now, remaining=15, orderingEnabled=true) => ({
  deliveryDateIst: getNextPreorderDeliverySlot(period,clock).deliveryDateIst,
  pappu:null, orderingEnabled,
  stock:Object.fromEntries(MENU_CATALOG.filter(x=>x.mealPeriod===period).map(item=>[item.id,remaining]))
});
function Lang() {
  const {setLanguage}=useLanguage();
  return <><button onClick={()=>setLanguage('en')}>English language</button><button onClick={()=>setLanguage('te')}>Telugu language</button></>;
}
const mountMenu=()=>render(<LanguageProvider><Lang/><UpcomingMenuSection /></LanguageProvider>);
const mountStory=()=>render(<LanguageProvider><Lang/><SolaraEditorialContent /></LanguageProvider>);
beforeEach(()=>{localStorage.clear();vi.useRealTimers();});
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();});

describe('Signature bilingual local brand story',()=>{
  it('uses the existing single two-column brand-story with honest Kollur text and unchanged anchor',()=>{
    const {container}=mountStory();
    expect(container.querySelectorAll('#brand-story')).toHaveLength(1);
    const section=container.querySelector('#brand-story')!;
    expect(section.className).toContain('md:grid-cols-');
    expect(section.textContent).toContain('From Our Kitchen');
    expect(section.textContent).toContain('Kollur');
    expect(section.textContent).toContain('12 MENU ITEMS');
    expect(container.querySelector('#at-the-table a[href="#upcoming-menu"]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Telugu language'}));
    expect(section.textContent).toContain('మా వంటింటి నుంచి');
    expect(section.textContent).toContain('కొల్లూరు');
    expect(container.querySelectorAll('#brand-story')).toHaveLength(1);
  });
});

describe('Reusable food detail dialog — existing preview cart',()=>{
  it('opens by image or name, shows real item facts, closes with ESC and restores keyboard focus',()=>{
    const {container}=mountMenu();
    const artwork=screen.getByRole('button',{name:'View artwork details for Idly'});
    artwork.focus();
    fireEvent.click(artwork);
    let dialog=screen.getByRole('dialog',{name:/Idly/});
    expect(document.body.style.overflow).toBe('hidden');
    expect(within(dialog).getByText('₹30')).toBeTruthy();
    expect(within(dialog).getByText('4 pieces / plate')).toBeTruthy();
    expect(within(dialog).getByText('Morning')).toBeTruthy();
    expect(within(dialog).getByText('Included')).toBeTruthy();
    expect(within(dialog).getByText('Ordering Unavailable')).toBeTruthy();
    expect(within(dialog).getByText(/Sample cart only/)).toBeTruthy();
    fireEvent.keyDown(document,{key:'Escape'});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(artwork);
    expect(document.body.style.overflow).toBe('');
    fireEvent.click(screen.getByRole('button',{name:'View details for Idly'}));
    dialog=screen.getByRole('dialog',{name:/Idly/});
    fireEvent.click(within(dialog).getByRole('button',{name:'Close food details'}));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(container.querySelector('#upcoming-menu')).toBeTruthy();
  });
  it('syncs minimum quantities and cart controls; preserves morning/evening cart isolation',()=>{
    mountMenu();
    fireEvent.click(screen.getByRole('button',{name:'Evening (6)'}));
    fireEvent.click(screen.getByRole('button',{name:'View details for Chapathi'}));
    let dialog=screen.getByRole('dialog',{name:/Chapathi/});
    expect(within(dialog).getByText('Minimum quantity')).toBeTruthy();
    expect(within(dialog).getByText('3')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button',{name:'Add Chapathi to sample cart'}));
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹30');
    dialog=screen.getByRole('dialog',{name:/Chapathi/});
    expect(within(dialog).getByLabelText('Chapathi modal quantity').textContent).toBe('3');
    fireEvent.click(within(dialog).getByRole('button',{name:'Increase Chapathi sample quantity'}));
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹40');
    fireEvent.click(within(dialog).getByRole('button',{name:'Close food details'}));
    expect(screen.getByLabelText('Chapathi sample quantity').textContent).toBe('4');
    fireEvent.click(screen.getByRole('button',{name:'Morning (6)'}));
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹0');
    fireEvent.click(screen.getByRole('button',{name:'Evening (6)'}));
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹40');
  });
  it('has mobile-safe scroll and keyboard trap; sold-out purchasing disabled',()=>{
    const item=MENU_CATALOG.find(x=>x.id==='chapathi')!;
    const change=vi.fn(),close=vi.fn();
    render(<FoodDetailDialog item={item} te={false} status="sold-out" deliveryDate="2026-10-10"
      quantity={0} maxQuantity={2} canIncrease={false} onAdjust={change} onClose={close} previewOnly={false}/>);
    const dialog=screen.getByRole('dialog',{name:/Chapathi/});
    expect(dialog.className).toContain('max-h-[calc(100dvh-0.5rem)]');
    const add=within(dialog).getByRole('button',{name:'Add Chapathi to cart'}) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.click(add);
    expect(change).not.toHaveBeenCalled();
    add.focus();fireEvent.keyDown(document,{key:'Tab'});
    expect(document.activeElement).toBe(within(dialog).getByRole('button',{name:'Close food details'}));
  });
});

describe('Smart date-scoped availability guard',()=>{
  it('never claims stock while launch disabled or API failed/unknown',()=>{
    const item=MENU_CATALOG[0]!;
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    expect(availabilityForItem(item,false,null,false,now)).toBe('unavailable');
    expect(availabilityForItem(item,true,null,false,now)).toBe('checking');
    expect(availabilityForItem(item,true,null,true,now)).toBe('error');
    const snap=validateMenuStatus(makeStatus('MORNING',now,8,false),'MORNING',now)!;
    expect(availabilityForItem(item,true,snap,false,now)).toBe('unavailable');
  });
  it('uses only validated session stock and minimum quantities, never guessed quantities',()=>{
    const morn=MENU_CATALOG.find(x=>x.id==='idly')!;
    const eve=MENU_CATALOG.find(x=>x.id==='chapathi')!;
    const mornSnap=validateMenuStatus(makeStatus('MORNING'), 'MORNING',now)!;
    expect(availabilityForItem(morn,true,mornSnap,false,now)).toBe('available');
    expect(availabilityForItem(eve,true,mornSnap,false,now)).toBe('checking');
    expect(validateMenuStatus(makeStatus('MORNING'),'EVENING',now)).toBeNull();
    const eveSnap=validateMenuStatus(makeStatus('EVENING',now,2), 'EVENING',now)!;
    expect(availabilityForItem(eve,true,eveSnap,false,now)).toBe('sold-out');
    expect(validateMenuStatus({...makeStatus('MORNING'),stock:{idly:20}},'MORNING',now)).toBeNull();
    expect(validateMenuStatus({...makeStatus('MORNING'),stock:{...makeStatus('MORNING').stock,idly:999}},'MORNING',now)).toBeNull();
    expect(validateMenuStatus({...makeStatus('MORNING'),orderingEnabled:undefined},'MORNING',now)).toBeNull();
  });
  it('allows a valid future preorder even when daytime ordering hours are closed',()=>{
    const night=new Date('2026-10-10T18:00:00Z'); // 23:30 IST
    const future=validateMenuStatus(makeStatus('MORNING',night),'MORNING',night)!;
    expect(future.deliveryDateIst).toBe('2026-10-11');
    expect(availabilityForItem(MENU_CATALOG[0]!,true,future,false,night)).toBe('preorder');
  });
  it('treats elapsed TTL, changed dates, and malformed responses as unconfirmed',()=>{
    const snap=validateMenuStatus(makeStatus('MORNING'),'MORNING',now)!;
    expect(availabilityForItem(MENU_CATALOG[0]!,true,snap,false,new Date(now.getTime()+STATUS_RECHECK_MS))).toBe('checking');
    expect(validateMenuStatus({...makeStatus('MORNING'),deliveryDateIst:'2026-10-12'},'MORNING',now)).toBeNull();
    expect(availabilityForItem(MENU_CATALOG[0]!,true,snap,false,new Date('2026-10-11T02:00:00Z'))).toBe('checking');
  });
  it('never switches on live ordering through the presentation patch',()=>{
    const menu=fs.readFileSync('src/components/UpcomingMenuSection.tsx','utf8');
    const route=fs.readFileSync('server/routes/newMenuCheckoutRoutes.ts','utf8');
    expect(route).toContain("if (!NEW_MENU_LAUNCH_ENABLED) return res.status(404)");
    expect(route).toContain('orderingEnabled: isProductionCheckoutEnabled()');
    expect(menu).toContain("cache: 'no-store'");
    expect(menu).toContain('NEW_MENU_LAUNCH_ENABLED');
    expect(menu).toContain('onCheckout?.({ period, lines: selected, subtotalPaisa })');
    expect(fs.readFileSync('src/components/LiveNewMenuCheckout.tsx','utf8')).toContain('onSubmit={checkQuote}');
  });
});
