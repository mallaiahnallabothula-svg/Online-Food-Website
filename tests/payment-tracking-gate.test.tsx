// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext.tsx';
import { LiveNewMenuCheckout } from '../src/components/LiveNewMenuCheckout.tsx';
import { MENU_CATALOG } from '../shared/menuCatalog.ts';

const orderId = 'MENU-test-payment-gate';
const token = 'a'.repeat(64);
const proof = { razorpay_payment_id:'pay_test', razorpay_order_id:'order_test', razorpay_signature:'signature_test' };
const mount = () => render(<LanguageProvider><LiveNewMenuCheckout
  period="MORNING" lines={[{ item: MENU_CATALOG[0]!, quantity: 4 }]} te={false}
  /></LanguageProvider>);

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal('crypto', { randomUUID: () => '0185e823-46c2-4c14-90be-b35ba0000001' });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });

describe('Payment-before-tracking safety — new-menu checkout', () => {
  it('does not show tracking or save an order from a prepared but unpaid checkout', async () => {
    sessionStorage.setItem('mana_new_menu_pending_order', JSON.stringify({orderId,token}));
    const fetcher=vi.fn();
    vi.stubGlobal('fetch', fetcher);
    mount();
    await waitFor(() => expect(sessionStorage.getItem('mana_new_menu_request_key')).toBeTruthy());
    expect(screen.queryByRole('button', {name:'Track this order'})).toBeNull();
    expect(localStorage.getItem('smjr_customer_orders')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('keeps tracking hidden and history unsaved while server requests payment review', async () => {
    sessionStorage.setItem('mana_new_menu_pending_order',JSON.stringify({orderId,token}));
    sessionStorage.setItem('mana_new_menu_payment_proof',JSON.stringify(proof));
    const fetcher=vi.fn(async (url:string) => {
      expect(url).toBe('/api/new-menu/confirm');
      return {ok:true,json:async()=>({settlement:{status:'REVIEW_REQUIRED'}})} as Response;
    });
    vi.stubGlobal('fetch',fetcher);
    mount();
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Payment needs review'));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button',{name:'Track this order'})).toBeNull();
    expect(localStorage.getItem('smjr_customer_orders')).toBeNull();
    expect(sessionStorage.getItem('mana_new_menu_pending_order')).toBeTruthy();
  });

  it('only exposes Track Order and saves the private key after authoritative CONFIRMED result', async () => {
    sessionStorage.setItem('mana_new_menu_pending_order',JSON.stringify({orderId,token}));
    sessionStorage.setItem('mana_new_menu_payment_proof',JSON.stringify(proof));
    let settle: ((v:{ok:boolean;json:()=>Promise<unknown>})=>void)|undefined;
    const fetcher=vi.fn(async()=>new Promise<{ok:boolean;json:()=>Promise<unknown>}>(resolve=>{settle=resolve;}));
    vi.stubGlobal('fetch',fetcher);
    mount();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button',{name:'Track this order'})).toBeNull();
    expect(localStorage.getItem('smjr_customer_orders')).toBeNull();
    settle!({ok:true,json:async()=>({settlement:{status:'CONFIRMED'}})});
    await waitFor(() => expect(screen.getByRole('button',{name:'Track this order'})).toBeTruthy());
    const stored=JSON.parse(localStorage.getItem('smjr_customer_orders')||'[]');
    expect(stored).toMatchObject([{id:orderId,customerAccessToken:token}]);
    expect(screen.getByRole('region',{name:'Verified pre-order confirmation'})).toBeTruthy();
    expect(sessionStorage.getItem('mana_new_menu_pending_order')).toBeNull();
    expect(sessionStorage.getItem('mana_new_menu_payment_proof')).toBeNull();
  });
});
