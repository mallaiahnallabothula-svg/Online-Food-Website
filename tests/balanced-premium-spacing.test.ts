import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
const read = (p: string) => fs.readFileSync(p, 'utf8');
describe('Balanced Premium spacing: customer-only', () => {
  it('compacts responsive hero, menu and footer while keeping touch targets', () => {
    const hero = read('src/components/HeroSection.tsx');
    const menu = read('src/components/UpcomingMenuSection.tsx');
    const app = read('src/App.tsx');
    expect(hero).toContain('px-4 py-8 text-[#384B35]');
    expect(hero).toContain('sm:px-6 sm:py-10 lg:py-12');
    expect(menu).toContain('px-4 py-10 sm:px-6 sm:py-12 lg:py-14');
    expect(menu).toContain('py-4 sm:py-5 sm:grid-cols');
    expect(menu).toContain('min-h-11');
    expect(app).toContain('solara-footer mt-auto');
    expect(app).toContain('py-8 sm:py-10');
  });
  it('preserves Story, Menu, Delivery, FAQ, Contact and business behavior', () => {
    const ed = read('src/components/SolaraEditorialContent.tsx');
    for (const id of ['brand-story', 'at-the-table', 'delivery-info', 'faq', 'contact-info']) expect(ed).toContain('id="' + id + '"');
    expect(ed).toContain('QUESTIONS, ANSWERED');
    expect(ed).toContain('Good to know.');
    expect(ed).toContain('Are these pictures from your kitchen?');
    expect(ed).toContain('py-8 sm:py-10 lg:py-12');
    const app = read('src/App.tsx');
    expect(app).toContain('href="#faq"');
    expect(app).toContain('<SecureCheckoutPage');
    const menu = read('src/components/UpcomingMenuSection.tsx');
    expect(menu).toContain('NEW_MENU_LAUNCH_ENABLED');
    expect(menu).toContain('minimumQuantity');
    expect(menu).toContain('onCheckout?.({ period, lines: selected, subtotalPaisa })');
  });
});
