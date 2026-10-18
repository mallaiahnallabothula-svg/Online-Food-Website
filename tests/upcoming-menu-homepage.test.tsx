// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import fs from 'node:fs';
import { UpcomingMenuSection } from '../src/components/UpcomingMenuSection.tsx';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext.tsx';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';
import type { ReorderRequest } from '../src/utils/reorder.ts';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function LanguageSwitch() {
  const { setLanguage } = useLanguage();
  return <button type="button" onClick={() => setLanguage('en')}>Use English</button>;
}

function mount(reorderRequest?: ReorderRequest | null) {
  return render(
    <LanguageProvider>
      <LanguageSwitch />
      <UpcomingMenuSection reorderRequest={reorderRequest} />
    </LanguageProvider>,
  );
}

describe('public evening-only menu', () => {
  it('shows evening menu only while retaining morning catalog records for order history', () => {
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    expect(MENU_CATALOG).toHaveLength(12);
    const { container } = mount();
    const menu = screen.getByTestId('upcoming-menu-section');
    const eveningItems = MENU_CATALOG.filter(item => item.mealPeriod === 'EVENING');
    expect(screen.getAllByTestId('upcoming-menu-card')).toHaveLength(eveningItems.length);
    for (const item of eveningItems) {
      expect(container.querySelector('[data-item-id="' + item.id + '"]')).toBeTruthy();
    }
    for (const item of MENU_CATALOG.filter(entry => entry.mealPeriod === 'MORNING')) {
      expect(container.querySelector('[data-item-id="' + item.id + '"]')).toBeNull();
    }
    expect(within(menu).getByRole('heading', { level: 2 }).textContent).toContain(String(eveningItems.length));
    expect(menu.textContent).toContain('6:00 PM – 8:00 PM');
    expect(menu.textContent).not.toContain('7:00 AM – 11:00 AM');
    expect(menu.textContent).not.toContain('Morning');
    expect(menu.textContent).not.toContain('ఉదయం');
    expect(within(menu).queryByRole('button', { name: 'Add Idly to sample cart' })).toBeNull();
    expect(within(menu).queryByText('Pay Now')).toBeNull();
    expect(within(menu).queryByRole('button', { name: 'New menu checkout unavailable' })).toBeNull();
    expect(within(menu).queryByTestId('upcoming-preview-form')).toBeNull();
  });

  it('shows correct evening artwork, prices and sample-cart controls', () => {
    const { container } = mount();
    const menu = screen.getByTestId('upcoming-menu-section');
    const rows = screen.getAllByTestId('upcoming-menu-card');
    expect(rows).toHaveLength(6);
    expect(rows).toHaveLength(6);
    expect(container.querySelector('[data-item-id="chapathi"]')?.querySelector('[data-exact-artwork="chapathi"]')).toBeTruthy();
    expect(container.querySelector('[data-item-id="pulka"]')?.querySelector('[data-exact-artwork="pulka"]')).toBeTruthy();
    expect(container.querySelector('[data-item-id="pappu-of-the-day"]')?.querySelector('[data-exact-artwork="pappu-of-the-day"]')).toBeTruthy();
    expect(container.querySelector('[data-item-id="mixed-veg-kurma"]')?.querySelector('[data-exact-artwork="mixed-veg-kurma"]')).toBeTruthy();
    expect(container.querySelector('[data-item-id="guntha-ponganaalu"]')).toBeTruthy();
    expect(container.querySelector('[data-item-id="chapathi"]')?.textContent).toContain('₹10');
    fireEvent.click(within(menu).getByRole('button', { name: 'Add Pulka to sample cart' }));
    expect(within(menu).getByRole('button', { name: 'View cart' })).toBeTruthy();
    expect(within(menu).getByTestId('menu-cart-total').textContent).toContain('₹30');
  });

  it('shows evening hours and preserves owner, tracking and the existing launch gate', () => {
    const { container } = mount();
    const menu = screen.getByTestId('upcoming-menu-section');
    expect(screen.getAllByTestId('upcoming-menu-card')).toHaveLength(6);
    expect(menu.textContent).toContain('6:00 PM – 8:00 PM');
    const chapathi = container.querySelector('[data-item-id="chapathi"]') as HTMLElement;
    fireEvent.click(screen.getByRole('button', { name: 'Use English' }));
    expect(chapathi.textContent).toContain('New-menu ordering coming soon');
    expect(menu.textContent).toContain('New-menu ordering coming soon');
    const app = fs.readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain('<UpcomingMenuSection');
    expect(app).not.toContain('<OrderForm');
    expect(app).toContain('<OrderTrackingModal');
    expect(app).toContain('<OwnerDashboard');
    expect(app).toContain('<AdminLogin');
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
  });

  it('does not expose old morning orders as a reorderable public menu', async () => {
    const request: ReorderRequest = {
      sourceOrderId: 'MENU-00000000-0000-4000-8000-000000000001',
      period: 'MORNING',
      lines: [{ itemId: 'idly', quantity: 4 }],
    };
    const { container } = mount(request);
    const menu = screen.getByTestId('upcoming-menu-section');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(container.querySelector('[data-item-id="idly"]')).toBeNull();
    expect(menu.textContent).not.toContain('Morning');
  });

  it('keeps cart totals accurate and starts no network or payment action from the sample cart', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const navigate = vi.fn();
    const { container } = render(<LanguageProvider><LanguageSwitch /><UpcomingMenuSection onCheckout={navigate} /></LanguageProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Use English' }));
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: i === 0 ? 'Add Pulka to sample cart' : 'Increase Pulka sample quantity' }));
    }
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹120');
    expect(screen.queryByRole('complementary', { name: 'Your cart summary' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View cart' }));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]![0].period).toBe('EVENING');
    expect(navigate.mock.calls[0]![0].subtotalPaisa).toBe(12000);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.querySelector('[data-item-id="idly"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /Morning|ఉదయం/ })).toBeNull();
  });
});
