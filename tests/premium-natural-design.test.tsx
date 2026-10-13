// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../src/context/LanguageContext.tsx';
import { HeroSection } from '../src/components/HeroSection.tsx';
import { HomeInfoSections } from '../src/components/HomeInfoSections.tsx';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED } from '../shared/menuCatalog.ts';
import { DELIVERY_POLICY } from '../shared/deliveryPolicy.ts';

afterEach(() => { cleanup(); localStorage.clear(); });

function English() {
  const { setLanguage } = useLanguage();
  return <button type="button" onClick={() => setLanguage('en')}>English test mode</button>;
}

describe('Premium Natural Design V2 (presentation only)', () => {
  it('preserves the launch flag and shows an honest menu CTA with correct session counts', () => {
    const onMenu = vi.fn();
    render(<LanguageProvider><English /><HeroSection onScrollToOrder={onMenu} isOpen={false} /></LanguageProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'English test mode' }));
    expect(MENU_CATALOG.filter(item => item.mealPeriod === 'MORNING')).toHaveLength(6);
    expect(MENU_CATALOG.filter(item => item.mealPeriod === 'EVENING')).toHaveLength(6);
    expect(screen.getByText(/Morning 6/)).toBeTruthy();
    expect(screen.getByText(/Evening 6/)).toBeTruthy();
    expect(NEW_MENU_LAUNCH_ENABLED).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /View Menu/i }));
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it('uses shared delivery policy and does not portray preview checkout as live', () => {
    render(<LanguageProvider><English /><HomeInfoSections /></LanguageProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'English test mode' }));
    expect(document.getElementById('how-it-works')).toBeTruthy();
    expect(document.getElementById('delivery-details')).toBeTruthy();
    expect(screen.getByText('₹30')).toBeTruthy();
    expect(screen.getByText('₹50')).toBeTruthy();
    expect(screen.getByText('No delivery')).toBeTruthy();
    expect(screen.getByText(/checkout is not open/i)).toBeTruthy();
    expect(screen.getByText(new RegExp(String(DELIVERY_POLICY.kitchenLatitude)))).toBeTruthy();
  });
});
