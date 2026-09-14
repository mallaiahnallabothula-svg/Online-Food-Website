import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Calendar, Check, X } from 'lucide-react';
import { Order } from '../../types';
import { exportOrdersToCSV, exportOrdersToPDF } from '../../utils/exportReports';

interface ExportReportsModalProps {
  orders: Order[];
  onClose: () => void;
}

export const ExportReportsModal: React.FC<ExportReportsModalProps> = ({ orders, onClose }) => {
  const [selectedFormat, setSelectedFormat] = useState<'CSV' | 'PDF'>('CSV');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string>('');

  const filteredOrders = dateFilter
    ? orders.filter(o => {
        const cDate = o.createdAt || o.createdAtUtc || o.createdAtIST || '';
        return cDate.startsWith(dateFilter) || (o.deliveryDate && o.deliveryDate.includes(dateFilter));
      })
    : orders;

  const handleExport = () => {
    setIsExporting(true);
    try {
      if (selectedFormat === 'CSV') {
        exportOrdersToCSV(filteredOrders, 'Sri_Mallikarjuna_Jonna_Rottelu_Orders');
        setSuccessNotice('CSV ఫైల్ విజయవంతంగా డౌన్‌లోడ్ అయింది!');
      } else {
        exportOrdersToPDF(filteredOrders, 'Sri_Mallikarjuna_Jonna_Rottelu_Orders_Report');
        setSuccessNotice('PDF రిపోర్ట్ విజయవంతంగా డౌన్‌లోడ్ అయింది!');
      }
      setTimeout(() => setSuccessNotice(''), 3000);
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-telugu">
      <div className="bg-white dark:bg-[#211E1A] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 w-full max-w-md p-6 space-y-5">
        
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              రిపోర్ట్స్ ఎక్స్‌పోర్ట్ (Export Reports)
            </h3>
            <p className="text-xs text-stone-500">
              CSV లేదా PDF ఫార్మాట్‌లలో ఆర్డర్లు మరియు ఆదాయ సమాచారాన్ని డౌన్‌లోడ్ చేయండి
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selection Cards */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
            ఫార్మాట్ ఎంచుకోండి (Select Format):
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedFormat('CSV')}
              className={`p-3.5 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                selectedFormat === 'CSV'
                  ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                  : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
              }`}
            >
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
              <span className="text-xs">CSV స్ప్రెడ్‌షీట్ (.csv)</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedFormat('PDF')}
              className={`p-3.5 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                selectedFormat === 'PDF'
                  ? 'border-[#78350F] bg-amber-50/60 dark:bg-amber-950/40 text-[#78350F] dark:text-amber-200 font-bold'
                  : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
              }`}
            >
              <FileText className="w-6 h-6 text-[#78350F]" />
              <span className="text-xs">PDF డాక్యుమెంట్ (.pdf)</span>
            </button>
          </div>
        </div>

        {/* Date Filter (Optional) */}
        <div>
          <label htmlFor="export-date-filter" className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
            నిర్దిష్ట తేదీ ఫిల్టర్ (ఐచ్ఛికం):
          </label>
          <input
            type="date"
            id="export-date-filter"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 text-xs"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="text-[11px] text-amber-700 hover:underline mt-1 block"
            >
              తేదీ ఫిల్టర్ తొలగించు (అన్ని ఆర్డర్లు)
            </button>
          )}
        </div>

        {/* Export Stats Summary */}
        <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-900 text-xs text-stone-600 dark:text-stone-400 space-y-1">
          <div className="flex justify-between">
            <span>ఎక్స్‌పోర్ట్ కానున్న ఆర్డర్లు:</span>
            <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{filteredOrders.length}</span>
          </div>
          <div className="flex justify-between">
            <span>మొత్తం ఆదాయం:</span>
            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
              ₹{filteredOrders.reduce((s, o) => s + (o.totalAmount || o.totalPaid || 0), 0)}
            </span>
          </div>
        </div>

        {successNotice && (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
        )}

        <div className="pt-2 flex gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || filteredOrders.length === 0}
            id="start-export-btn"
            className="flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#78350F] hover:bg-[#8C4A26] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{selectedFormat} డౌన్‌లోడ్ చేయండి</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            మూసివేయి
          </button>
        </div>

      </div>
    </div>
  );
};
