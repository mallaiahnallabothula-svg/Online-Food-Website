// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext';
import { SecureCheckoutPage } from '../src/components/SecureCheckoutPage';
import { MENU_CATALOG } from '../shared/menuCatalog';
import { rememberCheckoutSelection, restoreCheckoutSelection, type CheckoutSelection } from '../src/utils/checkoutSelection';

afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); vi.unstubAllGlobals(); });
const eveningItem = MENU_CATALOG.find(item => item.id === 'pulka')!;
const selection: CheckoutSelection = {
  period: 'EVENING', lines: [{ item: eveningItem, quantity: 4 }],
  subtotalPaisa: eveningItem.pricePaisa * 4,
};
describe('Separate secure checkout page', () => {
  it('renders checkout with Back to Menu and preserves the launch gate', () => {
    const onBack = vi.fn();
    render(<LanguageProvider><SecureCheckoutPage selection={selection} onBack={onBack} /></LanguageProvider>);
    expect(screen.getByTestId('secure-checkout-page')).toBeTruthy();
    expect(screen.getByText('Delivery details')).toBeTruthy();
    expect(screen.getByTestId('upcoming-preview-form')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
  it('shows an empty-cart message for direct links without a valid selection', () => {
    render(<LanguageProvider><SecureCheckoutPage selection={null} onBack={vi.fn()} /></LanguageProvider>);
    expect(screen.getByText('Your cart is empty')).toBeTruthy();
    expect(screen.queryByTestId('upcoming-preview-form')).toBeNull();
  });
  it('reconstructs evening catalog prices and rejects discontinued morning and invalid carts', () => {
    rememberCheckoutSelection(selection);
    expect(restoreCheckoutSelection()?.subtotalPaisa).toBe(12000);
    sessionStorage.setItem('mana_secure_checkout_selection_v1', JSON.stringify({ period: 'MORNING', lines: [{ itemId: 'idly', quantity: 1 }] }));
    expect(restoreCheckoutSelection()).toBeNull();
    sessionStorage.setItem('mana_secure_checkout_selection_v1', JSON.stringify({ period: 'MORNING', lines: [{ itemId: 'idly', quantity: 4, pricePaisa: 1 }] }));
    expect(restoreCheckoutSelection()).toBeNull();
    sessionStorage.setItem('mana_secure_checkout_selection_v1', JSON.stringify({ period: 'EVENING', lines: [{ itemId: 'idly', quantity: 4 }] }));
    expect(restoreCheckoutSelection()).toBeNull();
  });
});
