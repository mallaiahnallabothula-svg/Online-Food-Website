// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import fs from 'node:fs';
import { UpcomingMenuSection } from '../src/components/UpcomingMenuSection.tsx';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext.tsx';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function LanguageSwitch() {
  const { setLanguage } = useLanguage();
  return <button type="button" onClick={() => setLanguage('en')}>Use English</button>;
}

function mount() {
  return render(
    <LanguageProvider>
      <LanguageSwitch />
      <UpcomingMenuSection />
    </LanguageProvider>,
  );
}

describe('PR17 public coming-soon menu (display only)', () => {
  it('displays all six morning menu cards from existing approved catalog', () => {
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    expect(MENU_CATALOG).toHaveLength(12);
    const { container } = mount();
    const menu = screen.getByTestId('upcoming-menu-section');
    expect(screen.getAllByTestId('upcoming-menu-card')).toHaveLength(6);
    for (const item of MENU_CATALOG.filter(x => x.mealPeriod === 'MORNING')) {
      expect(container.querySelector('[data-item-id="' + item.id + '"]')).toBeTruthy();
    }
    expect(within(menu).getByRole('heading', { level: 2 }).textContent).toContain('12');
    expect(menu.textContent).toContain('7:00 AM – 11:00 AM');
    expect(menu.textContent).toContain('₹30');
    expect(menu.textContent).toContain('₹40');
    // Sample cart is interactive, but real payment/order checkout stays disabled.
    expect(within(menu).queryByText('Pay Now')).toBeNull();
    expect(within(menu).queryByRole('button', { name: 'New menu checkout unavailable' })).toBeNull();
    expect(within(menu).queryByTestId('upcoming-preview-form')).toBeNull();
  });

  it('shows small food artwork for each row, with original prices and controls', () => {
    const { container } = mount();
    const menu = screen.getByTestId('upcoming-menu-section');
    const rows = screen.getAllByTestId('upcoming-menu-card');
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      const artwork = row.querySelector('[aria-hidden="true"].food-artwork');
      expect(artwork?.querySelector('svg[viewBox="0 0 160 160"]') ?? artwork?.querySelector('[data-exact-artwork]')).toBeTruthy();
    }
    expect(container.querySelector('[data-item-id="idly"]')?.querySelector('[data-exact-artwork="idly"]')).toBeTruthy();
    expect(container.querySelector('[data-item-id="ragi-idly"]')?.querySelector('[data-exact-artwork="ragi-idly"]')).toBeTruthy();
    expect(container.querySelector('[data-item-id="idly"]')?.textContent).toContain('₹30');
    fireEvent.click(within(menu).getByRole('button', { name: 'Add Idly to sample cart' }));
    expect(within(menu).getByRole('button', { name: 'View cart' })).toBeTruthy();
    expect(within(menu).getByTestId('menu-cart-total').textContent).toContain('₹30');
    fireEvent.click(screen.getByRole('button', { name: 'Evening (6)' }));
    expect(screen.getAllByTestId('upcoming-menu-card')).toHaveLength(6);
    expect(container.querySelector('[data-item-id="chapathi"]')?.querySelector('[data-exact-artwork="chapathi"]')).toBeTruthy();
    const pulkaArt = container.querySelector('[data-item-id="pulka"]')?.querySelector('[data-exact-artwork="pulka"]') as HTMLElement | null;
    expect(pulkaArt).toBeTruthy();
    expect(pulkaArt?.style.backgroundImage).toContain('mannus-punugulu-pulka-text-free.webp');
    expect(container.querySelector('[data-item-id="pappu-of-the-day"]')?.querySelector('[data-exact-artwork="pappu-of-the-day"]')).toBeTruthy();
    expect(container.querySelector('[data-item-id="mixed-veg-kurma"]')?.querySelector('[data-exact-artwork="mixed-veg-kurma"]')).toBeTruthy();
    for (const item of MENU_CATALOG.filter(entry => entry.mealPeriod === 'EVENING')) {
      expect(container.querySelector('[data-item-id="' + item.id + '"]')?.querySelector('[data-exact-artwork]')).toBeTruthy();
    }
  });

  it('shows four evening items without referring customers to a separate old order form', () => {
    const { container } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Evening (6)' }));
    expect(screen.getAllByTestId('upcoming-menu-card')).toHaveLength(6);
    const menu = screen.getByTestId('upcoming-menu-section');
    expect(menu.textContent).toContain('6:00 PM – 8:00 PM');
    for (const item of MENU_CATALOG.filter(x => x.mealPeriod === 'EVENING')) {
      expect(container.querySelector('[data-item-id="' + item.id + '"]')).toBeTruthy();
    }
    const chapathi = container.querySelector('[data-item-id="chapathi"]') as HTMLElement;
    expect(chapathi.textContent).toContain('₹10');
    expect(chapathi.textContent).toContain('3');
    fireEvent.click(screen.getByRole('button', { name: 'Use English' }));
    expect(chapathi.textContent).toContain('New-menu ordering coming soon');
    expect(menu.textContent).toContain('New-menu ordering coming soon');
    expect(within(menu).queryByRole('button', { name: 'New menu checkout unavailable' })).toBeNull();
    expect(within(menu).queryByTestId('upcoming-preview-form')).toBeNull();
  });

  it('keeps the customer homepage on the 10-item menu while preserving owner and tracking access', () => {
    const app = fs.readFileSync('src/App.tsx', 'utf8');
    const upcoming = app.indexOf('<UpcomingMenuSection');
    const legacyOrder = app.indexOf('<OrderForm');
    expect(upcoming).toBeGreaterThan(0);
    expect(legacyOrder).toBe(-1);
    expect(app).not.toContain('Existing roti &amp; chapathi checkout');
    expect(app).toContain('<OrderTrackingModal');
    expect(app).toContain('<OwnerDashboard');
    expect(app).toContain('<AdminLogin');
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
  });
});


describe('menu cart navigation', () => {
  it('keeps the visible cart total in sync and moves to delivery without starting checkout', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const navigate = vi.fn();
    const { container } = render(<LanguageProvider><LanguageSwitch /><UpcomingMenuSection onCheckout={navigate} /></LanguageProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Use English' }));
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: i === 0 ? 'Add Idly to sample cart' : 'Increase Idly sample quantity' }));
    }
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹120');
    expect(screen.queryByRole('complementary', { name: 'Your cart summary' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View cart' }));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]![0].period).toBe('MORNING');
    expect(navigate.mock.calls[0]![0].subtotalPaisa).toBe(12000);
    expect(fetchSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Evening (6)' }));
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹0');
    expect(screen.queryByRole('button', { name: 'View cart' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Jowar Roti to sample cart' }));
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹90');
    fireEvent.click(screen.getByRole('button', { name: 'Morning (6)' }));
    expect(screen.getByTestId('menu-cart-total').textContent).toBe('₹120');
    expect(screen.queryByRole('complementary', { name: 'Your cart summary' })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
