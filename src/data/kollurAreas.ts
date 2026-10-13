/**
 * Kollur delivery location presets; fee/eligibility always derive from the shared kitchen policy.
 */
import { DELIVERY_POLICY, deliveryTierForDistanceKm } from '../../shared/deliveryPolicy.ts';

export const KOLLUR_CENTER = {
  name: 'కొల్లూరు గ్రామం (Kollur Village, Hyderabad)',
  lat: DELIVERY_POLICY.kitchenLatitude,
  lng: DELIVERY_POLICY.kitchenLongitude,
  freeDeliveryRadiusKm: DELIVERY_POLICY.freeRadiusKm,
  maxServiceRadiusKm: DELIVERY_POLICY.maxRadiusKm,
};

export interface LocalArea {
  nameTe: string;
  nameEn: string;
  distanceKm: number;
  isEligible: boolean;
  deliveryCharge: number;
  lat: number;
  lng: number;
}

export function calculateDeliveryCharge(distanceKm: number): {
  isFree: boolean;
  extraKm: number;
  deliveryCharge: number;
} {
  const tier = deliveryTierForDistanceKm(distanceKm);
  const extraKm = Number.isFinite(distanceKm)
    ? Math.max(0, Math.round((distanceKm - KOLLUR_CENTER.freeDeliveryRadiusKm) * 10) / 10) : 0;
  return {
    isFree: tier.eligible && tier.deliveryChargePaisa === 0,
    extraKm,
    deliveryCharge: tier.deliveryChargePaisa / 100,
  };
}

const PRESET_LOCALITY_DEFINITIONS: Pick<LocalArea, 'nameTe' | 'nameEn' | 'lat' | 'lng'>[] = [
  { nameTe: 'కొల్లూరు కిచెన్ పరిసరాలు', nameEn: 'Kollur Kitchen Area', lat: DELIVERY_POLICY.kitchenLatitude, lng: DELIVERY_POLICY.kitchenLongitude },
  { nameTe: 'కొల్లూరు 2BHK డిగ్నిటీ హౌసింగ్ కాలనీ', nameEn: 'Kollur 2BHK Dignity Colony', lat: 17.4720, lng: 78.2250 },
  { nameTe: 'వెలమల గ్రామం / గేటెడ్ కమ్యూనిటీలు', nameEn: 'Velimela Village', lat: 17.4610, lng: 78.2410 },
  { nameTe: 'ఉస్మాన్ నగర్ రోడ్ & అపార్ట్‌మెంట్లు', nameEn: 'Osman Nagar Area', lat: 17.4670, lng: 78.2610 },
  { nameTe: 'ఎదులానాగులపల్లి రైల్వే గేట్ వైపు', nameEn: 'Edulanagulapally Area', lat: 17.4980, lng: 78.2190 },
  { nameTe: 'తెల్లాపూర్ (కొల్లూరు సరిహద్దు కాలనీలు)', nameEn: 'Tellapur (Kollur Border)', lat: 17.4580, lng: 78.2720 },
  { nameTe: 'కర్దనూర్ పరిసరాలు', nameEn: 'Kardhanur Environs', lat: 17.5100, lng: 78.2450 },
  // Reference locations only; distance, eligibility and charges calculated from actual kitchen.
  { nameTe: 'పటాన్‌చెరు బస్టాండ్ పరిసరాలు', nameEn: 'Patancheru Center', lat: 17.5300, lng: 78.2600 },
  { nameTe: 'గచ్చిబౌలి / ఫైనాన్షియల్ డిస్ట్రిక్ట్', nameEn: 'Gachibowli / Financial District', lat: 17.4399, lng: 78.3378 },
  { nameTe: 'కొండాపూర్ / హైటెక్ సిటీ', nameEn: 'Kondapur / Hitec City', lat: 17.4700, lng: 78.3600 },
];

/** Dynamically derive location estimates after the kitchen origin / charge policy changes. */
export const PRESET_LOCALITIES: LocalArea[] = PRESET_LOCALITY_DEFINITIONS.map(area => {
  const distanceKm = calculateDistanceKm(KOLLUR_CENTER.lat, KOLLUR_CENTER.lng, area.lat, area.lng);
  const tier = deliveryTierForDistanceKm(distanceKm);
  return {
    ...area,
    distanceKm,
    isEligible: tier.eligible,
    deliveryCharge: tier.deliveryChargePaisa / 100,
  };
});

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
 * Check if given latitude and longitude is within service limit and calculate delivery charge
 * (0–5 km free, >5–7 km ₹30, >7–10 km ₹50, over 10 km unavailable)
 */
export function checkKollurDeliveryEligibility(lat?: number, lng?: number, areaDistanceKm?: number): {
  isEligible: boolean;
  distanceKm: number;
  isFreeDelivery: boolean;
  extraKm: number;
  deliveryCharge: number;
  messageTe: string;
  messageEn: string;
} {
  let dist = 1.0;
  if (areaDistanceKm !== undefined) {
    dist = areaDistanceKm;
  } else if (lat !== undefined && lng !== undefined) {
    dist = calculateDistanceKm(KOLLUR_CENTER.lat, KOLLUR_CENTER.lng, lat, lng);
  }

  const { isFree, extraKm, deliveryCharge } = calculateDeliveryCharge(dist);
  const isEligible = deliveryTierForDistanceKm(dist).eligible;

  let messageTe = '';
  let messageEn = '';

  if (!isEligible) {
    messageTe = `క్షమించండి, మీ చిరునామా కొల్లూరు నుండి ${dist} కి.మీ. దూరంలో ఉంది. మా గరిష్ట డెలివరీ పరిధి 10 కి.మీ. మాత్రమే.`;
    messageEn = `Sorry, your location is ${dist} km away. Our maximum delivery service radius is 10 km.`;
  } else if (isFree) {
    messageTe = `ఉచిత డెలివరీ అందుబాటులో ఉంది (కొల్లూరు కేంద్రం నుండి దూరం: ${dist} కి.మీ. — 5 కి.మీ. పరిధి లోపల ఉచితం).`;
    messageEn = `Free delivery available (Distance from Kolluru center: ${dist} km — free within 5 km).`;
  } else {
    messageTe = `కొల్లూరు నుండి దూరం: ${dist} కి.మీ. (5 కి.మీ. పైబడిన దూరం: ${extraKm} కి.మీ.). డెలివరీ ఛార్జీ: ₹${deliveryCharge} (5–7 కి.మీ. ₹30, 7–10 కి.మీ. ₹50).`;
    messageEn = `Distance from Kolluru: ${dist} km (${extraKm} km above 5 km). Delivery charge: ₹${deliveryCharge} (fixed tier: 5–7 km ₹30, 7–10 km ₹50).`;
  }

  return {
    isEligible,
    distanceKm: dist,
    isFreeDelivery: isFree,
    extraKm,
    deliveryCharge,
    messageTe,
    messageEn,
  };
}
