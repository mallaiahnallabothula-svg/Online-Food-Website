// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const read = (name: string) => fs.readFileSync(name, 'utf8');

describe('Approved full-site Cream + Olive + Terracotta UI', () => {
  it('uses exact brand colors throughout the new page palette', () => {
    const css = read('src/index.css');
    const hero = read('src/components/HeroSection.tsx');
    const menu = read('src/components/UpcomingMenuSection.tsx');
    const checkout = read('src/components/SecureCheckoutPage.tsx');
    for (const color of ['#FAF6ED', '#384B35', '#A44732']) {
      expect(css).toContain(color);
      expect(hero).toContain(color);
    }
    expect(menu).toContain('#FAF6ED');
    expect(checkout).toContain('#FAF6ED');
    expect(read('src/App.tsx')).toContain('bg-[#384B35]');
  });

  it('keeps editorial hero copy and original three food illustrations aligned', () => {
    const hero = read('src/components/HeroSection.tsx');
    expect(hero).toContain('lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]');
    expect(hero).toContain('lg:whitespace-nowrap');
    for (const text of ['Everyday food.', 'Always familiar.', 'Morning favourites', 'A familiar flavour', 'Evening comfort']) {
      expect(hero).toContain(text);
    }
    expect(hero).toContain('Explore the menu');
  });

  it('preserves all content sections and separate secure checkout navigation', () => {
    const app = read('src/App.tsx');
    const editorial = read('src/components/SolaraEditorialContent.tsx');
    const menu = read('src/components/UpcomingMenuSection.tsx');
    for (const id of ['brand-story','at-the-table','delivery-info','faq','contact-info']) expect(editorial).toContain('id="' + id + '"');
    expect(app).toContain('<SecureCheckoutPage');
    expect(app).toContain('hidden={checkoutRoute}');
    expect(menu).toContain('onCheckout?.({ period, lines: selected, subtotalPaisa })');
    expect(read('src/components/LiveNewMenuCheckout.tsx')).toContain('onSubmit={checkQuote}');
    expect(read('shared/deliveryPolicy.ts')).toContain('standardChargePaisa: 2700');
    expect(read('shared/deliveryPolicy.ts')).toContain('outerChargePaisa: 4500');
  });
});
