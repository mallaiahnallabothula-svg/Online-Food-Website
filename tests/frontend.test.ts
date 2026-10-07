import { afterEach, describe, expect, it, vi } from 'vitest';
import { getInitialOrderingStatus, getISTTime, normalizeOrderingStatus } from '../src/utils/time';
import { parseGoogleMapsCoordinates } from '../src/utils/location';

afterEach(() => vi.useRealTimers());

describe('Customer ordering status', () => {
  it('keeps checkout closed until the API is available, even during business hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T06:30:00Z'));
    expect(getISTTime().isOpen).toBe(true);
    expect(getInitialOrderingStatus()).toMatchObject({ isOpen: false, apiAvailable: false });
  });

  it('advances tomorrow delivery across a year boundary and handles IST midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-31T10:30:00Z'));
    expect(getISTTime().isOpen).toBe(false);
    expect(getInitialOrderingStatus()).toMatchObject({ deliveryDate: '2027-01-01', currentDateISTEn: '1 January 2027' });
    vi.setSystemTime(new Date('2026-12-31T18:30:00Z'));
    expect(getISTTime().hours).toBe(0);
    expect(getInitialOrderingStatus().deliveryDate).toBe('2027-01-01');
  });

  it('maps the actual server contract to the customer time, date and message fields', () => {
    expect(normalizeOrderingStatus({
      isOpen: false,
      currentIstTime: '17:00 IST', currentIstHour: 17,
      deliveryDate: '2026-10-08', deliveryDateFormattedTe: '8 అక్టోబర్ 2026', deliveryDateFormattedEn: '8 October 2026',
      nextOrderingWindowEn: 'Opens tomorrow at 11:00 AM IST', nextOrderingWindowTe: 'రేపు ఉదయం 11:00 గంటలకు',
      deliveryWindowTe: 'సాయంత్రం 6:00 – 8:00', deliveryWindowEn: 'Evening 6:00 PM – 8:00 PM',
    })).toMatchObject({
      isOpen: false, apiAvailable: true, currentTimeIST: '17:00 IST', currentHourIST: 17,
      currentDateISTEn: '8 October 2026', nextOpenMessageEn: 'Opens tomorrow at 11:00 AM IST', deliveryWindow: 'సాయంత్రం 6:00 – 8:00',
    });
  });
});

describe('Manual delivery location', () => {
  it('extracts coordinates from supported Google Maps links', () => {
    expect(parseGoogleMapsCoordinates('https://maps.google.com/?q=17.4782,78.2323')).toEqual({ latitude: 17.4782, longitude: 78.2323 });
    expect(parseGoogleMapsCoordinates('https://www.google.com/maps/@17.47,78.23,15z')).toEqual({ latitude: 17.47, longitude: 78.23 });
  });

  it('rejects links that cannot establish the delivery coordinates', () => {
    for (const link of ['https://maps.app.goo.gl/abc', 'https://google.com.evil.test/?q=17,78', 'javascript:alert(1)', 'https://maps.google.com/?q=91,78', 'https://maps.google.com/?q=Kollur']) {
      expect(parseGoogleMapsCoordinates(link)).toBeNull();
    }
  });
});
