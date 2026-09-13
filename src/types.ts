/**
 * Types and interfaces for Sri Mallikarjuna Jonna Rottelu
 */

export type FulfillmentStatus = 'NEW' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
export type PaymentStatus = 'PENDING' | 'VERIFIED' | 'FAILED' | 'CANCELLED' | 'PAY_ON_DELIVERY';
export type AdminRole = 'ADMIN' | 'STAFF';

export interface OrderFeedback {
  id: string;
  orderId: string;
  rating: number; // 1 to 5
  comments: string;
  aspects?: string[]; // e.g. 'TASTE_SOFTNESS', 'KARIVEPAKU_KARAM', 'AVISE_KARAM', 'ON_TIME_DELIVERY', 'PACKAGING', 'HOT_AND_FRESH'
  customerName?: string;
  customerMobile?: string;
  createdAt: string;
  createdAtIST: string;
}

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
  quantity: number; // Total rotis + chapathis (backward compatible)
  jowarQuantity?: number; // Jowar Rotis count (min 5 if selected, ₹30 each)
  chapathiQuantity?: number; // Chapathis count (min 5 if selected, ₹10 each)
  pricePerRoti: number; // 30
  pricePerChapathi?: number; // 10
  subtotal?: number; // Food items subtotal
  deliveryCharge?: number; // Delivery charge: ₹0 if <= 5km, ₹9/km above 5km
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
  isCustomerReceived?: boolean;
  receivedAt?: string;
  receivedAtIST?: string;
  feedback?: OrderFeedback;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  timestampIST: string;
  type: 'PAYMENT_VERIFIED' | 'ORDER_CREATED' | 'STATUS_UPDATED' | 'PAYMENT_FAILED' | 'LOGIN_ATTEMPT' | 'EXPORT_GENERATED' | 'ORDER_RECEIVED' | 'FEEDBACK_SUBMITTED';
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
  averageRating?: number;
  totalFeedbacks?: number;
  ratingDistribution?: Record<number, number>;
}

export interface OrderingHoursStatus {
  isOpen: boolean;
  currentTimeIST: string;
  currentHourIST: number;
  currentMinuteIST: number;
  openTimeStr: string;
  openTimeStrEn?: string;
  closeTimeStr: string;
  closeTimeStrEn?: string;
  nextOpenMessage: string;
  nextOpenMessageEn?: string;
  deliveryWindowStr: string;
  deliveryWindowStrEn?: string;
  deliveryDate?: string;
  deliveryDateEn?: string;
  currentDateIST?: string;
  currentDateISTEn?: string;
  deliveryWindow?: string;
  deliveryWindowEn?: string;
  isLiveBatchHours?: boolean;
}
