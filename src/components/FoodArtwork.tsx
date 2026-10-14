// Bright, original vector menu illustrations inspired by the approved artwork direction.
// Illustration only: ingredient/portion facts come from the separate menu catalogue.
// Do not use these illustrations as photographs of the actual prepared food.
// Exact panels from the user-provided 2x2 food illustration image.
// The artwork is a single optimized asset; positioning reveals each panel
// without altering its composition or cutting off its edges.
const EXACT_REFERENCE_PANELS: Record<string, string> = {
  'idly': '0% 0%',
  'onion-minapa-dosa': '100% 0%',
  'onion-pesarattu': '0% 100%',
  'chapathi': '100% 100%',
};
const EXACT_REFERENCE_IMAGE = '/images/mannus-food-illustration-grid.webp';

const MENU_ARTWORK_IDS = [
  'idly', 'ragi-idly', 'plain-pesarattu', 'onion-pesarattu',
  'plain-minapa-dosa', 'onion-minapa-dosa', 'jowar-roti', 'chapathi',
  'pulka', 'guntha-ponganaalu', 'pappu-of-the-day', 'mixed-veg-kurma',
] as const;

type FoodId = (typeof MENU_ARTWORK_IDS)[number];
const isFoodId = (id: string): id is FoodId =>
  (MENU_ARTWORK_IDS as readonly string[]).includes(id);

function LeafPlate() {
  return <>
    <ellipse cx="79" cy="129" rx="63" ry="12" fill="#a96631" opacity=".18" />
    <ellipse cx="80" cy="102" rx="70" ry="48" fill="#a84c28" />
    <ellipse cx="80" cy="97" rx="65" ry="45" fill="#d77b36" />
    <ellipse cx="80" cy="92" rx="59" ry="40" fill="#efb86f" />
    <path d="M20 91Q64 41 140 79Q117 133 44 125Q24 111 20 91Z" fill="#397b36" />
    <path d="M27 89Q73 52 134 79Q102 123 46 118Z" fill="#62a840" />
    <path d="M36 114Q80 97 129 77" stroke="#b4cf62" strokeWidth="2.2" fill="none" opacity=".85" />
    <path d="M52 75L76 102M80 66L92 93M109 70L103 87M55 116L69 98" stroke="#b4cf62" strokeWidth="1.2" opacity=".7" />
  </>;
}

function Chutney({ x = 111, y = 53, orange = false }: { x?:number; y?:number; orange?:boolean }) {
  return <g transform={`translate(${x} ${y})`}>
    <ellipse cy="17" rx="22" ry="6" fill="#754327" opacity=".18" />
    <path d="M-19 1Q-20 24 0 25Q20 24 19 1" fill="#a7502e" />
    <ellipse rx="20" ry="12" fill="#eeaa57" />
    <ellipse rx="16.4" ry="8.5" fill={orange ? '#ee6619' : '#fff4d7'} />
    <path d="M-6 -1Q-1 -5 5 -1Q1 4 -6 -1Z" fill="#3f893d" />
    <circle cx="-9" cy="-2" r="1.6" fill="#252e20" />
    <circle cx="8" cy="2" r="1.7" fill="#252e20" />
    <circle cx="1" cy="-4" r="1.2" fill="#252e20" />
  </g>;
}

function Idlies({ ragi }: {ragi:boolean}) {
  const fill = ragi ? '#a87963' : '#fff8e6';
  const shade = ragi ? '#825a50' : '#eed9bb';
  return <>
    {([[55,82],[79,77],[59,102],[85,104]] as const).map(([x,y],i)=>
      <g key={i}>
        <ellipse cx={x} cy={y+5} rx="23" ry="14" fill={shade} />
        <ellipse cx={x} cy={y} rx="22" ry="13.5" fill={fill} />
        <ellipse cx={x-6} cy={y-4} rx="9" ry="4.5" fill={ragi ? '#d6af92' : '#ffffff'} opacity=".5" />
        {([[x-10,y],[x+7,y+3],[x+1,y-6]] as const).map(([cx,cy],k)=><circle key={k} cx={cx} cy={cy} r="1" fill={shade} opacity=".75"/>)}
      </g>
    )}
  </>;
}

function Dosa({ pesarattu, onion }: {pesarattu:boolean;onion:boolean}) {
  const edge=pesarattu?'#647f28':'#b45f22';
  const base=pesarattu?'#a1bf48':'#eaa43c';
  const top=pesarattu?'#d1d963':'#ffd47a';
  return <>
    <path d="M30 111Q48 59 121 70Q133 79 126 110Q80 137 30 111Z" fill={edge} />
    <path d="M33 107Q58 65 119 73Q127 91 120 105Q80 125 33 107Z" fill={base} />
    <path d="M36 105Q67 78 116 74Q106 97 123 105Q85 110 36 105Z" fill={top}/>
    <path d="M36 105Q74 98 120 105" fill="none" stroke={pesarattu?'#487c2e':'#ac6a2a'} strokeWidth="3" />
    {Array.from({length:12},(_,i)=>{
      const x=54+(i%4)*16,y=88+Math.floor(i/4)*8;
      return <ellipse key={i} cx={x} cy={y} rx="3" ry="1.8" fill={i%2?edge:'#53942c'} opacity=".68" />;
    })}
    {onion && ([[61,91],[74,87],[88,93],[95,83],[109,95],[68,102],[84,102],[103,105]] as const).map(([x,y],i)=>
      <g key={i}><rect x={x-3} y={y-3} width="7" height="5" rx="1" fill="#efcae2"/><path d={`M${x-3} ${y-1}h7`} stroke="#aa6e97" strokeWidth="1"/></g>)}
  </>;
}

function Roti({ kind }: {kind:'jowar-roti'|'chapathi'|'pulka'}) {
  const jowar=kind==='jowar-roti',puffed=kind==='pulka';
  const pieces=kind==='chapathi'?3:kind==='pulka'?3:2;
  return <>
    {Array.from({length:pieces},(_,i)=>{
      const x=70+(i-1)*9, y=88+(i-1)*10;
      return <g key={i}>
        <ellipse cx={x} cy={y+5} rx={puffed?33:40} ry={puffed?22:26} fill={jowar?'#ad6b35':'#b56728'}/>
        <ellipse cx={x} cy={y} rx={puffed?32:39} ry={puffed?22:25} fill={jowar?'#e8c38d':'#f6bd6b'}/>
        <ellipse cx={x-8} cy={y-6} rx="17" ry="8" fill="#ffe6a2" opacity=".5"/>
        {([[x-21,y-5],[x+16,y+4],[x-1,y+12],[x+8,y-12]] as const).map(([px,py],j)=><ellipse key={j} cx={px} cy={py} rx={jowar?3.2:5} ry={jowar?1.7:2.9} fill="#a55b2b" opacity=".85"/>)}
      </g>;
    })}
  </>;
}

function Ponganalu() {
  return <>
    {Array.from({length:12},(_,i)=>{
      const cx=49+(i%4)*19, cy=75+Math.floor(i/4)*18;
      return <g key={i}>
        <ellipse cx={cx} cy={cy+4} rx="10" ry="8" fill="#a45324"/>
        <ellipse cx={cx} cy={cy} rx="10" ry="8" fill="#e49732"/>
        <ellipse cx={cx-3} cy={cy-3} rx="4" ry="2.4" fill="#ffd881"/>
        <circle cx={cx+3} cy={cy+2} r="1.5" fill="#4d8a35" />
      </g>;
    })}
  </>;
}

function Curry({ kurma }: {kurma:boolean}) {
  return <>
    <ellipse cx="81" cy="127" rx="52" ry="10" fill="#85511e" opacity=".19" />
    <path d="M29 76Q28 130 78 137Q132 134 130 76" fill="#af542a"/>
    <path d="M33 89Q36 122 81 130Q125 119 127 89" fill="#d87e35" opacity=".5"/>
    <ellipse cx="79" cy="79" rx="52" ry="31" fill="#f0b66b"/>
    <ellipse cx="79" cy="77" rx="47" ry="27" fill={kurma?'#ebbe5d':'#edaa2b'}/>
    <path d="M43 67Q76 53 110 74" stroke="#fff1af" strokeWidth="5" opacity=".3" fill="none"/>
    {kurma && ([[53,79,'#f6d686'],[69,64,'#eb8640'],[95,70,'#529839'],[102,91,'#ed8542'],[70,90,'#ffdc94'],[85,95,'#79a348']] as const).map(([cx,cy,color],i)=><rect key={i} x={cx-6} y={cy-6} width="12" height="12" rx="3" fill={color}/>)}
    {!kurma && ([[55,75],[99,70],[77,89],[91,95]] as const).map(([cx,cy],i)=><ellipse key={i} cx={cx} cy={cy} rx="8" ry="4" fill="#ffd96c" opacity=".85"/>)}
    <path d="M78 72Q83 58 93 68Q89 79 78 72Z" fill="#3e8b3e"/>
    <path d="M65 89Q71 76 82 84Q78 95 65 89Z" fill="#2d7737"/>
    {([[58,84],[95,88],[71,67],[101,74],[82,102]] as const).map(([x,y],i)=><circle key={i} cx={x} cy={y} r="2.4" fill="#332d20"/>)}
  </>;
}

export function FoodArtwork({itemId,className=''}:{itemId:string;className?:string}) {
  const exactPanel = EXACT_REFERENCE_PANELS[itemId];
  if (exactPanel) return (
    <span aria-hidden="true" className={'food-artwork flex shrink-0 items-center justify-center overflow-hidden bg-[#fff6e6] '+className}>
      <span
        data-exact-artwork={itemId}
        className="block aspect-[3/2] w-full shrink-0 bg-no-repeat"
        style={{ backgroundImage: `url("${EXACT_REFERENCE_IMAGE}")`, backgroundPosition: exactPanel, backgroundSize: '200% 200%' }}
      />
    </span>
  );
  const id = isFoodId(itemId)?itemId:null;
  const isIdly = id === 'idly'||id === 'ragi-idly';
  const pesarattu=id === 'plain-pesarattu'||id === 'onion-pesarattu';
  const dosa=id === 'plain-minapa-dosa'||id === 'onion-minapa-dosa';
  const roti=id === 'jowar-roti'||id === 'chapathi'||id === 'pulka';
  const curry=id === 'pappu-of-the-day'||id === 'mixed-veg-kurma';
  return <span aria-hidden="true" className={'food-artwork flex shrink-0 items-center justify-center overflow-hidden bg-[#fff4dd] '+className}>
    <svg viewBox="0 0 160 160" role="presentation" className="h-full max-h-full w-full" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="160" fill="#fff6e6" />
      <ellipse cx="80" cy="105" rx="75" ry="48" fill="#ffdfaa" opacity=".42" />
      {curry ? <Curry kurma={id==='mixed-veg-kurma'}/> : <LeafPlate/>}
      {isIdly && <><Chutney x={117} y={59}/><Idlies ragi={id==='ragi-idly'}/></>}
      {(pesarattu||dosa) && <><Chutney x={113} y={52} orange={id==='onion-pesarattu'} /><Dosa pesarattu={pesarattu} onion={id==='onion-pesarattu'||id==='onion-minapa-dosa'}/></>}
      {roti && <Roti kind={id as 'jowar-roti'|'chapathi'|'pulka'}/>}
      {id === 'guntha-ponganaalu' && <><Ponganalu/><Chutney x={120} y={58} orange/></>}
      {!id && <><ellipse cx="80" cy="91" rx="32" ry="24" fill="#efbb74"/><path d="M63 89Q76 69 96 85" stroke="#588f43" strokeWidth="5" fill="none"/></>}
    </svg>
  </span>;
}
