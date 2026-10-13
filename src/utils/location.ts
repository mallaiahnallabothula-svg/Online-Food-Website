/** Parse a Google Maps link with explicit coordinates, never an arbitrary URL or place name. */
export function parseGoogleMapsCoordinates(link: string): { latitude: number; longitude: number } | null {
  try {
    const url = new URL(link.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !(host === 'google.com' || host.endsWith('.google.com'))) return null;

    // q/query/ll and Google Maps place IDs may contain coordinates. A short
    // maps.app.goo.gl redirect cannot be resolved without a network service.
    const location = url.searchParams.get('q') || url.searchParams.get('query') || url.searchParams.get('ll');
    const match = location?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)
      || url.pathname.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
      || url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (!match) return null;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    return Number.isFinite(latitude) && Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
      ? { latitude, longitude } : null;
  } catch {
    return null;
  }
}

/** The owner's saved link always points to the same pin used to calculate the fee. */
export function googleMapsPinUrl(latitude: number, longitude: number): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('Invalid delivery coordinates');
  }
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}
