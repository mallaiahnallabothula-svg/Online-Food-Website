import type { OrderingHoursStatus } from '../types';

export interface ISTTimeInfo {
  year: number;
  month: number;
  date: number;
  hours: number;
  minutes: number;
  seconds: number;
  formattedTime: string;
  formattedDateTelugu: string;
  formattedDateEnglish: string;
  isOpen: boolean;
  nextOpenMessage: string;
  nextOpenMessageEn: string;
}

const IST_OFFSET_MS = 330 * 60 * 1000;
const TELUGU_MONTHS = ['జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్', 'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'];
const ENGLISH_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');

function formatDate(date: Date, months: string[]) {
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function getISTTime(mockOffsetMinutes = 0): ISTTimeInfo {
  const ist = new Date(Date.now() + IST_OFFSET_MS + mockOffsetMinutes * 60 * 1000);
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  const isOpen = hours >= 11 && hours < 16;
  return {
    year: ist.getUTCFullYear(), month: ist.getUTCMonth(), date: ist.getUTCDate(),
    hours, minutes, seconds: ist.getUTCSeconds(),
    formattedTime: `${pad(hours % 12 || 12)}:${pad(minutes)} ${hours >= 12 ? 'PM' : 'AM'} IST`,
    formattedDateTelugu: formatDate(ist, TELUGU_MONTHS),
    formattedDateEnglish: formatDate(ist, ENGLISH_MONTHS),
    isOpen,
    nextOpenMessage: isOpen ? 'ఈ రోజు సాయంత్రం 4:00 గంటల వరకు ఆర్డర్లు స్వీకరించబడతాయి' : hours < 11 ? 'ఈ రోజు ఉదయం 11:00 గంటలకు ఆర్డరింగ్ ప్రారంభమవుతుంది' : 'రేపు ఉదయం 11:00 గంటలకు ఆర్డరింగ్ ప్రారంభమవుతుంది',
    nextOpenMessageEn: isOpen ? 'Open until 4:00 PM today' : hours < 11 ? 'Opens today at 11:00 AM IST' : 'Opens tomorrow at 11:00 AM IST',
  };
}

// Local time supplies useful labels while the API is connecting; it never authorizes checkout.
export function getInitialOrderingStatus(): OrderingHoursStatus {
  const ist = getISTTime();
  const delivery = new Date(Date.UTC(ist.year, ist.month, ist.date + (ist.hours >= 16 ? 1 : 0)));
  const date = `${delivery.getUTCFullYear()}-${pad(delivery.getUTCMonth() + 1)}-${pad(delivery.getUTCDate())}`;
  const dateTe = formatDate(delivery, TELUGU_MONTHS);
  const dateEn = formatDate(delivery, ENGLISH_MONTHS);
  return {
    isOpen: false,
    apiAvailable: false,
    isLiveBatchHours: ist.isOpen,
    currentTimeIST: ist.formattedTime,
    currentHourIST: ist.hours,
    currentMinuteIST: ist.minutes,
    openHour: 11, closeHour: 16,
    deliveryDate: date,
    deliveryDateFormattedTe: dateTe,
    deliveryDateFormattedEn: dateEn,
    currentDateIST: dateTe,
    currentDateISTEn: dateEn,
    deliveryWindow: 'సాయంత్రం 6:00 - 8:00 గంటలు',
    deliveryWindowEn: 'Evening 6:00 - 8:00 PM',
    nextOpenMessage: 'ఆర్డరింగ్ సేవకు కనెక్ట్ అవుతోంది. దయచేసి వేచి ఉండండి.',
    nextOpenMessageEn: 'Connecting to the ordering service. Please wait.',
  };
}

export function normalizeOrderingStatus(data: OrderingHoursStatus): OrderingHoursStatus {
  return {
    ...data,
    apiAvailable: true,
    currentTimeIST: data.currentIstTime || data.currentTimeIST,
    currentHourIST: data.currentIstHour ?? data.currentHourIST,
    currentDateIST: data.deliveryDateFormattedTe || data.deliveryDate,
    currentDateISTEn: data.deliveryDateFormattedEn || data.deliveryDate,
    nextOpenMessage: data.nextOrderingWindowTe || data.nextOrderingWindowIst || data.nextOpenMessage,
    nextOpenMessageEn: data.nextOrderingWindowEn || data.nextOpenMessageEn,
    deliveryWindow: data.deliveryWindowTe || data.deliveryWindow,
    deliveryWindowEn: data.deliveryWindowEn,
  };
}

export function getDeliveryDateString(mockOffsetMinutes = 0): string {
  const ist = getISTTime(mockOffsetMinutes);
  const delivery = new Date(Date.UTC(ist.year, ist.month, ist.date + (ist.hours >= 16 ? 1 : 0)));
  return `${formatDate(delivery, TELUGU_MONTHS)} (సాయంత్రం 6:00 - 8:00 గంటలు)`;
}
