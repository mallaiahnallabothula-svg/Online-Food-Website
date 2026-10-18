// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext.tsx';
import { UpcomingMenuSection } from '../src/components/UpcomingMenuSection.tsx';
import { SecureCheckoutPage } from '../src/components/SecureCheckoutPage.tsx';
import { validateUpcomingPreview } from '../src/components/UpcomingCheckoutPreview.tsx';
import type { CheckoutSelection } from '../src/utils/checkoutSelection.ts';
import { NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';
import { getNextPreorderDeliverySlot } from '../shared/preorderScheduling.ts';

function SwitchEnglish() {
  const { setLanguage } = useLanguage();
  return <button type="button" onClick={() => setLanguage('en')}>English preview</button>;
}

function Harness() {
  const [selection, setSelection] = useState<CheckoutSelection | null>(null);
  return (
    <>
      <SwitchEnglish />
      <div hidden={!!selection}><UpcomingMenuSection onCheckout={setSelection} /></div>
      {selection && <SecureCheckoutPage selection={selection} onBack={() => setSelection(null)} />}
    </>
  );
}

function mount() {
  render(<LanguageProvider><Harness /></LanguageProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'English preview' }));
}

function addFourPulkas() {
  fireEvent.click(screen.getByRole('button', { name: 'Add Pulka to sample cart' }));
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Increase Pulka sample quantity' }));
}
function continueToDelivery() {
  fireEvent.click(screen.getByRole('button', { name: 'Continue to delivery' }));
  expect(screen.getByTestId('secure-checkout-page')).toBeTruthy();
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-10-10T00:30:00Z')); // 6:00 AM IST
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('PR18 inactive menu cart — checkout is now on separate page', () => {
  it('keeps exact item prices and ₹100 minimum on homepage; payment remains disabled on checkout', () => {
    mount();
    const menu = screen.getByTestId('upcoming-menu-section');
    const subtotal = screen.getByTestId('menu-cart-total');
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    expect(subtotal.textContent).toBe('₹0');
    expect(menu.textContent).toContain('₹100 minimum');
    fireEvent.click(within(menu).getByRole('button', { name: 'Add Pulka to sample cart' }));
    expect(subtotal.textContent).toBe('₹30');
    expect(menu.textContent).toContain('₹70');
    expect((screen.getByRole('button', { name: 'Continue to delivery' }) as HTMLButtonElement).disabled).toBe(true);
    for (let i = 0; i < 3; i++) fireEvent.click(within(menu).getByRole('button', { name: 'Increase Pulka sample quantity' }));
    expect(subtotal.textContent).toBe('₹120');
    expect(menu.textContent).toContain('Food minimum met');
    continueToDelivery();
    expect(screen.getByTestId('upcoming-cart-subtotal').textContent).toBe('₹120');
    expect(screen.getByRole('button', { name: 'New menu checkout unavailable' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('upcoming-checkout-preview').textContent).toContain('Food subtotal only');
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹120');
  });

  it('keeps the public menu evening-only and enforces minimum quantities', () => {
    mount();
    expect(getNextPreorderDeliverySlot('EVENING', new Date()).deliveryDateIst).toBe('2026-10-10');
    expect(screen.queryByRole('button', { name: /Morning|ఉదయం/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Chapathi to sample cart' }));
    expect(screen.getByLabelText('Chapathi sample quantity').textContent).toBe('3');
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹30');
    fireEvent.click(screen.getByRole('button', { name: 'Increase Chapathi sample quantity' }));
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹40');
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Chapathi sample quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Chapathi sample quantity' }));
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹0');
    fireEvent.click(screen.getByRole('button', { name: 'Add Pulka to sample cart' }));
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹30');
  });

  it('enforces daily quantity ceiling; stock is not claimed without server checking', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Add Pulka to sample cart' }));
    const increase = screen.getByRole('button', { name: 'Increase Pulka sample quantity' });
    for (let i = 0; i < 35; i++) if (!increase.hasAttribute('disabled')) fireEvent.click(increase);
    expect(screen.getByLabelText('Pulka sample quantity').textContent).toBe('30');
    expect(increase.hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹900');
    continueToDelivery();
    expect(screen.getByTestId('upcoming-checkout-preview').textContent).toContain('stock are not checked');
  });

  it('validates inputs locally on separate page and never creates orders or opens Razorpay', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    mount();
    expect(validateUpcomingPreview(3000, { name: '', mobile: '', address: '', landmark: '' }).length).toBeGreaterThan(0);
    addFourPulkas();
    continueToDelivery();
    fireEvent.click(screen.getByRole('button', { name: 'Check preview details' }));
    expect(screen.getByRole('alert').textContent).toContain('Enter a valid 10-digit Indian mobile number');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByLabelText('Mobile'), { target: { value: '9000000001' } });
    fireEvent.change(screen.getByLabelText('Delivery address'), { target: { value: 'Test Flat, Kollur' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check preview details' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('upcoming-format-valid').textContent).toContain('No order was created');
    expect(screen.getByRole('button', { name: 'New menu checkout unavailable' }).hasAttribute('disabled')).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('smjr_customer_orders')).toBeNull();
    expect(JSON.stringify({ ...localStorage })).not.toContain('9000000001');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('9000000001');
  });

  it('keeps existing next-day IST scheduling on the checkout page', () => {
    vi.setSystemTime(new Date('2026-10-10T05:00:00Z')); // 10:30 AM IST
    mount();
    addFourPulkas();
    continueToDelivery();
    expect(screen.getByTestId('upcoming-slot-preview').textContent).toContain('2026-10-10 · 18:00–20:00 IST');
    expect(screen.getByTestId('upcoming-slot-preview').textContent).toContain('not a confirmed delivery');
  });

  it('shares the authoritative minimum and rejects invalid field shapes', () => {
    expect(validateUpcomingPreview(9999, {
      name: 'A', mobile: '123', address: 'Hi', landmark: '',
    })).toHaveLength(4);
    expect(validateUpcomingPreview(10_000, {
      name: 'Test Person', mobile: '9876543210', address: 'Kollur flat number one', landmark: '',
    })).toEqual([]);
  });
});
