export function parseGoogleMapsCoordinates(link: string): { latitude: number; longitude: number } | null {
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !(host === 'google.com' || host.endsWith('.google.com'))) return null;
    const location = url.searchParams.get('q') || url.searchParams.get('query') || url.searchParams.get('ll');
    const match = location?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)
      || url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (!match) return null;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
  } catch {
    return null;
  }
}
