// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
const source = (file: string) => fs.readFileSync(file, 'utf8');
describe('Solara full-site UI protects business workflows', () => {
  it('mounts customer, owner, tracking and install routes without replacing components', () => {
    const app=source('src/App.tsx');
    for(const tag of ['HeroSection','UpcomingMenuSection','SolaraEditorialContent','AdminLogin','OwnerDashboard','OrderTrackingModal','AndroidInstallModal']) expect(app).toContain('<'+tag);
    expect(app).toContain('solara-owner'); expect(app).toContain('solara-footer-links');
  });
  it('retains launch gate, quantity controls and live payment verification', () => {
    const menu=source('src/components/UpcomingMenuSection.tsx');
    const checkout=source('src/components/UpcomingCheckoutPreview.tsx');
    const live=source('src/components/LiveNewMenuCheckout.tsx');
    expect(menu).toContain('NEW_MENU_LAUNCH_ENABLED'); expect(menu).toContain('<UpcomingCheckoutPreview');
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
  it('retains all approved content-rich pages and FAQ', () => {
    const editorial=source('src/components/SolaraEditorialContent.tsx');
    for(const id of ['brand-story','details','at-the-table','how-it-works','delivery-info','faq','contact-info'])expect(editorial).toContain('id="'+id+'"');
    expect(editorial).toContain('Are these pictures from your kitchen?');
  });
});
