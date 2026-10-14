// Menu illustrations, not real kitchen photographs or portion commitments.
// Reference: exactly the four image panels approved by the owner.
// Remaining eight: matching bright illustrations in a local optimized 4x2 sprite.
const EXACT_REFERENCE_IMAGE = '/images/mannus-food-illustration-grid.webp';
const ADDITIONAL_IMAGE = '/images/mannus-eight-additional-illustrations.webp';
const EXACT_REFERENCE_PANELS: Record<string,string> = {
  'idly': '0% 0%',
  'onion-minapa-dosa': '100% 0%',
  'onion-pesarattu': '0% 100%',
  'chapathi': '100% 100%',
};
const ADDITIONAL_PANELS: Record<string,string> = {
  'ragi-idly': '0% 0%',
  'plain-pesarattu': '33.333% 0%',
  'plain-minapa-dosa': '66.667% 0%',
  'jowar-roti': '100% 0%',
  'pulka': '0% 100%',
  'guntha-ponganaalu': '33.333% 100%',
  'pappu-of-the-day': '66.667% 100%',
  'mixed-veg-kurma': '100% 100%',
};

export function FoodArtwork({ itemId, className = '' }:{itemId:string;className?:string}) {
  const exactPanel = EXACT_REFERENCE_PANELS[itemId];
  const additionalPanel = ADDITIONAL_PANELS[itemId];
  const backgroundImage = exactPanel ? EXACT_REFERENCE_IMAGE : additionalPanel ? ADDITIONAL_IMAGE : null;
  const position = exactPanel ?? additionalPanel;
  return (
    <span aria-hidden="true" className={'food-artwork flex shrink-0 items-center justify-center overflow-hidden bg-[#fff6e6] ' + className}>
      {backgroundImage ? (
        <span
          data-exact-artwork={itemId}
          className="block aspect-[3/2] w-full shrink-0 bg-no-repeat"
          style={{
            backgroundImage: `url("${backgroundImage}")`,
            backgroundPosition: position,
            backgroundSize: exactPanel ? '200% 200%' : '400% 200%',
          }}
        />
      ) : (
        <svg role="presentation" viewBox="0 0 160 160" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <rect width="160" height="160" fill="#fff6e6"/>
          <ellipse cx="80" cy="86" rx="48" ry="30" fill="#e5b778" />
          <path d="M52 90q26-28 54 0" stroke="#658945" strokeWidth="7" fill="none" strokeLinecap="round"/>
        </svg>
      )}
    </span>
  );
}
