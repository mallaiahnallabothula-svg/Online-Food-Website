// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext.tsx';
import { LiveNewMenuCheckout } from '../src/components/LiveNewMenuCheckout.tsx';
import { MENU_CATALOG } from '../shared/menuCatalog.ts';

const orderId = 'MENU-test-payment-gate';
const token = 'a'.repeat(64);
const proof = { razorpay_payment_id:'pay_test', razorpay_order_id:'order_test', razorpay_signature:'signature_test' };
const mount = (te = false) => render(<LanguageProvider><LiveNewMenuCheckout
  period="MORNING" lines={[{ item: MENU_CATALOG[0]!, quantity: 4 }]} te={te}
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
  it.each([
    { te: false, track: 'Track this order', guidance: 'Order confirmed. Use Track this order below for delivery updates.', heading: 'Payment verified. Track your confirmed order below.' },
    { te: true, track: 'నా ఆర్డర్ ట్రాక్ చేయండి', guidance: 'ఆర్డర్ ఖరారైంది.', heading: 'మీ చెల్లింపు ధృవీకరించబడింది.' },
  ])('keeps private tracking gated after a verified payment ($track)', async ({ te, track, guidance, heading }) => {
    sessionStorage.setItem('mana_new_menu_pending_order', JSON.stringify({orderId,token}));
    sessionStorage.setItem('mana_new_menu_payment_proof', JSON.stringify(proof));
    const fetcher = vi.fn(async (url: string) => {
      if (url === '/api/new-menu/confirm') return {ok:true,json:async()=>({settlement:{status:'CONFIRMED'}})} as Response;
      if (url === '/api/orders/' + encodeURIComponent(token)) return {ok:false,json:async()=>({error:{message:'Fixture tracking only'}})} as Response;
      throw new Error('Unexpected request: ' + url);
    });
    vi.stubGlobal('fetch', fetcher);
    mount(te);
    const tracker = await screen.findByRole('button', {name:track});
    expect(screen.getByTestId('checkout-guidance').textContent).toContain(guidance);
    expect(screen.getByText(new RegExp(heading))).toBeTruthy();
    expect(screen.getByLabelText('Checkout progress').lastElementChild?.className).toContain('bg-[#26543A]');
    expect(screen.queryByRole('button', {name:'Check delivery and total'})).toBeNull();
    expect(screen.queryByRole('button', {name:/Pay .*with Razorpay/})).toBeNull();
    expect(screen.queryByText('Review total, delivery time and address before payment.')).toBeNull();
    expect(tracker.className).toContain('bg-[#26543A]');
    fireEvent.click(tracker);
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/orders/' + encodeURIComponent(token)));
    expect(fetcher.mock.calls.filter(([url]) => url === '/api/new-menu/confirm')).toHaveLength(1);
    expect(fetcher.mock.calls.some(([url]) => url === '/api/new-menu/gateway')).toBe(false);
    expect(fetcher.mock.calls.some(([url]) => url === '/api/new-menu/prepare')).toBe(false);
  });

});
