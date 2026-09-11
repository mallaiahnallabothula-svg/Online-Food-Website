import freshRotisImg from '../assets/images/fresh_jowar_rotis_1789125771309.jpg';
import tawaMakingImg from '../assets/images/jowar_roti_making_1789125790824.jpg';
import karivepakuKaramImg from '../assets/images/karivepaku_karam_podi_1789125808536.jpg';
import aviseKaramImg from '../assets/images/avise_ginjala_karam_1789125831933.jpg';
import brandLogoImg from '../assets/images/mallikarjuna_rottelu_logo_1789103187340.jpg';

export interface OriginalPhoto {
  id: string;
  titleTe: string;
  titleEn: string;
  descriptionTe: string;
  descriptionEn: string;
  src: string;
  filename: string;
  category: 'rotis' | 'making' | 'karam' | 'brand';
  tag: string;
  resolution: string;
}

export const ORIGINAL_PHOTOS: OriginalPhoto[] = [
  {
    id: 'fresh-jowar-rotis',
    titleTe: 'తాజా పల్లె జొన్న రొట్టెల కట్ట',
    titleEn: 'Fresh Rustic Jowar Rotis Stack',
    descriptionTe: 'సంప్రదాయ కంచు పెనంపై కాల్చి, అరటి ఆకుపై పేర్చిన వేడివేడి, మెత్తని జొన్న రొట్టెలు.',
    descriptionEn: 'Authentic handmade soft sorghum flatbreads stacked fresh on banana leaf.',
    src: freshRotisImg,
    filename: 'mallikarjuna_fresh_jowar_rotis.jpg',
    category: 'rotis',
    tag: 'తాజా రొట్టెలు',
    resolution: '1024x1024 HD',
  },
  {
    id: 'roti-woodfire-making',
    titleTe: 'కట్టెల పొయ్యి & సంప్రదాయ పెనం తయారీ',
    titleEn: 'Traditional Woodfire Iron Tawa Baking',
    descriptionTe: 'పల్లెటూరి పద్ధతిలో చేత్తో తట్టి, కట్టెల పొయ్యి మంటపై ఇనుప పెనం మీద కాల్చే దృశ్యం.',
    descriptionEn: 'Artisan hand-patting and open woodfire hearth cooking on seasoned iron pan.',
    src: tawaMakingImg,
    filename: 'mallikarjuna_woodfire_tawa_making.jpg',
    category: 'making',
    tag: 'వంటశాల తయారీ',
    resolution: '1024x1024 HD',
  },
  {
    id: 'karivepaku-karam',
    titleTe: 'స్వచ్ఛమైన తాజా కరివేపాకు కారం పొడి',
    titleEn: 'Authentic Karivepaku Karam Podi',
    descriptionTe: 'రైతు తోటల నుండి తెచ్చిన తాజా కరివేపాకు, ఎండుమిర్చి, వెల్లుల్లితో దంచిన సుగంధ కారం.',
    descriptionEn: 'Stone-pounded authentic aromatic curry leaf chutney powder with garlic & spices.',
    src: karivepakuKaramImg,
    filename: 'mallikarjuna_karivepaku_karam_podi.jpg',
    category: 'karam',
    tag: 'ఉచిత కారం 1',
    resolution: '1024x1024 HD',
  },
  {
    id: 'avise-ginjala-karam',
    titleTe: 'బలవర్ధకమైన అవిసె గింజల కారం పొడి',
    titleEn: 'Roasted Flaxseed (Avise Ginjalu) Karam Podi',
    descriptionTe: 'వేయించిన అవిసె గింజలు, సంప్రదాయ సుగంధ ద్రవ్యాలతో ఆరోగ్యం మరియు అద్భుత రుచినిచ్చే కారం.',
    descriptionEn: 'Nutritious toasted flaxseed spicy podi made with rustic village spices.',
    src: aviseKaramImg,
    filename: 'mallikarjuna_avise_ginjala_karam.jpg',
    category: 'karam',
    tag: 'ఉచిత కారం 2',
    resolution: '1024x1024 HD',
  },
  {
    id: 'official-brand-logo',
    titleTe: 'శ్రీ మల్లికార్జున పల్లె జొన్న రొట్టెల అధికారిక చిహ్నం',
    titleEn: 'Official Brand Emblem & Logo',
    descriptionTe: 'కొల్లూరు గ్రామం యొక్క అధికారిక గ్రామీణ సంప్రదాయ జొన్న రొట్టెల బ్రాండ్ లోగో.',
    descriptionEn: 'Official identity crest of Sri Mallikarjuna Palle Jonna Rottelu, Kollur.',
    src: brandLogoImg,
    filename: 'mallikarjuna_rottelu_official_logo.jpg',
    category: 'brand',
    tag: 'అధికారిక లోగో',
    resolution: '1024x1024 HD',
  },
];
