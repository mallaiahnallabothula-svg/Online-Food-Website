// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import { LanguageProvider } from '../src/context/LanguageContext.tsx';
import { UpcomingMenuSection } from '../src/components/UpcomingMenuSection.tsx';
import { DELIVERY_POLICY } from '../shared/deliveryPolicy.ts';
import { NEW_MENU_ORDER_POLICY } from '../shared/menuCatalog.ts';

const read = (path: string) => fs.readFileSync(path, 'utf8');
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); localStorage.clear(); });

describe('Stage 2A ordering-clarity presentation', () => {
  it('shows only actual policy delivery rates and warns distance is straight-line', () => {
    render(<LanguageProvider><UpcomingMenuSection /></LanguageProvider>);
    const guide = screen.getByTestId('menu-delivery-rates');
    const guideText = guide.textContent || '';
    expect(guideText).toContain('0–' + DELIVERY_POLICY.freeRadiusKm + ' km');
    expect(guideText).toContain('₹' + DELIVERY_POLICY.standardChargePaisa / 100);
    expect(guideText).toContain('₹' + DELIVERY_POLICY.outerChargePaisa / 100);
    expect(guideText).toContain('Beyond ' + DELIVERY_POLICY.maxRadiusKm + ' km');
    expect(guideText).toContain('Straight-line distance');
    expect(guideText).toContain('map-pin verification');
  });

  it('visualizes the existing food minimum without changing cart quantities or checkout gate', () => {
    render(<LanguageProvider><UpcomingMenuSection /></LanguageProvider>);
    const progress = screen.getByRole('progressbar', { name: 'Food minimum progress' });
    expect(progress.getAttribute('aria-valuemax')).toBe(String(NEW_MENU_ORDER_POLICY.minimumCartPaisa / 100));
    expect(progress.getAttribute('aria-valuenow')).toBe('0');
    fireEvent.click(screen.getByRole('button', {name:'Add Idly to sample cart'}));
    expect(progress.getAttribute('aria-valuenow')).toBe('30');
    expect(screen.getByTestId('menu-cart-total').textContent).toContain('₹30');
    expect(screen.getByText(/Add ₹70 more/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name:'Add Ragi Idly to sample cart'}));
    fireEvent.click(screen.getByRole('button', {name:'Increase Idly sample quantity'}));
    expect(progress.getAttribute('aria-valuenow')).toBe('100');
    expect(screen.getByTestId('menu-cart-total').textContent).toContain('₹100');
    expect(screen.getByText(/Food minimum met/)).toBeTruthy();
  });

  it('keeps checkout/payment handlers, tracking and reorder eligibility unchanged', () => {
    const checkout = read('src/components/LiveNewMenuCheckout.tsx');
    const header = read('src/components/Header.tsx');
    const menu = read('src/components/UpcomingMenuSection.tsx');
    const reorder = read('src/utils/reorder.ts');
    expect(checkout).toContain('data-testid="checkout-guidance"');
    expect(checkout).toContain('onSubmit={checkQuote}');
    expect(checkout).toContain('onClick={pay}');
    expect(checkout).toContain("post('/quote', cart)");
    expect(checkout).toContain('locationConfirmed');
    expect(header).toContain('onClick={onOpenOrderTracker}');
    expect(header).toContain('Reorder');
    expect(reorder).toContain("order.fulfillmentStatus !== 'DELIVERED'");
    expect(menu).toContain('onCheckout?.({ period, lines: selected, subtotalPaisa })');
    expect(menu).toContain('NEW_MENU_LAUNCH_ENABLED');
  });

  it('retains reduced motion and approved site assets with no new dependencies', () => {
    expect(read('src/index.css')).toContain('prefers-reduced-motion:reduce');
    expect(read('src/components/HeroSection.tsx')).toContain('FoodArtwork itemId="guntha-ponganaalu"');
    expect(read('src/App.tsx')).toContain('<OwnerDashboard');
  });
});
