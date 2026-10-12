import atlas from '../assets/images/menu-illustrations.webp';

// Original AI illustrations, deliberately separate from the authoritative catalog.
const tiles: Record<string, number> = {
  idly: 0, 'ragi-idly': 1, 'plain-pesarattu': 2, 'onion-pesarattu': 3,
  'plain-minapa-dosa': 4, 'onion-minapa-dosa': 5, 'jowar-roti': 6,
  chapathi: 7, pulka: 8, 'guntha-ponganaalu': 9,
};

export function FoodArtwork({ itemId, className = '' }: { itemId: string; className?: string }) {
  const tile = tiles[itemId] ?? 0;
  return <div aria-hidden="true" className={'food-artwork ' + className} style={{
    backgroundImage: `url(${atlas})`,
    backgroundSize: '500% 200%',
    backgroundPosition: `${(tile % 5) * 25}% ${Math.floor(tile / 5) * 100}%`,
  }} />;
}
