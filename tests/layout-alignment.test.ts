// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('Layout alignment polish stays presentation-only', () => {
  it('uses the existing max-w-7xl container and consistent responsive gutters across site sections', () => {
    for (const file of ['src/components/Header.tsx', 'src/components/HeroSection.tsx',
      'src/components/UpcomingMenuSection.tsx', 'src/components/SolaraEditorialContent.tsx',
      'src/App.tsx']) {
      const src = read(file);
      expect(src).toContain('max-w-7xl');
      expect(src).toContain('px-4');
      expect(src).toContain('sm:px-6');
    }
    expect(read('src/App.tsx')).toContain('<main className="min-w-0 flex-1">');
    expect(read('src/App.tsx')).toContain('items-start gap-x-9 gap-y-8 px-4');
    expect(read('src/components/Header.tsx')).toContain('min-w-0 flex-wrap items-center justify-center');
  });

  it('keeps menu and inspiration cards aligned without changing price, quantity or menu controls', () => {
    const menu = read('src/components/UpcomingMenuSection.tsx');
    const editorial = read('src/components/SolaraEditorialContent.tsx');
    expect(menu).toContain('md:auto-rows-fr md:grid-cols-2');
    expect(menu).toContain('solara-menu-row grid h-full min-w-0');
    expect(editorial).toContain('sm:auto-rows-fr sm:grid-cols-3');
    expect(editorial).toContain('flex h-full min-w-0 flex-col');
    expect(editorial).toContain('mt-auto inline-flex items-center self-start');
    expect(menu).toContain('onCheckout?.({ period, lines: selected, subtotalPaisa })');
    expect(menu).toContain('NEW_MENU_LAUNCH_ENABLED');
    expect(menu).toContain('minimumQuantity');
  });

  it('keeps narrow separate checkout readable without activating payment', () => {
    const page = read('src/components/SecureCheckoutPage.tsx');
    const preview = read('src/components/UpcomingCheckoutPreview.tsx');
    expect(page).toContain('max-w-3xl');
    expect(page).toContain('solara-checkout-page-enter');
    expect(preview).toContain('grid min-w-0 gap-5');
    expect(preview).not.toContain('lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]');
    expect(preview).toContain('New menu checkout unavailable');
    expect(read('src/components/LiveNewMenuCheckout.tsx')).toContain('onSubmit={checkQuote}');
  });

  it('does not replace the original brand palette, illustrations, or motion CSS', () => {
    const css = read('src/index.css');
    const hero = read('src/components/HeroSection.tsx');
    expect(css).toContain('@keyframes mev-soft-rise');
    expect(css).toContain('prefers-reduced-motion:reduce');
    for (const color of ['#FAF6ED','#384B35','#A44732']) expect(css + hero).toContain(color);
    expect(hero).toContain('solara-hero-illustration');
    expect(hero).toContain('Everyday food.');
    expect(read('shared/deliveryPolicy.ts')).toContain('standardChargePaisa: 2700');
    expect(read('shared/deliveryPolicy.ts')).toContain('outerChargePaisa: 4500');
  });
});
