import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { translations } from '../src/utils/translations';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const name = 'Mannu’s Cloud Kitchen';

describe('Mannu’s Cloud Kitchen brand-only migration', () => {
  it('shows the new brand in both UI languages and customer checkout', () => {
    expect(translations.en.brandName).toBe(name);
    expect(translations.te.brandName).toBe(name);
    expect(read('src/components/BrandEmblem.tsx')).toContain(name);
    expect(read('src/components/SecureCheckoutPage.tsx')).toContain(name);
    expect(read('src/components/PaymentModal.tsx')).toContain(name);
    expect(read('src/components/LiveNewMenuCheckout.tsx')).toContain(name);
    expect(read('src/components/OwnerPortal/AdminLogin.tsx')).toContain(name);
    expect(read('src/components/OwnerPortal/OwnerDashboard.tsx')).toContain(name);
  });

  it('updates browser, PWA and share metadata without changing identity or app scope', () => {
    const html = read('index.html');
    const manifest = JSON.parse(read('public/manifest.json'));
    const vite = read('vite.config.ts');
    expect(html).toContain(name);
    expect(html).toContain('og:title');
    expect(manifest.name).toBe(name);
    expect(manifest.short_name).toBe('Mannu’s');
    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(vite).toContain(name);
    expect(vite).toContain("start_url: '/'");
    expect(read('public/brand-illustration.svg')).toContain(name);
  });

  it('retains payments, order recovery, and menu-launch safeguards', () => {
    expect(read('src/components/PaymentModal.tsx')).toContain("intent.provider !== 'razorpay'");
    expect(read('src/components/LiveNewMenuCheckout.tsx')).toContain('mana_new_menu_pending_order');
    expect(read('src/components/UpcomingMenuSection.tsx')).toContain('NEW_MENU_LAUNCH_ENABLED');
    expect(read('server/payments/provider.ts')).toContain('BUSINESS_CONFIG.brand.upiId');
  });
});
