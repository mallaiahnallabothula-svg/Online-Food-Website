// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import { LanguageProvider } from '../src/context/LanguageContext';
import { SolaraEditorialContent } from '../src/components/SolaraEditorialContent';

const read = (path: string) => fs.readFileSync(path, 'utf8');
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); localStorage.clear(); });

describe('Customer-only subtle motion and accessibility', () => {
  it('keeps the approved illustrations and uses CSS-only entrance animations', () => {
    const hero = read('src/components/HeroSection.tsx');
    const css = read('src/index.css');
    for (const mark of ['solara-hero-heading','solara-hero-illustration','mev-soft-rise']) {
      expect(hero + css).toContain(mark);
    }
    expect(hero).toContain('Everyday food.');
    expect(hero).toContain('Always familiar.');
    expect(hero).toContain('Morning favourites');
    expect(hero).toContain('Evening comfort');
  });

  it('animates menu period and cart styling without changing order/stock handlers', () => {
    const menu = read('src/components/UpcomingMenuSection.tsx');
    const css = read('src/index.css');
    expect(menu).toContain('data-period={period}');
    expect(css).toContain('.solara-menu-tabs[data-period="EVENING"]::after');
    expect(menu).toContain('solara-quantity-enter');
    expect(menu).toContain('menu-cart-total');
    expect(menu).toContain('onCheckout?.({ period, lines: selected, subtotalPaisa })');
    expect(menu).toContain('NEW_MENU_LAUNCH_ENABLED');
    expect(menu).toContain('checkReorderStock');
  });

  it('opens and closes FAQs with aria state and continuously mounted answer panels', () => {
    render(<LanguageProvider><SolaraEditorialContent /></LanguageProvider>);
    const question = screen.getByRole('button', { name: 'How much is delivery?' });
    const panel = document.getElementById('faq-answer-2');
    expect(question.getAttribute('aria-expanded')).toBe('false');
    expect(panel?.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(question);
    expect(question.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.getAttribute('aria-hidden')).toBe('false');
    expect(panel?.textContent).toContain('₹27');
    fireEvent.click(question);
    expect(question.getAttribute('aria-expanded')).toBe('false');
    expect(panel?.getAttribute('aria-hidden')).toBe('true');
  });

  it('supports a short checkout fade and honors reduced motion', () => {
    const css = read('src/index.css');
    expect(read('src/components/SecureCheckoutPage.tsx')).toContain('solara-checkout-page-enter');
    expect(css).toContain('@media (prefers-reduced-motion:reduce)');
    expect(css).toContain('.solara-faq-panel-open');
    expect(css).toContain('animation:none !important');
    expect(read('src/components/SecureCheckoutPage.tsx')).toContain('<UpcomingCheckoutPreview');
    expect(read('src/components/LiveNewMenuCheckout.tsx')).toContain('onSubmit={checkQuote}');
    expect(read('shared/deliveryPolicy.ts')).toContain('standardChargePaisa: 2700');
    expect(read('shared/deliveryPolicy.ts')).toContain('outerChargePaisa: 4500');
  });
});
