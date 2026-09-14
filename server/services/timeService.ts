import { BUSINESS_CONFIG } from '../config/business.ts';

export interface OrderingStatus {
  isOpen: boolean;
  currentIstTime: string;
  currentIstHour: number;
  openHour: number;
  closeHour: number;
  deliveryDate: string; // YYYY-MM-DD
  deliveryDateFormattedTe: string;
  deliveryDateFormattedEn: string;
  deliveryWindowTe: string;
  deliveryWindowEn: string;
  nextOrderingWindowIst: string;
  nextOrderingWindowTe: string;
  nextOrderingWindowEn: string;
}

export function getNowInIst(): Date {
  const now = new Date();
  // IST is UTC + 5 hours 30 mins
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  return new Date(now.getTime() + istOffsetMs);
}

export function formatIstDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getOrderingStatus(overrideDate?: Date): OrderingStatus {
  const istDate = overrideDate ? overrideDate : getNowInIst();
  const currentHour = istDate.getUTCHours();
  const currentMinute = istDate.getUTCMinutes();
  const hourFraction = currentHour + currentMinute / 60;

  const openHour = BUSINESS_CONFIG.ordering.openHour; // 11
  const closeHour = BUSINESS_CONFIG.ordering.closeHour; // 16

  // In dev/test mode ONLY, allow query/header/env override if explicitly configured
  const devAllowAlwaysOpen = process.env.NODE_ENV !== 'production' && process.env.DEV_ALWAYS_OPEN_ORDERING === 'true';

  const isOpen = devAllowAlwaysOpen || (hourFraction >= openHour && hourFraction < closeHour);

  // Delivery date is today if ordering before cutoff, or next day if after cutoff
  const deliveryDateObj = new Date(istDate.getTime());
  if (hourFraction >= closeHour) {
    deliveryDateObj.setUTCDate(deliveryDateObj.getUTCDate() + 1);
  }

  const deliveryDate = formatIstDate(deliveryDateObj);

  const monthsTe = [
    'జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్',
    'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'
  ];
  const monthsEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dDay = deliveryDateObj.getUTCDate();
  const dMonth = deliveryDateObj.getUTCMonth();
  const dYear = deliveryDateObj.getUTCFullYear();

  const deliveryDateFormattedTe = `${dDay} ${monthsTe[dMonth]} ${dYear}`;
  const deliveryDateFormattedEn = `${dDay} ${monthsEn[dMonth]} ${dYear}`;

  let nextWindowIst = '';
  let nextWindowTe = '';
  let nextWindowEn = '';

  if (isOpen) {
    nextWindowIst = `ఈ రోజు సాయంత్రం ${closeHour}:00 (4:00 PM) వరకు తెరిచి ఉంటుంది`;
    nextWindowTe = `ఈ రోజు సాయంత్రం 4:00 గంటల వరకు ఆర్డర్లు స్వీకరించబడతాయి`;
    nextWindowEn = `Open until 4:00 PM today`;
  } else if (hourFraction < openHour) {
    nextWindowIst = `ఈ రోజు ఉదయం 11:00 AM నుండి`;
    nextWindowTe = `ఈ రోజు ఉదయం 11:00 గంటలకు ఆర్డరింగ్ ప్రారంభమవుతుంది`;
    nextWindowEn = `Opens today at 11:00 AM IST`;
  } else {
    nextWindowIst = `రేపు ఉదయం 11:00 AM నుండి`;
    nextWindowTe = `రేపు ఉదయం 11:00 గంటలకు ఆర్డరింగ్ ప్రారంభమవుతుంది`;
    nextWindowEn = `Opens tomorrow at 11:00 AM IST`;
  }

  const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')} IST`;

  return {
    isOpen,
    currentIstTime: timeStr,
    currentIstHour: currentHour,
    openHour,
    closeHour,
    deliveryDate,
    deliveryDateFormattedTe,
    deliveryDateFormattedEn,
    deliveryWindowTe: BUSINESS_CONFIG.deliveryWindow.displayLabelTe,
    deliveryWindowEn: BUSINESS_CONFIG.deliveryWindow.displayLabelEn,
    nextOrderingWindowIst: nextWindowIst,
    nextOrderingWindowTe: nextWindowTe,
    nextOrderingWindowEn: nextWindowEn,
  };
}
