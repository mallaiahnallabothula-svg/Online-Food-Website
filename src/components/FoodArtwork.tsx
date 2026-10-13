import atlas from '../assets/images/menu-illustrations.webp';

// Ten approved editorial illustrations, kept separate from menu/pricing logic.
const tiles: Record<string, number> = {
  idly: 0, 'ragi-idly': 1, 'plain-pesarattu': 2, 'onion-pesarattu': 3,
  'plain-minapa-dosa': 4, 'onion-minapa-dosa': 5, 'jowar-roti': 6,
  chapathi: 7, pulka: 8, 'guntha-ponganaalu': 9,
};

export function FoodArtwork({ itemId, className = '' }: { itemId: string; className?: string }) {
  // Illustrative bowls for the two curries: avoid mixing food photos with the
  // small editorial drawings used by the rest of the menu.
  if (itemId === 'pappu-of-the-day' || itemId === 'mixed-veg-kurma') {
    const pappu = itemId === 'pappu-of-the-day';
    return (
      <span aria-hidden="true" className={'flex shrink-0 items-center justify-center overflow-hidden bg-[#e9dfc8] ' + className}>
        <svg viewBox="0 0 80 80" role="presentation" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <rect width="80" height="80" fill={pappu ? '#e8d7b8' : '#dccab0'} />
          <ellipse cx="40" cy="61" rx="28" ry="7" fill="#b19a7c" opacity=".55" />
          <ellipse cx="40" cy="49" rx="27" ry="13" fill="#f3ecdf" />
          <path d="M15 47 Q17 64 40 66 Q63 64 65 47" fill="#ae785f" />
          <ellipse cx="40" cy="47" rx="24" ry="10" fill={pappu ? '#d5a44d' : '#b47c51'} />
          {pappu
            ? <><path d="M25 46 Q34 38 42 45 T57 44" stroke="#f4cf7d" strokeWidth="3" fill="none" strokeLinecap="round" /><circle cx="30" cy="45" r="2" fill="#6e8a53" /><circle cx="49" cy="48" r="2" fill="#6e8a53" /></>
            : <><circle cx="30" cy="45" r="5" fill="#d5b38c"/><circle cx="45" cy="48" r="5" fill="#dec1a0"/><circle cx="53" cy="43" r="4" fill="#b7b27b"/><circle cx="39" cy="44" r="3" fill="#6f8753"/></>}
          <path d="M33 27 Q28 22 34 16 M46 29 Q41 23 47 17" stroke="#f9f3e9" strokeWidth="2" strokeLinecap="round" opacity=".65" fill="none" />
        </svg>
      </span>
    );
  }
  const tile = tiles[itemId];
  if (tile === undefined) return <div aria-hidden="true" className={'flex items-center justify-center bg-amber-50 text-4xl ' + className}>🍲</div>;
  return <div aria-hidden="true" className={'food-artwork shrink-0 ' + className} style={{
    backgroundImage: `url(${atlas})`,
    backgroundSize: '500% 200%',
    backgroundPosition: `${(tile % 5) * 25}% ${Math.floor(tile / 5) * 100}%`,
  }} />;
}
