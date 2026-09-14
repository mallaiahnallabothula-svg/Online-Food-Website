import { getDb } from '../db/index.ts';
import { getNowInIst, formatIstDate } from './timeService.ts';

export interface AnalyticsData {
  summary: {
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
  ordersByStatus: Record<string, number>;
  hourlyOrderDistribution: Array<{ hourSlot: string; count: number }>;
  dailyTrends: Array<{ date: string; dateFormatted: string; orders: number; revenue: number }>;
  feedbackSummary: {
    averageRating: number;
    totalReviews: number;
    ratingCounts: { [star: number]: number };
  };
}

export async function getAuthoritativeAnalytics(): Promise<AnalyticsData> {
  const db = getDb();
  const todayIst = formatIstDate(getNowInIst());

  // 1. Overall Orders and Revenue Summary
  const summaryRes = await db.execute(`
    SELECT
      COUNT(*) as total_orders,
      COALESCE(SUM(total_amount_paisa), 0) as total_revenue_paisa,
      COALESCE(SUM(total_items), 0) as total_items,
      COALESCE(SUM(jowar_quantity), 0) as total_jowar,
      COALESCE(SUM(chapathi_quantity), 0) as total_chapathi,
      COALESCE(SUM(karivepaku_grams), 0) as total_karivepaku_grams,
      COALESCE(SUM(avise_grams), 0) as total_avise_grams
    FROM orders
    WHERE payment_status = 'PAID'
  `);

  const summaryRow = summaryRes.rows[0]!;
  const totalOrders = Number(summaryRow.total_orders || 0);
  const totalRevenuePaisa = Number(summaryRow.total_revenue_paisa || 0);
  const totalRevenueRupees = Math.round(totalRevenuePaisa / 100);
  const totalItems = Number(summaryRow.total_items || 0);
  const totalJowar = Number(summaryRow.total_jowar || 0);
  const totalChapathi = Number(summaryRow.total_chapathi || 0);
  const totalKarivepakuGrams = Number(summaryRow.total_karivepaku_grams || 0);
  const totalAviseGrams = Number(summaryRow.total_avise_grams || 0);

  // 2. Today's metrics (delivery_date = todayIst)
  const todayRes = await db.execute({
    sql: `
      SELECT
        COUNT(*) as today_orders,
        COALESCE(SUM(total_amount_paisa), 0) as today_revenue_paisa
      FROM orders
      WHERE delivery_date = ? AND payment_status = 'PAID'
    `,
    args: [todayIst],
  });

  const todayRow = todayRes.rows[0]!;
  const todayOrdersCount = Number(todayRow.today_orders || 0);
  const todayRevenuePaisa = Number(todayRow.today_revenue_paisa || 0);
  const todayRevenueRupees = Math.round(todayRevenuePaisa / 100);

  // 3. Status breakdown
  const statusRes = await db.execute(`
    SELECT fulfillment_status, COUNT(*) as count
    FROM orders
    GROUP BY fulfillment_status
  `);

  const ordersByStatus: Record<string, number> = {
    RECEIVED: 0,
    PREPARING: 0,
    OUT_FOR_DELIVERY: 0,
    DELIVERED: 0,
    CANCELLED: 0,
  };

  for (const r of statusRes.rows) {
    const st = String(r.fulfillment_status);
    ordersByStatus[st] = Number(r.count || 0);
  }

  // 4. Hourly Distribution (from created_at_ist or created_at_utc)
  const allOrdersRes = await db.execute(`
    SELECT created_at_utc FROM orders WHERE payment_status = 'PAID'
  `);

  const hourlyMap = new Map<number, number>();
  for (let h = 10; h <= 20; h++) {
    hourlyMap.set(h, 0);
  }

  for (const r of allOrdersRes.rows) {
    const utcDate = new Date(String(r.created_at_utc));
    // Convert to IST hour
    const istHour = (utcDate.getUTCHours() + 5 + (utcDate.getUTCMinutes() + 30 >= 60 ? 1 : 0)) % 24;
    if (hourlyMap.has(istHour)) {
      hourlyMap.set(istHour, (hourlyMap.get(istHour) || 0) + 1);
    }
  }

  const hourlyOrderDistribution: Array<{ hourSlot: string; count: number }> = [];
  for (let h = 11; h <= 17; h++) {
    const label = `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`;
    hourlyOrderDistribution.push({
      hourSlot: label,
      count: hourlyMap.get(h) || 0,
    });
  }

  // 5. Daily Trends (last 7 days from SQLite)
  const trendsRes = await db.execute(`
    SELECT
      delivery_date as date,
      COUNT(*) as order_count,
      COALESCE(SUM(total_amount_paisa), 0) as revenue_paisa
    FROM orders
    WHERE payment_status = 'PAID'
    GROUP BY delivery_date
    ORDER BY delivery_date DESC
    LIMIT 7
  `);

  const dailyTrends = trendsRes.rows
    .map(r => {
      const dateStr = String(r.date);
      const parts = dateStr.split('-');
      const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
      return {
        date: dateStr,
        dateFormatted: formatted,
        orders: Number(r.order_count || 0),
        revenue: Math.round(Number(r.revenue_paisa || 0) / 100),
      };
    })
    .reverse();

  // 6. Feedback Summary
  const feedbackRes = await db.execute(`
    SELECT
      COUNT(*) as total_reviews,
      COALESCE(AVG(rating), 0) as avg_rating
    FROM feedback
  `);

  const fbRow = feedbackRes.rows[0]!;
  const totalReviews = Number(fbRow.total_reviews || 0);
  const averageRating = Math.round(Number(fbRow.avg_rating || 0) * 10) / 10;

  const starCountsRes = await db.execute(`
    SELECT rating, COUNT(*) as count FROM feedback GROUP BY rating
  `);

  const ratingCounts: { [star: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of starCountsRes.rows) {
    const star = Number(r.rating);
    if (star >= 1 && star <= 5) {
      ratingCounts[star] = Number(r.count || 0);
    }
  }

  return {
    summary: {
      totalRevenueRupees,
      totalOrders,
      totalItems,
      totalJowarRotis: totalJowar,
      totalChapathis: totalChapathi,
      totalKarivepakuGrams,
      totalAviseGrams,
      todayOrdersCount,
      todayRevenueRupees,
      averageOrderValueRupees: totalOrders > 0 ? Math.round(totalRevenueRupees / totalOrders) : 0,
    },
    ordersByStatus,
    hourlyOrderDistribution,
    dailyTrends,
    feedbackSummary: {
      averageRating,
      totalReviews,
      ratingCounts,
    },
  };
}
