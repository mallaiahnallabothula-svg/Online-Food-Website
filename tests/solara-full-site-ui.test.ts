// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
const source = (file: string) => fs.readFileSync(file, 'utf8');
describe('Solara full-site UI protects business workflows', () => {
  it('mounts customer, owner and tracking routes without replacing components', () => {
    const app=source('src/App.tsx');
    for(const tag of ['HeroSection','UpcomingMenuSection','SolaraEditorialContent','AdminLogin','OwnerDashboard','OrderTrackingModal']) expect(app).toContain('<'+tag);
    expect(app).toContain('solara-owner'); expect(app).toContain('solara-footer-links');
  });
  it('retains launch gate, quantity controls and live payment verification', () => {
    const menu=source('src/components/UpcomingMenuSection.tsx');
    const checkout=source('src/components/UpcomingCheckoutPreview.tsx');
    const live=source('src/components/LiveNewMenuCheckout.tsx');
    expect(menu).toContain('NEW_MENU_LAUNCH_ENABLED'); expect(menu).not.toContain('<UpcomingCheckoutPreview');
    expect(source('src/components/SecureCheckoutPage.tsx')).toContain('<UpcomingCheckoutPreview');
    expect(menu).toContain('minimumQuantity'); expect(menu).toContain('menu-cart-total');
    expect(checkout).toContain('<LiveNewMenuCheckout');
    expect(live).toContain('loadRazorpay'); expect(live).toContain('onSubmit={checkQuote}');
  });
  it('retains owner kitchen and review controls plus English-first preference', () => {
    expect(source('src/components/OwnerPortal/OwnerDashboard.tsx')).toContain("setActiveTab('PAYMENT_REVIEW')");
    expect(source('src/components/OwnerPortal/OwnerDashboard.tsx')).toContain('<KitchenBoard');
    expect(source('src/context/LanguageContext.tsx')).toContain("return 'en'");
    expect(source('src/components/OrderTrackingModal.tsx')).toContain('fetchOrder');
    expect(source('src/components/PaymentModal.tsx')).toContain('onClick={pay}');
  });
  it('uses illustrated header branding without custom app install promotions', () => {
    const brand = source('src/components/BrandEmblem.tsx');
    const app = source('src/App.tsx');
    const header = source('src/components/Header.tsx');
    const hero = source('src/components/HeroSection.tsx');
    expect(brand).toContain('/brand-illustration.svg');
    expect(brand).not.toContain('logoImage');
    expect(header).toContain('CLOUD KITCHEN · KOLLUR');
    for (const sourceText of [app, header, hero]) {
      expect(sourceText).not.toContain('AndroidInstallBanner');
      expect(sourceText).not.toContain('AndroidInstallModal');
      expect(sourceText).not.toContain('onOpenInstallModal');
      expect(sourceText).not.toContain('install-app-btn');
    }
    expect(app).toContain('<OrderTrackingModal');
    expect(app).toContain('<OwnerDashboard');
  });
  it('retains approved content sections but removes the FAQ section', () => {
    const editorial=source('src/components/SolaraEditorialContent.tsx');
    expect(editorial).not.toContain('QUESTIONS, ANSWERED');
    for(const id of ['brand-story','at-the-table','delivery-info','contact-info'])expect(editorial).toContain('id="'+id+'"');
    expect(editorial).not.toContain('id="faq"');
    expect(editorial).not.toContain('Good to know.');
    expect(editorial).toContain('ORDERING & DELIVERY');
    expect(editorial).toContain('QUESTIONS? GET IN TOUCH.');
    expect(source('src/App.tsx')).not.toContain('href="#faq"');
    expect(editorial).not.toContain('id="details"');
    expect(editorial).not.toContain('id="how-it-works"');
    expect(source('src/App.tsx')).not.toContain('<BrandEmblem');
    expect(source('src/components/HeroSection.tsx')).toContain('Morning favourites');
  });
});
