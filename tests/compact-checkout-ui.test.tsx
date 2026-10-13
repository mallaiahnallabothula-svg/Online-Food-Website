// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext.tsx';
import { LiveNewMenuCheckout } from '../src/components/LiveNewMenuCheckout.tsx';
import { MENU_CATALOG } from '../shared/menuCatalog.ts';

beforeEach(() => vi.stubGlobal('crypto', { randomUUID: () => '0185e823-46c2-4c14-90be-b35ba0000001' }));
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals(); });

describe('Example 2 compact checkout UI', () => {
  it('summarizes the actual cart in a collapsible area without changing amounts', () => {
    const idly = MENU_CATALOG.find(item => item.id === 'idly')!;
    const ragi = MENU_CATALOG.find(item => item.id === 'ragi-idly')!;
    render(<LanguageProvider><LiveNewMenuCheckout period="MORNING" lines={[{ item: idly, quantity: 2 }, { item: ragi, quantity: 2 }]} te={false} /></LanguageProvider>);
    expect(screen.getByTestId('live-new-menu-checkout').className).toContain('compact-checkout');
    const detail = screen.getByTestId('checkout-order-items') as HTMLDetailsElement;
    expect(detail.open).toBe(false);
    expect(detail.querySelector('summary')?.textContent).toContain('View / hide items');
    expect(detail.textContent).toContain('Idly × 2');
    expect(detail.textContent).toContain('Ragi Idly × 2');
    expect(screen.getByLabelText('Checkout progress')).toBeTruthy();
    expect(screen.getByLabelText('Google Maps location link (instead of GPS)')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Confirm delivery address and map pin' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Check delivery and total' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Use delivery location' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use this Maps pin' })).toBeTruthy();
  });
});
