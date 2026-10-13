// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../src/context/LanguageContext.tsx';
import { LiveNewMenuCheckout } from '../src/components/LiveNewMenuCheckout.tsx';
import { googleMapsPinUrl, parseGoogleMapsCoordinates } from '../src/utils/location.ts';
import { MENU_CATALOG } from '../shared/menuCatalog.ts';

const idly = MENU_CATALOG.find(x => x.id === 'idly')!;
const ragi = MENU_CATALOG.find(x => x.id === 'ragi-idly')!;
const lines = [{ item: idly, quantity: 2 }, { item: ragi, quantity: 2 }] as const;
const quoteResponse = { quote: {
  items: [{ itemId: 'idly', itemName: 'Idly', quantity: 2, lineTotalPaisa: 6000 }],
  deliveryDateIst: '2026-10-14', deliveryWindow: '07:00-11:00',
  subtotalPaisa: 14000, deliveryChargePaisa: 3000, totalAmountPaisa: 17000,
  distanceKm: 6,
} };

function startCheckout() {
  render(<LanguageProvider><LiveNewMenuCheckout period="MORNING" lines={lines} te={false}/></LanguageProvider>);
  fireEvent.change(screen.getByPlaceholderText('Your full name'), { target: { value: 'Test Customer' } });
  fireEvent.change(screen.getByPlaceholderText('10-digit mobile number'), { target: { value: '9000000001' } });
  fireEvent.change(screen.getByPlaceholderText('Flat number, building and area'), { target: { value: 'Flat 1, Home Test Apartments, Kollur' } });
}

function choosePin(value: string) {
  fireEvent.change(screen.getByLabelText('Google Maps location link (instead of GPS)'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Use this Maps pin' }));
}

beforeEach(() => {
  vi.stubGlobal('crypto', { randomUUID: () => '0185e823-46c2-4c14-90be-b35ba0000001' });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe('Delivery Location Accuracy V1', () => {
  it('accepts explicit Google Maps coordinates and rejects unsafe/shortened/ambiguous URLs', () => {
    expect(parseGoogleMapsCoordinates('https://maps.google.com/?q=17.444210,78.251478'))
      .toEqual({ latitude: 17.44421, longitude: 78.251478 });
    expect(parseGoogleMapsCoordinates('https://www.google.com/maps/@17.47,78.23,15z'))
      .toEqual({ latitude: 17.47, longitude: 78.23 });
    expect(parseGoogleMapsCoordinates('https://www.google.com/maps/place/Pin/data=!3m1!4b1!3d17.45!4d78.26'))
      .toEqual({ latitude: 17.45, longitude: 78.26 });
    for (const url of [
      'https://maps.app.goo.gl/abc123', 'https://google.com.evil.test/?q=17,78',
      'javascript:alert(1)', 'https://maps.google.com/?q=91,78',
      'https://maps.google.com/?q=Kollur', 'http://maps.google.com/?q=17,78',
    ]) expect(parseGoogleMapsCoordinates(url)).toBeNull();
    expect(googleMapsPinUrl(17.44421, 78.251478)).toBe('https://maps.google.com/?q=17.44421,78.251478');
    expect(() => googleMapsPinUrl(999, 78)).toThrow('Invalid delivery coordinates');
  });

  it('requires an explicit address/pin confirmation and sends the exact selected pin to the pricing server', async () => {
    const posted: any[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('/api/new-menu/quote');
      const payload = JSON.parse(init?.body as string);
      posted.push(payload);
      return { ok: true, json: async () => quoteResponse } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    startCheckout();
    expect((screen.getByRole('button', { name: 'Check delivery and total' }) as HTMLButtonElement).disabled).toBe(true);
    choosePin('https://www.google.com/maps/?q=17.44421,78.251478');
    expect(screen.getByText('Selected from Google Maps')).toBeTruthy();
    const preview = screen.getByRole('link', { name: 'Review delivery pin on Maps ↗' }) as HTMLAnchorElement;
    expect(preview.href).toContain('maps.google.com/?q=17.44421,78.251478');
    expect((screen.getByRole('button', { name: 'Check delivery and total' }) as HTMLButtonElement).disabled).toBe(true);
    const confirmed = screen.getByRole('checkbox', { name: 'Confirm delivery address and map pin' });
    fireEvent.click(confirmed);
    expect((screen.getByRole('button', { name: 'Check delivery and total' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Check delivery and total' }));
    await screen.findByText('Review before payment');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(posted[0].customer.locationLink).toBe('https://maps.google.com/?q=17.44421,78.251478');
    expect(posted[0].customer.latitude).toBe(17.44421);
    expect(posted[0].customer.longitude).toBe(78.251478);
    expect(screen.getByText('₹170')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pay ₹170 with Razorpay/ })).toBeTruthy();
  });

  it('editing the address after quoting invalidates consent and prevents stale payment', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => quoteResponse } as Response));
    vi.stubGlobal('fetch', fetchMock);
    startCheckout();
    choosePin('https://maps.google.com/?q=17.44421,78.251478');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Confirm delivery address and map pin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check delivery and total' }));
    await screen.findByText('Review before payment');
    fireEvent.change(screen.getByPlaceholderText('Flat number, building and area'), { target: { value: 'Flat 2, Changed Address' } });
    expect((screen.getByRole('checkbox', { name: 'Confirm delivery address and map pin' }) as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole('button', { name: /Pay ₹170 with Razorpay/ })).toBeNull();
    expect((screen.getByRole('button', { name: 'Check delivery and total' }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not accept shortened links as a verified delivery location or submit a quote', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    startCheckout();
    choosePin('https://maps.app.goo.gl/abc');
    expect(screen.getByRole('alert').textContent).toContain('Short maps.app.goo.gl links');
    expect(screen.queryByRole('link', { name: 'Review delivery pin on Maps ↗' })).toBeNull();
  });

  it('lets a customer choose home on Maps rather than accidental office GPS', () => {
    const gps = vi.fn((success: (position: any) => void) => success({ coords: { latitude: 17.40, longitude: 78.20 } }));
    Object.defineProperty(window.navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: gps } });
    startCheckout();
    fireEvent.click(screen.getByRole('button', { name: 'Use delivery location' }));
    expect(screen.getByText('Selected using GPS')).toBeTruthy();
    choosePin('https://maps.google.com/?q=17.44421,78.251478');
    expect(screen.getByText('Selected from Google Maps')).toBeTruthy();
    expect(screen.getByText('17.444210, 78.251478')).toBeTruthy();
  });
});
