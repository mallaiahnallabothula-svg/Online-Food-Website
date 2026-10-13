// Compact, deliberately illustrative SVG food drawings (not food photographs).
// All twelve dishes share the same beige/plate visual style.
const morningIdlies = [
  [30, 45], [44, 43], [28, 52], [47, 51],
] as const;

function DishOnPlate({ itemId }: { itemId: string }) {
  const ragi = itemId === 'ragi-idly';
  const onion = itemId === 'onion-pesarattu' || itemId === 'onion-minapa-dosa';
  const pesarattu = itemId === 'plain-pesarattu' || itemId === 'onion-pesarattu';
  const dosa = itemId === 'plain-minapa-dosa' || itemId === 'onion-minapa-dosa';
  const jowar = itemId === 'jowar-roti';
  const chapathi = itemId === 'chapathi';
  const pulka = itemId === 'pulka';
  const ponganaalu = itemId === 'guntha-ponganaalu';
  const idly = itemId === 'idly' || ragi;
  if (!idly && !pesarattu && !dosa && !jowar && !chapathi && !pulka && !ponganaalu) return null;

  return (
    <svg viewBox="0 0 80 80" role="presentation" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="80" height="80" fill={ragi ? '#ddc6ab' : pesarattu ? '#ddd0b4' : dosa ? '#e5d4b5' : '#e8d9bf'} />
      <ellipse cx="40" cy="62" rx="29" ry="7" fill="#a99378" opacity=".42" />
      <ellipse cx="40" cy="50" rx="28" ry="14" fill="#c7b89d" />
      <ellipse cx="40" cy="47" rx="27" ry="13" fill="#f5eddd" />
      <ellipse cx="40" cy="47" rx="23" ry="10" fill="#eee4d1" />

      {idly && morningIdlies.map(([cx, cy], index) => (
        <g key={index}>
          <ellipse cx={cx} cy={cy + 3} rx="11" ry="6.5" fill={ragi ? '#8d6d58' : '#d8cfc0'} />
          <ellipse cx={cx} cy={cy} rx="10" ry="6.5" fill={ragi ? '#95715b' : '#fbf7e9'} />
          <ellipse cx={cx - 3} cy={cy - 1.5} rx="3.5" ry="1.6" fill={ragi ? '#b18a71' : '#ffffff'} opacity=".6" />
        </g>
      ))}

      {(pesarattu || dosa) && (
        <>
          <path d="M17 51 Q34 29 58 33 Q66 42 63 52 Q42 64 17 51 Z" fill={pesarattu ? '#6b8755' : '#c78e4a'} />
          <path d="M20 49 Q35 34 58 35 Q54 46 62 51 Q39 55 20 49 Z" fill={pesarattu ? '#9eae76' : '#e6b56e'} />
          <path d="M26 48 Q39 44 51 47" stroke={pesarattu ? '#b7c696' : '#f1d09a'} strokeWidth="2" fill="none" strokeLinecap="round" />
          {onion && (
            <>
              <circle cx="39" cy="45" r="3" stroke="#ad7977" strokeWidth="1.5" fill="none" />
              <circle cx="51" cy="46" r="2.5" stroke="#a36c78" strokeWidth="1.4" fill="none" />
              <circle cx="45" cy="50" r="2" fill="#b67e82" />
              <circle cx="33" cy="49" r="1.5" fill="#dfc2ab" />
            </>
          )}
        </>
      )}

      {(jowar || chapathi) && (
        <>
          <path d="M17 48 Q18 33 34 30 Q54 26 64 43 Q67 58 50 59 Q29 65 17 48 Z" fill={jowar ? '#bb966f' : '#cb965d'} />
          <path d="M20 47 Q22 35 36 33 Q55 31 61 44 Q59 56 47 56 Q31 60 20 47 Z" fill={jowar ? '#d7b58a' : '#e8ba7b'} />
          <path d="M26 42 Q39 35 49 41" fill="none" stroke={jowar ? '#e9cca6' : '#f4d7a7'} strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="34" cy="48" rx="3.5" ry="1.7" fill={jowar ? '#ba9673' : '#b77d48'} opacity=".8" />
          <ellipse cx="49" cy="46" rx="4" ry="2" fill={jowar ? '#c2a17c' : '#ad7642'} opacity=".75" />
          <ellipse cx="43" cy="53" rx="2.8" ry="1.7" fill={jowar ? '#b89574' : '#b77d48'} opacity=".7" />
        </>
      )}

      {pulka && (
        <>
          {[[30,40],[43,39],[51,48],[28,51],[41,52]].map(([cx,cy], index) => (
            <g key={index}>
              <ellipse cx={cx} cy={cy+1} rx="10" ry="6" fill="#b98b61" />
              <ellipse cx={cx} cy={cy} rx="10" ry="5.5" fill="#eacb91" />
              <ellipse cx={cx-2} cy={cy-1} rx="2" ry="1" fill="#b88b60" opacity=".8" />
            </g>
          ))}
        </>
      )}

      {ponganaalu && (
        <>
          {Array.from({length:12},(_,index)=>{
            const row=Math.floor(index/4), col=index%4;
            const cx=26+col*9, cy=38+row*8;
            return (
              <g key={index}>
                <ellipse cx={cx} cy={cy+2} rx="5.2" ry="4.3" fill="#a76d44" />
                <ellipse cx={cx} cy={cy} rx="4.7" ry="4.2" fill="#dca46a" />
                <circle cx={cx-1} cy={cy-1} r="1.2" fill="#f1ca92" />
              </g>
            );
          })}
        </>
      )}

      <path d="M32 26 Q27 21 33 15 M46 27 Q41 21 47 15" stroke="#faf3e6" strokeWidth="2" strokeLinecap="round" opacity=".72" fill="none" />
    </svg>
  );
}

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
  return (
    <span aria-hidden="true" className={'food-artwork flex shrink-0 items-center justify-center overflow-hidden bg-[#e9dfc8] ' + className}>
      <DishOnPlate itemId={itemId} />
    </span>
  );
}
