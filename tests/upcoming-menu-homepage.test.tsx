// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import fs from 'node:fs';
import { UpcomingMenuSection } from '../src/components/UpcomingMenuSection.tsx';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext.tsx';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';

afterEach(() => {
  cleanup();
  localStorage.clear();
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
    expect(MENU_CATALOG).toHaveLength(10);
    const { container } = mount();
    const menu = screen.getByTestId('upcoming-menu-section');
    expect(screen.getAllByTestId('upcoming-menu-card')).toHaveLength(6);
    for (const item of MENU_CATALOG.filter(x => x.mealPeriod === 'MORNING')) {
      expect(container.querySelector('[data-item-id="' + item.id + '"]')).toBeTruthy();
    }
    expect(within(menu).getByRole('heading', { level: 2 }).textContent).toContain('10');
    expect(menu.textContent).toContain('7:00 AM – 11:00 AM');
    expect(menu.textContent).toContain('₹30');
    expect(menu.textContent).toContain('₹40');
    // Preview offers no add-to-cart, order, payment or checkout controls.
    expect(within(menu).queryByText('Pay Now')).toBeNull();
    expect(within(menu).queryByRole('button', { name: /checkout|order now|add to cart/i })).toBeNull();
  });

  it('shows four evening items with correct prices and points legacy orders to existing form', () => {
    const { container } = mount();
    fireEvent.click(screen.getByRole('button', { name: /సాయంత్రం \(4\)/ }));
    expect(screen.getAllByTestId('upcoming-menu-card')).toHaveLength(4);
    const menu = screen.getByTestId('upcoming-menu-section');
    expect(menu.textContent).toContain('6:00 PM – 8:00 PM');
    for (const item of MENU_CATALOG.filter(x => x.mealPeriod === 'EVENING')) {
      expect(container.querySelector('[data-item-id="' + item.id + '"]')).toBeTruthy();
    }
    const chapathi = container.querySelector('[data-item-id="chapathi"]') as HTMLElement;
    expect(chapathi.textContent).toContain('₹10');
    expect(chapathi.textContent).toContain('5');
    fireEvent.click(screen.getByRole('button', { name: 'Use English' }));
    expect(chapathi.textContent).toContain('Already available in the order form below');
    expect(menu.textContent).toContain('New-menu ordering coming soon');
    expect(within(menu).queryByRole('button', { name: /pay|checkout|buy|add/i })).toBeNull();
  });

  it('keeps legacy home checkout and owner flow unchanged when section is inserted', () => {
    const app = fs.readFileSync('src/App.tsx', 'utf8');
    const banner = app.indexOf('<OrderingHoursBanner');
    const upcoming = app.indexOf('<UpcomingMenuSection');
    const legacyOrder = app.indexOf('<OrderForm');
    expect(banner).toBeGreaterThan(0);
    expect(upcoming).toBeGreaterThan(banner);
    expect(legacyOrder).toBeGreaterThan(upcoming);
    expect(app).toContain('<PaymentModal');
    expect(app).toContain('<OrderTrackingModal');
    expect(app).toContain('<OwnerDashboard');
    expect(app).toContain('<AdminLogin');
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
  });
});
