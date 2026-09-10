/**
 * Types and interfaces for Sri Mallikarjuna Jonna Rottelu
 */

export type FulfillmentStatus = 'NEW' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
export type PaymentStatus = 'PENDING' | 'VERIFIED' | 'FAILED' | 'CANCELLED';
export type AdminRole = 'ADMIN' | 'STAFF';

export interface KaramSelection {
  karivepaku: boolean; // కరివేపాకు కారం
  aviseGinjalu: boolean; // అవిసె గింజల కారం
}

export interface CustomerDetails {
  name: string;
  mobile: string; // 10 digits
  address: string;
  landmark: string;
  locationLink?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
}

export interface Order {
  id: string; // e.g. SMJR-20260910-4821
  createdAt: string; // ISO string
  createdAtIST: string; // Formatted IST
  quantity: number; // min 5
  pricePerRoti: number; // 30
  totalPaid: number;
  karamSelection: KaramSelection;
  karamQuantities: {
    karivepakuGrams: number;
    aviseGinjaluGrams: number;
  };
  customer: CustomerDetails;
  deliveryDate: string; // Formatted date (e.g., "10 సెప్టెంబర్ 2026")
  deliveryWindow: string; // "సాయంత్రం 6–8 గంటలు"
  paymentStatus: PaymentStatus;
  paymentReference: string;
  paymentVerifiedAt?: string;
  fulfillmentStatus: FulfillmentStatus;
  statusUpdatedAt?: string;
  statusUpdatedBy?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  timestampIST: string;
  type: 'PAYMENT_VERIFIED' | 'ORDER_CREATED' | 'STATUS_UPDATED' | 'PAYMENT_FAILED' | 'LOGIN_ATTEMPT' | 'EXPORT_GENERATED';
  orderId?: string;
  amount?: number;
  paymentReference?: string;
  details: string;
  actor: string;
}

export interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  totalRotisSold: number;
  totalKarivepakuGrams: number;
  totalAviseGrams: number;
  todayOrdersCount: number;
  todayRevenue: number;
  ordersByStatus: Record<FulfillmentStatus, number>;
  hourlyOrderDistribution: { hour: number; label: string; count: number; revenue: number }[];
  dailyTrends: { date: string; orders: number; revenue: number; rotis: number }[];
}

export interface OrderingHoursStatus {
  isOpen: boolean;
  currentTimeIST: string;
  currentHourIST: number;
  currentMinuteIST: number;
  openTimeStr: string; // "11:00 AM"
  closeTimeStr: string; // "04:00 PM"
  nextOpenMessage: string;
  deliveryWindowStr: string; // "సాయంత్రం 6:00 - 8:00 గంటలు"
}
