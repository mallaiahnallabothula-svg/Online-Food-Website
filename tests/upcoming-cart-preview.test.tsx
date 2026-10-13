// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext.tsx';
import { UpcomingMenuSection } from '../src/components/UpcomingMenuSection.tsx';
import { validateUpcomingPreview } from '../src/components/UpcomingCheckoutPreview.tsx';
import { NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';

function SwitchEnglish() {
  const { setLanguage } = useLanguage();
  return <button type="button" onClick={() => setLanguage('en')}>English preview</button>;
}

function mount() {
  render(<LanguageProvider><SwitchEnglish /><UpcomingMenuSection /></LanguageProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'English preview' }));
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-10-10T00:30:00Z')); // 6:00 AM IST
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('PR18 inactive customer cart and checkout preview', () => {
  it('shows correct server-catalog price, ₹100 minimum and always disabled payment', () => {
    mount();
    const menu = screen.getByTestId('upcoming-menu-section');
    const subtotal = screen.getByTestId('upcoming-cart-subtotal');
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    expect(subtotal.textContent).toBe('₹0');
    expect(screen.getByTestId('upcoming-minimum-message').textContent).toContain('₹100');

    fireEvent.click(within(menu).getByRole('button', { name: 'Add Idly to sample cart' }));
    expect(subtotal.textContent).toBe('₹30');
    expect(screen.getByTestId('upcoming-minimum-message').textContent).toContain('₹70');

    for (let i = 0; i < 3; i++) {
      fireEvent.click(within(menu).getByRole('button', { name: 'Increase Idly sample quantity' }));
    }
    expect(subtotal.textContent).toBe('₹120');
    expect(screen.getByTestId('upcoming-minimum-message').textContent).toContain('minimum met');
    expect(within(menu).getByRole('button', { name: 'New menu checkout unavailable' }).hasAttribute('disabled')).toBe(true);
    expect(menu.textContent).toContain('Food subtotal only');
  });

  it('uses existing IST preorder scheduling and clears morning cart when evening selected', () => {
    mount();
    expect(screen.getByTestId('upcoming-slot-preview').textContent).toContain('2026-10-10 · 07:00–11:00 IST');
    fireEvent.click(screen.getByRole('button', { name: 'Add Idly to sample cart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Evening (6)' }));
    expect(screen.getAllByTestId('upcoming-menu-card')).toHaveLength(6);
    expect(screen.getByTestId('upcoming-cart-subtotal').textContent).toBe('₹0');
    expect(screen.getByTestId('upcoming-slot-preview').textContent).toContain('2026-10-10 · 18:00–20:00 IST');
    fireEvent.click(screen.getByRole('button', { name: 'Add Chapathi to sample cart' }));
    expect(screen.getByLabelText('Chapathi sample quantity').textContent).toBe('3');
    expect(screen.getByTestId('upcoming-cart-subtotal').textContent).toBe('₹30');
    fireEvent.click(screen.getByRole('button', { name: 'Increase Chapathi sample quantity' }));
    expect(screen.getByTestId('upcoming-cart-subtotal').textContent).toBe('₹40');
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Chapathi sample quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Chapathi sample quantity' }));
    expect(screen.getByTestId('upcoming-cart-subtotal').textContent).toBe('₹0');
  });

  it('enforces daily quantity ceiling in the sample cart without claiming stock availability', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Add Idly to sample cart' }));
    const increase = screen.getByRole('button', { name: 'Increase Idly sample quantity' });
    for (let i = 0; i < 35; i++) {
      if (!increase.hasAttribute('disabled')) fireEvent.click(increase);
    }
    expect(screen.getByLabelText('Idly sample quantity').textContent).toBe('30');
    expect(increase.hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('upcoming-cart-subtotal').textContent).toBe('₹900');
    expect(screen.getByTestId('upcoming-checkout-preview').textContent).toContain('stock are not checked');
  });

  it('validates name, phone and delivery address locally; never places orders or opens Razorpay', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Add Idly to sample cart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check preview details' }));
    let alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Food cart must be at least ₹100');
    expect(alert.textContent).toContain('Enter a valid 10-digit Indian mobile number');

    fireEvent.click(screen.getByRole('button', { name: 'Increase Idly sample quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase Idly sample quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase Idly sample quantity' }));

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

  it('previews next-day meal after the IST cutoff without guaranteeing delivery', () => {
    vi.setSystemTime(new Date('2026-10-10T05:00:00Z')); // 10:30 AM IST; 11:00 end is exclusive
    mount();
    expect(screen.getByTestId('upcoming-slot-preview').textContent).toContain('2026-10-11 · 07:00–11:00 IST');
    expect(screen.getByTestId('upcoming-slot-preview').textContent).toContain('not a confirmed delivery');
  });

  it('shares the real minimum threshold and rejects invalid field shapes', () => {
    expect(validateUpcomingPreview(9999, {
      name: 'A', mobile: '123', address: 'Hi', landmark: '',
    })).toHaveLength(4);
    expect(validateUpcomingPreview(10_000, {
      name: 'Test Person', mobile: '9876543210', address: 'Kollur flat number one', landmark: '',
    })).toEqual([]);
  });
});
