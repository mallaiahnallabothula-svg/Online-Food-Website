/**
 * CSV and PDF Export Utilities for Sri Mallikarjuna Jonna Rottelu
 */
import jsPDF from 'jspdf';
import { Order } from '../types';

export function exportOrdersToCSV(orders: Order[], filenamePrefix: string = 'SMJR_Orders'): void {
  const headers = [
    'Order ID',
    'Order Date (IST)',
    'Customer Name',
    'Mobile',
    'Jowar Rotis Quantity',
    'Price per Roti',
    'Total Paid (INR)',
    'Karivepaku Karam (g)',
    'Avise Karam (g)',
    'Payment Status',
    'Payment Reference',
    'Delivery Date',
    'Delivery Window',
    'Fulfillment Status',
    'Delivery Address',
    'Landmark'
  ];

  const escapeCSV = (str: string | number | undefined | null) => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = orders.map(order => [
    escapeCSV(order.id),
    escapeCSV(order.createdAtIST),
    escapeCSV(order.customer.name),
    escapeCSV(`+91 ${order.customer.mobile}`),
    escapeCSV(order.quantity),
    escapeCSV(order.pricePerRoti),
    escapeCSV(order.totalPaid),
    escapeCSV(order.karamQuantities.karivepakuGrams),
    escapeCSV(order.karamQuantities.aviseGinjaluGrams),
    escapeCSV(order.paymentStatus),
    escapeCSV(order.paymentReference),
    escapeCSV(order.deliveryDate),
    escapeCSV(order.deliveryWindow),
    escapeCSV(order.fulfillmentStatus),
    escapeCSV(order.customer.address),
    escapeCSV(order.customer.landmark || '')
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportOrdersToPDF(orders: Order[], filenamePrefix: string = 'SMJR_Orders_Report'): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Brand Header
  doc.setFontSize(16);
  doc.setTextColor(120, 53, 15); // #78350F
  doc.text('Sri Mallikarjuna Jonna Rottelu - Orders & Fulfillment Report', 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated On: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST | Contact: +91 8499865803`, 14, 22);

  // Summary Metrics
  const totalRevenue = orders.reduce((sum, o) => sum + o.totalPaid, 0);
  const totalRotis = orders.reduce((sum, o) => sum + o.quantity, 0);
  const totalKarivepaku = orders.reduce((sum, o) => sum + o.karamQuantities.karivepakuGrams, 0);
  const totalAvise = orders.reduce((sum, o) => sum + o.karamQuantities.aviseGinjaluGrams, 0);

  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.rect(14, 26, 268, 14);
  doc.text(`Total Orders: ${orders.length}`, 18, 33);
  doc.text(`Total Rotis: ${totalRotis}`, 65, 33);
  doc.text(`Total Revenue: INR ${totalRevenue}`, 115, 33);
  doc.text(`Karivepaku Karam: ${totalKarivepaku}g`, 175, 33);
  doc.text(`Avise Karam: ${totalAvise}g`, 230, 33);

  // Table header
  let y = 48;
  doc.setFillColor(245, 240, 230);
  doc.rect(14, y - 5, 268, 8, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);

  doc.text('#', 16, y);
  doc.text('Order ID', 24, y);
  doc.text('Customer', 60, y);
  doc.text('Mobile', 100, y);
  doc.text('Rotis', 125, y);
  doc.text('Free Karams', 140, y);
  doc.text('Total (INR)', 175, y);
  doc.text('Pay Ref', 195, y);
  doc.text('Delivery Window', 225, y);
  doc.text('Status', 255, y);

  doc.setFont('helvetica', 'normal');
  y += 7;

  orders.forEach((order, index) => {
    if (y > 185) {
      doc.addPage();
      y = 20;
      doc.setFillColor(245, 240, 230);
      doc.rect(14, y - 5, 268, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('#', 16, y);
      doc.text('Order ID', 24, y);
      doc.text('Customer', 60, y);
      doc.text('Mobile', 100, y);
      doc.text('Rotis', 125, y);
      doc.text('Free Karams', 140, y);
      doc.text('Total (INR)', 175, y);
      doc.text('Pay Ref', 195, y);
      doc.text('Delivery Window', 225, y);
      doc.text('Status', 255, y);
      doc.setFont('helvetica', 'normal');
      y += 7;
    }

    doc.setFontSize(7.5);
    doc.setTextColor(50, 50, 50);

    const karamsText = `${order.karamQuantities.karivepakuGrams > 0 ? `K:${order.karamQuantities.karivepakuGrams}g ` : ''}${order.karamQuantities.aviseGinjaluGrams > 0 ? `A:${order.karamQuantities.aviseGinjaluGrams}g` : ''}` || 'None';

    doc.text(String(index + 1), 16, y);
    doc.text(order.id.replace('SMJR-', ''), 24, y);
    doc.text((order.customer.name || '').slice(0, 20), 60, y);
    doc.text(`+91 ${order.customer.mobile}`, 100, y);
    doc.text(`${order.quantity} pcs`, 125, y);
    doc.text(karamsText, 140, y);
    doc.text(`Rs. ${order.totalPaid}`, 175, y);
    doc.text((order.paymentReference || '').slice(0, 14), 195, y);
    doc.text(order.deliveryWindow.slice(0, 16), 225, y);
    doc.text(order.fulfillmentStatus, 255, y);

    // Subtle line divider
    doc.setDrawColor(230, 230, 230);
    doc.line(14, y + 2, 282, y + 2);

    y += 7;
  });

  doc.save(`${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
