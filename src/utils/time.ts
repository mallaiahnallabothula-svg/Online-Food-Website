/**
 * Asia/Kolkata (IST) Time and Date Utilities for Telugu Food Ordering
 */

export interface ISTTimeInfo {
  year: number;
  month: number;
  date: number;
  hours: number;
  minutes: number;
  seconds: number;
  formattedTime: string;
  formattedDateTelugu: string;
  isOpen: boolean;
  nextOpenMessage: string;
}

const TELUGU_MONTHS = [
  'జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్',
  'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'
];

/**
 * Returns current IST time representation
 */
export function getISTTime(mockOffsetMinutes: number = 0): ISTTimeInfo {
  const now = new Date(Date.now() + mockOffsetMinutes * 60 * 1000);
  
  // Format into Asia/Kolkata parts
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const findPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

  const year = findPart('year');
  const month = findPart('month') - 1; // 0-indexed
  const date = findPart('day');
  const hours = findPart('hour');
  const minutes = findPart('minute');
  const seconds = findPart('second');

  // Business hours: 11:00 AM to 4:00 PM IST (11:00 - 16:00)
  // 11 <= hours < 16 (or exactly 16:00:00)
  const totalMinutes = hours * 60 + minutes;
  const openMinutes = 11 * 60; // 660 mins
  const closeMinutes = 16 * 60; // 960 mins (4:00 PM)

  const isOpen = totalMinutes >= openMinutes && totalMinutes < closeMinutes;

  let nextOpenMessage = '';
  if (totalMinutes < openMinutes) {
    const diffMins = openMinutes - totalMinutes;
    const diffH = Math.floor(diffMins / 60);
    const diffM = diffMins % 60;
    nextOpenMessage = `ఈరోజు ఆర్డర్లు ఉదయం 11:00 AM కు ప్రారంభమవుతాయి (${diffH > 0 ? `${diffH} గం. ` : ''}${diffM} నిమిషాలలో).`;
  } else if (totalMinutes >= closeMinutes) {
    nextOpenMessage = 'ఈరోజు ఆర్డర్ల స్వీకరణ ముగిసింది (11:00 AM – 4:00 PM). రేపు ఉదయం 11:00 AM కు తిరిగి ప్రారంభమవుతాయి.';
  } else {
    const remainingMins = closeMinutes - totalMinutes;
    const remH = Math.floor(remainingMins / 60);
    const remM = remainingMins % 60;
    nextOpenMessage = `ఆర్డర్లు స్వీకరించబడుతున్నాయి! ముగింపుకు ఇంకా ${remH > 0 ? `${remH} గం. ` : ''}${remM} నిమిషాలు ఉంది.`;
  }

  // Format 12-hour AM/PM
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formattedTime = `${pad(hour12)}:${pad(minutes)} ${ampm} IST`;

  const formattedDateTelugu = `${date} ${TELUGU_MONTHS[month]} ${year}`;

  return {
    year,
    month,
    date,
    hours,
    minutes,
    seconds,
    formattedTime,
    formattedDateTelugu,
    isOpen,
    nextOpenMessage,
  };
}

/**
 * Get delivery date string for display (Telugu)
 */
export function getDeliveryDateString(mockOffsetMinutes: number = 0): string {
  const ist = getISTTime(mockOffsetMinutes);
  return `${ist.formattedDateTelugu} (సాయంత్రం 6:00 - 8:00 గంటలు)`;
}
