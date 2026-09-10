/**
 * Kollur village geography and 5 km delivery service radius verification
 */

export const KOLLUR_CENTER = {
  name: 'కొల్లూరు గ్రామం (Kollur Village, Hyderabad)',
  lat: 17.4782,
  lng: 78.2323,
  maxDeliveryRadiusKm: 5.0,
};

export interface LocalArea {
  nameTe: string;
  nameEn: string;
  distanceKm: number;
  isEligible: boolean;
  lat: number;
  lng: number;
}

export const PRESET_LOCALITIES: LocalArea[] = [
  { nameTe: 'కొల్లూరు గ్రామం (కేంద్రం)', nameEn: 'Kollur Village Center', distanceKm: 0.5, isEligible: true, lat: 17.4782, lng: 78.2323 },
  { nameTe: 'కొల్లూరు 2BHK డిగ్నిటీ హౌసింగ్ కాలనీ', nameEn: 'Kollur 2BHK Dignity Colony', distanceKm: 1.2, isEligible: true, lat: 17.4720, lng: 78.2250 },
  { nameTe: 'వెలమల గ్రామం / గేటెడ్ కమ్యూనిటీలు', nameEn: 'Velimela Village', distanceKm: 2.8, isEligible: true, lat: 17.4610, lng: 78.2410 },
  { nameTe: 'ఉస్మాన్ నగర్ రోడ్ & అపార్ట్‌మెంట్లు', nameEn: 'Osman Nagar Area', distanceKm: 3.4, isEligible: true, lat: 17.4670, lng: 78.2610 },
  { nameTe: 'ఎదులానాగులపల్లి రైల్వే గేట్ వైపు', nameEn: 'Edulanagulapally Area', distanceKm: 3.8, isEligible: true, lat: 17.4980, lng: 78.2190 },
  { nameTe: 'తెల్లాపూర్ (కొల్లూరు సరిహద్దు కాలనీలు)', nameEn: 'Tellapur (Kollur Border)', distanceKm: 4.3, isEligible: true, lat: 17.4580, lng: 78.2720 },
  { nameTe: 'కర్దనూర్ పరిసరాలు', nameEn: 'Kardhanur Environs', distanceKm: 4.6, isEligible: true, lat: 17.5100, lng: 78.2450 },
  // Examples outside 5km limit
  { nameTe: 'పటాన్‌చెరు బస్టాండ్ పరిసరాలు', nameEn: 'Patancheru Center', distanceKm: 6.8, isEligible: false, lat: 17.5300, lng: 78.2600 },
  { nameTe: 'గచ్చిబౌలి / ఫైనాన్షియల్ డిస్ట్రిక్ట్', nameEn: 'Gachibowli / Financial District', distanceKm: 15.5, isEligible: false, lat: 17.4399, lng: 78.3378 },
  { nameTe: 'కొండాపూర్ / హైటెక్ సిటీ', nameEn: 'Kondapur / Hitec City', distanceKm: 18.0, isEligible: false, lat: 17.4700, lng: 78.3600 },
];

/**
 * Calculates straight line distance (Haversine formula) in kilometers
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

/**
 * Check if given latitude and longitude is within 5 km of Kollur village
 */
export function checkKollurDeliveryEligibility(lat?: number, lng?: number, areaDistanceKm?: number): {
  isEligible: boolean;
  distanceKm: number;
  messageTe: string;
} {
  let dist = 1.0;
  if (areaDistanceKm !== undefined) {
    dist = areaDistanceKm;
  } else if (lat !== undefined && lng !== undefined) {
    dist = calculateDistanceKm(KOLLUR_CENTER.lat, KOLLUR_CENTER.lng, lat, lng);
  }

  const isEligible = dist <= KOLLUR_CENTER.maxDeliveryRadiusKm;
  const messageTe = isEligible
    ? `ఉచిత డెలివరీ అందుబాటులో ఉంది (కొల్లూరు కేంద్రం నుండి దూరం: ${dist} కి.మీ., 5 కి.మీ. పరిధి లోపలే).`
    : `క్షమించండి, మీ చిరునామా కొల్లూరు నుండి ${dist} కి.మీ. దూరంలో ఉంది. ఉచిత డెలివరీ కొల్లూరు గ్రామం నుండి 5 కి.మీ. పరిధి వరకే పరిమితం.`;

  return {
    isEligible,
    distanceKm: dist,
    messageTe,
  };
}
