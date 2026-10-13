import atlas from '../assets/images/menu-illustrations.webp';
import pappuImage from '../assets/images/pappu-of-the-day.webp';
import kurmaImage from '../assets/images/mixed-veg-kurma.webp';

// Original AI illustrations, deliberately separate from the authoritative catalog.
const tiles: Record<string, number> = {
  idly: 0, 'ragi-idly': 1, 'plain-pesarattu': 2, 'onion-pesarattu': 3,
  'plain-minapa-dosa': 4, 'onion-minapa-dosa': 5, 'jowar-roti': 6,
  chapathi: 7, pulka: 8, 'guntha-ponganaalu': 9,
};

// Temporary AI-generated reference photos for these two menu cards only.
const temporaryPhotos: Record<string, string> = {
  'pappu-of-the-day': pappuImage,
  'mixed-veg-kurma': kurmaImage,
};

export function FoodArtwork({ itemId, className = '' }: { itemId: string; className?: string }) {
  // Use existing site-owned food photos when available; other items remain illustrations.
  const localPhotos: Record<string, string> = { 'jowar-roti': '/jowar_roti.jpg', chapathi: '/chapathi.jpg' };
  const photo = localPhotos[itemId] ?? temporaryPhotos[itemId];
  if (photo) return <img src={photo} alt="" aria-hidden="true" loading="lazy" decoding="async" className={'object-cover ' + className} />;

  const tile = tiles[itemId];
  if (tile === undefined) return <div aria-hidden="true" className={'flex items-center justify-center bg-amber-50 text-4xl ' + className}>🍲</div>;
  return <div aria-hidden="true" className={'food-artwork ' + className} style={{
    backgroundImage: `url(${atlas})`,
    backgroundSize: '500% 200%',
    backgroundPosition: `${(tile % 5) * 25}% ${Math.floor(tile / 5) * 100}%`,
  }} />;
}
