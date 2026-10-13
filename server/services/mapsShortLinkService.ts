import { parseGoogleMapsCoordinates, isGoogleMapsShortLink } from '../../src/utils/location.ts';

/**
 * Safely dereference Google's public Maps short links; never fetch user-supplied
 * domains or follow arbitrary redirects. No Maps API key or customer data stored.
 */
const REDIRECT_HOSTS = new Set(['maps.app.goo.gl', 'www.google.com', 'maps.google.com', 'google.com']);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export class MapsShortLinkError extends Error {
  constructor(message: string, public readonly code: 'INVALID_LINK' | 'UNRESOLVED_LINK') {
    super(message);
  }
}

function safeGoogleRedirect(value: string, currentUrl: URL): URL | null {
  try {
    const next = new URL(value, currentUrl);
    if (next.protocol !== 'https:' || next.username || next.password || next.port ||
        !REDIRECT_HOSTS.has(next.hostname)) return null;
    if (next.hostname === 'maps.app.goo.gl') return isGoogleMapsShortLink(next.href) ? next : null;
    // Refuse unrelated Google services and redirect endpoints.
    if (!(next.pathname === '/maps' || next.pathname.startsWith('/maps/'))) return null;
    return next;
  } catch {
    return null;
  }
}

export async function resolveGoogleMapsShortLink(
  link: string,
  fetcher: typeof fetch = fetch,
): Promise<{ latitude: number; longitude: number }> {
  if (!isGoogleMapsShortLink(link)) {
    throw new MapsShortLinkError('Enter a valid Google Maps short share link.', 'INVALID_LINK');
  }
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 6000);
  try {
    let current = new URL(link.trim());
    const visited = new Set<string>();
    for (let hop = 0; hop < 5; hop++) {
      if (visited.has(current.href)) break;
      visited.add(current.href);
      // Never treat Google Maps viewport alone as proof of a saved place pin:
      // require explicit coordinates in q/query/ll or !3d/!4d place data.
      if (current.hostname !== 'maps.app.goo.gl') {
        const position = parseGoogleMapsCoordinates(current.href);
        const explicitPin = current.searchParams.get('q') || current.searchParams.get('query') ||
          current.searchParams.get('ll') || current.pathname.match(/!3d-?\d+(?:\.\d+)?!4d-?\d+(?:\.\d+)?/)?.[0];
        if (position && explicitPin) return position;
      }
      const result = await fetcher(current.href, {
        method: 'GET', redirect: 'manual', signal: timeout.signal,
        headers: { Accept: 'text/html' },
      });
      if (!REDIRECT_STATUSES.has(result.status)) break;
      const location = result.headers.get('location');
      const next = location ? safeGoogleRedirect(location, current) : null;
      if (!next) break;
      current = next;
    }
  } catch {
    // Network failure, provider blockage or timeout must never invent a pin.
  } finally {
    clearTimeout(timer);
  }
  throw new MapsShortLinkError(
    'Could not identify an exact pin from this Google Maps link. Open it in Google Maps and share a full coordinate link, or use GPS.',
    'UNRESOLVED_LINK',
  );
}
