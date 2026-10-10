// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import MenuPreview from '../src/preview/MenuPreview.tsx';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';

afterEach(cleanup);

describe('inactive menu design preview', () => {
  it('uses the approved catalog with all ten correct item prices and quantities', () => {
    expect(MENU_CATALOG).toHaveLength(10);
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    const { container } = render(<MenuPreview />);
    expect(screen.getAllByTestId('preview-menu-card')).toHaveLength(6);
    for (const item of MENU_CATALOG.filter(x => x.mealPeriod === 'MORNING')) {
      expect(container.querySelector('[data-item-id="' + item.id + '"]')).toBeTruthy();
    }
    expect(screen.getByText('4 pieces / plate')).toBeTruthy();
    expect(screen.getAllByText('Daily limit: 30 plates', { exact: false })).toHaveLength(6);
    expect(screen.getByRole('button',{name:'Checkout unavailable in design preview'}).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/Complimentary Karam Podi/)).toBeTruthy();
  });

  it('updates sample basket, respects ₹100 minimum and never enables checkout', () => {
    render(<MenuPreview />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Idly' }));
    expect(screen.getByTestId('preview-subtotal').textContent).toBe('₹30');
    expect(screen.getByTestId('preview-minimum-message').textContent).toContain('₹70');
    fireEvent.click(screen.getByRole('button', { name: 'Increase Idly' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase Idly' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase Idly' }));
    expect(screen.getByTestId('preview-subtotal').textContent).toBe('₹120');
    expect(screen.getByTestId('preview-minimum-message').textContent).toContain('meets');
    expect(screen.getByRole('button',{name:'Checkout unavailable in design preview'}).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Decrease Idly'}));
    expect(screen.getByTestId('preview-subtotal').textContent).toBe('₹90');
  });

  it('shows four evening items, legacy minimum quantities and clears sample basket on period change', () => {
    const { container } = render(<MenuPreview />);
    fireEvent.click(screen.getByRole('button',{name:'Add Idly'}));
    fireEvent.click(screen.getByRole('tab',{name:'Evening (4)'}));
    expect(screen.getAllByTestId('preview-menu-card')).toHaveLength(4);
    for (const item of MENU_CATALOG.filter(x=>x.mealPeriod==='EVENING')) {
      expect(container.querySelector('[data-item-id="'+item.id+'"]')).toBeTruthy();
    }
    expect(screen.getByTestId('preview-subtotal').textContent).toBe('₹0');
    fireEvent.click(screen.getByRole('button',{name:'Add Chapathi'}));
    const chapathi=container.querySelector('[data-item-id="chapathi"]') as HTMLElement;
    expect(within(chapathi).getByLabelText('Chapathi quantity').textContent).toBe('5');
    expect(screen.getByTestId('preview-subtotal').textContent).toBe('₹50');
    fireEvent.click(screen.getByRole('button',{name:'Decrease Chapathi'}));
    expect(screen.getByTestId('preview-subtotal').textContent).toBe('₹0');
  });
});
