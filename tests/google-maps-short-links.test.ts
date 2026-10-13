import { describe, expect, it, vi } from 'vitest';
import { isGoogleMapsShortLink, parseGoogleMapsCoordinates } from '../src/utils/location.ts';
import { resolveGoogleMapsShortLink, MapsShortLinkError } from '../server/services/mapsShortLinkService.ts';

const shortUrl = 'https://maps.app.goo.gl/YYcjfZD3haTFZhdn8';
const respondRedirect = (location: string, status = 302) => new Response(null, {
  status, headers: { location },
});

describe('Safe short Google Maps link resolution', () => {
  it('strictly accepts valid Google Maps share URL shapes only', () => {
    expect(isGoogleMapsShortLink(shortUrl)).toBe(true);
    for (const link of [
      'https://maps.app.goo.gl/abc', 'http://maps.app.goo.gl/ValidToken123',
      'https://maps.app.goo.gl:444/ValidToken123',
      'https://maps.app.goo.gl.evil.test/ValidToken123',
      'https://evil.test/ValidToken123',
      'https://maps.app.goo.gl/ValidToken123?redirect=http://localhost',
      'https://user@maps.app.goo.gl/ValidToken123',
    ]) expect(isGoogleMapsShortLink(link)).toBe(false);
  });

  it('extracts exact pinned coordinates from a Google Maps place redirect', async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) => respondRedirect('https://www.google.com/maps/place/Test+Home/@17.44,78.25,14z/data=!3d17.444210!4d78.251478'));
    const pin = await resolveGoogleMapsShortLink(shortUrl, fetcher as unknown as typeof fetch);
    expect(pin).toEqual({ latitude: 17.44421, longitude: 78.251478 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(shortUrl);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', redirect: 'manual' });
  });

  it('follows allowed Google Maps redirects only with a bounded hop count', async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.includes('maps.app.goo.gl') ?
        respondRedirect('https://www.google.com/maps/place/MyPin') :
        respondRedirect('https://maps.google.com/maps?q=17.45,78.26'));
    expect(await resolveGoogleMapsShortLink(shortUrl, fetcher as unknown as typeof fetch))
      .toEqual({ latitude: 17.45, longitude: 78.26 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects arbitrary redirect destinations (SSRF protection) without contacting them', async () => {
    for (const destination of [
      'http://127.0.0.1:3000/admin',
      'https://evil.test/maps?query=17.5,78.2',
      'https://google.com.evil.test/maps?q=17,78',
      'https://user@www.google.com/maps?q=17,78',
      'https://www.google.com/url?q=https://evil.test/',
    ]) {
      const fetcher = vi.fn(async () => respondRedirect(destination));
      await expect(resolveGoogleMapsShortLink(shortUrl, fetcher as unknown as typeof fetch))
        .rejects.toBeInstanceOf(MapsShortLinkError);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it('never treats a map viewport without a verified place pin as exact delivery location', async () => {
    const fetcher = vi.fn(async () =>
      respondRedirect('https://www.google.com/maps/place/Some+Place/@17.47,78.22,16z'));
    await expect(resolveGoogleMapsShortLink(shortUrl, fetcher as unknown as typeof fetch))
      .rejects.toMatchObject({ code: 'UNRESOLVED_LINK' });
  });

  it('fails closed for unrecognized Google share link, broken URL, and provider errors', async () => {
    await expect(resolveGoogleMapsShortLink('https://attacker.test/xx'))
      .rejects.toMatchObject({ code: 'INVALID_LINK' });
    const invalidPin = vi.fn(async () => respondRedirect('https://www.google.com/maps?q=wrong'));
    await expect(resolveGoogleMapsShortLink(shortUrl, invalidPin as unknown as typeof fetch))
      .rejects.toMatchObject({ code: 'UNRESOLVED_LINK' });
    const blocked = vi.fn(async () => new Response('blocked', { status: 403 }));
    await expect(resolveGoogleMapsShortLink(shortUrl, blocked as unknown as typeof fetch))
      .rejects.toMatchObject({ code: 'UNRESOLVED_LINK' });
    const unsupported = vi.fn(async () => { throw new Error('Provider unavailable'); });
    await expect(resolveGoogleMapsShortLink(shortUrl, unsupported as unknown as typeof fetch))
      .rejects.toMatchObject({ code: 'UNRESOLVED_LINK' });
  });

  it('canonical pin link may be parsed for checkout and is not the original short URL', () => {
    expect(parseGoogleMapsCoordinates('https://maps.google.com/?q=17.44421,78.251478'))
      .toEqual({ latitude: 17.44421, longitude: 78.251478 });
    expect(parseGoogleMapsCoordinates(shortUrl)).toBeNull();
  });
});
