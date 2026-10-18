// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('Stage 1 conversion-first presentation only', () => {
  it('reuses three approved local food artworks in the hero without changing the CTA', () => {
    const hero = read('src/components/HeroSection.tsx');
    for (const id of ['jowar-roti','chapathi','guntha-ponganaalu']) {
      expect(hero).toContain('FoodArtwork itemId="' + id + '"');
    }
    expect(hero).toContain('id="hero-order-now-btn"');
    expect(hero).toContain('onClick={onScrollToOrder}');
    expect(hero).toContain('Explore the menu');
    expect(hero).toContain('Food illustrations only; see the menu for exact portions.');
    expect(hero).not.toContain('Order Now');
  });

  it('derives trust strip claims from existing delivery and food-minimum rules', () => {
    const hero = read('src/components/HeroSection.tsx');
    expect(hero).toContain('DELIVERY_POLICY.freeRadiusKm');
    expect(hero).toContain('NEW_MENU_ORDER_POLICY.minimumCartPaisa / 100');
    expect(hero).toContain('Free delivery');
    expect(hero).toContain('Food order minimum');
    expect(hero).toContain('6 evening dishes');
    expect(hero).not.toContain('Limited time');
  });

  it('increases menu image prominence but preserves item actions and availability safeguards', () => {
    const menu = read('src/components/UpcomingMenuSection.tsx');
    expect(menu).toContain('grid-cols-[76px_minmax(0,1fr)_auto]');
    expect(menu).toContain('sm:grid-cols-[96px_minmax(0,1fr)_auto]');
    expect(menu).toContain('h-[76px] w-[76px]');
    expect(menu).toContain('sm:h-24 sm:w-24');
    expect(menu).toContain('data-item-id={item.id}');
    expect(menu).toContain('minimumQuantity');
    expect(menu).toContain('NEW_MENU_LAUNCH_ENABLED');
    expect(menu).toContain('availabilityForItem');
    expect(menu).toContain('onCheckout?.({ period, lines: selected, subtotalPaisa })');
    expect(menu).toContain('menu-mobile-cart sticky');
    expect(menu).toContain('bg-[#384B35]');
  });

  it('keeps published menu, payment, server, FAQ and owner routes out of the UI-only diff', () => {
    expect(read('src/App.tsx')).toContain('<OwnerDashboard');
    expect(read('src/App.tsx')).toContain('<SecureCheckoutPage');
    expect(read('src/components/SolaraEditorialContent.tsx')).toContain('id="faq"');
    expect(read('shared/menuCatalog.ts')).toContain("id: 'guntha-ponganaalu'");
    expect(read('shared/menuCatalog.ts')).toContain("id: 'pulka'");
    expect(read('src/index.css')).toContain('prefers-reduced-motion:reduce');
  });
});
