/**
 * Types and interfaces for Mana Enti Vanta / మన ఇంటి వంట
 */

export type FulfillmentStatus = 'RECEIVED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PAID' | 'FAILED' | 'REFUNDED' | 'PAY_ON_DELIVERY';
export type AdminRole = 'ADMIN' | 'STAFF';

export interface OrderFeedback {
  id: string;
  orderId: string;
  rating: number; // 1 to 5
  comment: string;
  comments?: string; // alias for comment
  aspects?: string[];
  customerName?: string;
  customerMobile?: string;
  createdAt: string;
  createdAtIST?: string;
  isPublic?: boolean;
}

export interface KaramSelection {
  karivepaku: boolean; // కరివేపాకు కారం
  aviseGinjalu: boolean; // అవిసె గింజల కారం
}

export interface CustomerDetails {
  name: string;
  mobile: string; // 10 digits
  address: string;
  landmark?: string;
  locationLink?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
}

export interface Order {
  id: string; // e.g. SMJR-20260914-1001
  customerAccessToken?: string;
  createdAtUtc?: string;
  createdAtIst?: string;
  createdAt?: string;
  createdAtIST?: string;
  deliveryDate: string; // YYYY-MM-DD
  deliveryWindow: string; // "18:00-20:00" or localized
  jowarQuantity: number; // Jowar Rotis count (min 5 if chosen, ₹30 each)
  chapathiQuantity: number; // Chapathis count (min 5 if chosen, ₹10 each)
  totalItems: number;
  quantity?: number; // Total alias
  jowarUnitPrice: number; // 30
  chapathiUnitPrice: number; // 10
  pricePerRoti?: number; // 30
  pricePerChapathi?: number; // 10
  subtotal: number; // Food items subtotal
  deliveryCharge: number; // Delivery charge: ₹0 if <= 5km, ₹9/km above 5km
  totalAmount: number; // Final total in rupees
  totalPaid?: number; // Alias for totalAmount
  currency?: string;
  karamSelection?: KaramSelection;
  karivepakuGrams?: number;
  aviseGrams?: number;
  karamQuantities?: {
    karivepakuGrams: number;
    aviseGinjaluGrams: number;
  };
  customer?: CustomerDetails;
  customerName?: string;
  customerMobile?: string;
  address?: string;
  landmark?: string;
  distanceKm?: number;
  locationLink?: string;
  paymentStatus: PaymentStatus | string;
  paymentProvider?: string;
  providerPaymentId?: string;
  paymentReference?: string;
  fulfillmentStatus: FulfillmentStatus;
  receivedAt?: string;
  receivedAtIST?: string;
  receivedBy?: string;
  isCustomerReceived?: boolean;
  updatedAt?: string;
  updatedBy?: string;
  feedback?: OrderFeedback;
}

export interface AuditLog {
  id: string;
  actorType: string;
  actorId: string;
  actor?: string;
  action: string;
  targetType: string;
  targetId: string;
  details: any;
  amount?: number;
  ip?: string | null;
  createdAt: string;
}

export interface AnalyticsData {
  totalRevenue?: number;
  todayRevenue?: number;
  totalOrders?: number;
  totalRotisSold?: number;
  totalKarivepakuGrams?: number;
  totalAviseGrams?: number;
  averageRating?: number;
  totalFeedbacks?: number;
  summary?: {
    totalRevenueRupees: number;
    totalOrders: number;
    totalItems: number;
    totalJowarRotis: number;
    totalChapathis: number;
    totalKarivepakuGrams: number;
    totalAviseGrams: number;
    todayOrdersCount: number;
    todayRevenueRupees: number;
    averageOrderValueRupees: number;
  };
  ordersByStatus?: Record<string, number>;
  hourlyOrderDistribution?: Array<{ hour?: number; label?: string; hourSlot?: string; count: number; revenue?: number }>;
  dailyTrends?: Array<{ date: string; dateFormatted: string; orders: number; revenue: number }>;
  feedbackSummary?: {
    averageRating: number;
    totalReviews: number;
    ratingCounts: { [star: number]: number };
  };
}

export interface OrderingHoursStatus {
  isOpen: boolean;
  isLiveBatchHours?: boolean;
  currentIstTime?: string;
  currentTimeIST?: string;
  currentIstHour?: number;
  currentHourIST?: number;
  currentMinuteIST?: number;
  openHour?: number;
  closeHour?: number;
  deliveryDate?: string;
  deliveryDateEn?: string;
  deliveryDateFormattedTe?: string;
  deliveryDateFormattedEn?: string;
  deliveryWindowTe?: string;
  deliveryWindowEn?: string;
  nextOrderingWindowIst?: string;
  nextOrderingWindowTe?: string;
  nextOrderingWindowEn?: string;
  openTimeStr?: string;
  openTimeStrEn?: string;
  closeTimeStr?: string;
  closeTimeStrEn?: string;
  nextOpenMessage?: string;
  nextOpenMessageEn?: string;
  deliveryWindowStr?: string;
  deliveryWindowStrEn?: string;
  currentDateIST?: string;
  currentDateISTEn?: string;
  deliveryWindow?: string;
  [key: string]: any;
}
