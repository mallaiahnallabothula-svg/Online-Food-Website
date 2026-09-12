import React, { useState, useEffect } from 'react';
import { X, Search, Package, Clock, CheckCircle2, AlertCircle, ArrowRight, MessageSquareHeart, Star } from 'lucide-react';
import { Order } from '../types';
import { PostOrderFeedback } from './PostOrderFeedback';

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOrderId?: string;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  isOpen,
  onClose,
  initialOrderId,
}) => {
  const [searchId, setSearchId] = useState<string>(initialOrderId || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [recentOrders, setRecentOrders] = useState<Array<{ id: string; date: string; qty: number; status: string }>>([]);

  // Load recent orders stored locally
  useEffect(() => {
    try {
      const stored = localStorage.getItem('smjr_customer_orders');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentOrders(parsed);
          // If initialOrderId not provided and there is a recent order, auto-load the latest one
          if (!initialOrderId && parsed.length > 0 && !selectedOrder) {
            fetchOrder(parsed[0].id);
          }
        }
      }
    } catch {}
  }, []);

  // Fetch when initialOrderId changes
  useEffect(() => {
    if (initialOrderId) {
      setSearchId(initialOrderId);
      fetchOrder(initialOrderId);
    }
  }, [initialOrderId]);

  const fetchOrder = async (idToFetch: string) => {
    const cleanId = idToFetch.trim();
    if (!cleanId) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(cleanId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.order) {
          setSelectedOrder(data.order);
        } else {
          setErrorMessage('ఆర్డర్ కనుగొనబడలేదు.');
        }
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'ఈ నంబర్‌తో ఆర్డర్ వివరాలు లభించలేదు.');
      }
    } catch (e) {
      setErrorMessage('సర్వర్ కనెక్షన్ లోపం ఏర్పడింది. దయచేసి మళ్లీ ప్రయత్నించండి.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId) {
      fetchOrder(searchId);
    }
  };

  const handleOrderUpdated = (updated: Order) => {
    setSelectedOrder(updated);
    // Also sync local storage order list
    try {
      const stored = localStorage.getItem('smjr_customer_orders');
      if (stored) {
        const list = JSON.parse(stored);
        const updatedList = list.map((item: any) =>
          item.id === updated.id
            ? { ...item, status: updated.fulfillmentStatus }
            : item
        );
        localStorage.setItem('smjr_customer_orders', JSON.stringify(updatedList));
      }
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs overflow-y-auto font-telugu">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#211E1A] rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 my-8 overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-[#FAF4EA] dark:bg-stone-900 px-6 py-4 border-b border-amber-900/10 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-stone-800 text-[#78350F] dark:text-amber-400">
              <MessageSquareHeart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#451A03] dark:text-amber-100">
                నా ఆర్డర్ స్థితి & ఫీడ్‌బ్యాక్
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                ఆర్డర్ డెలివరీ నిర్ధారణ & రేటింగ్
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            id="close-tracking-modal-btn"
            className="p-2 rounded-xl text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="space-y-2">
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
              ఆర్డర్ నంబర్ ద్వారా వెతకండి (Enter Order ID):
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="e.g. SMJR-20260911-2176"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-hidden"
                />
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              </div>
              <button
                type="submit"
                disabled={loading || !searchId.trim()}
                id="search-order-btn"
                className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#78350F] hover:bg-[#92400E] transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <span>{loading ? 'వెతుకుతోంది...' : 'వెతకండి'}</span>
              </button>
            </div>
          </form>

          {/* Quick Select from Recent Orders on this device */}
          {recentOrders.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-stone-500 dark:text-stone-400 block">
                ఈ పరికరంలో చేసిన తాజా ఆర్డర్లు (Recent Orders):
              </span>
              <div className="flex flex-wrap gap-2">
                {recentOrders.slice(0, 4).map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => {
                      setSearchId(rec.id);
                      fetchOrder(rec.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      selectedOrder?.id === rec.id
                        ? 'bg-amber-100 dark:bg-stone-800 text-[#78350F] dark:text-amber-400 border-amber-400'
                        : 'bg-stone-50 dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-amber-300'
                    }`}
                  >
                    <span>{rec.id}</span>
                    <span className="text-[10px] text-stone-500 font-telugu font-normal">({rec.qty} రొట్టెలు)</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* If Order is Loaded: Render Details & PostOrderFeedback */}
          {selectedOrder && (
            <div className="space-y-5 pt-2 border-t border-stone-200 dark:border-stone-800">
              
              {/* Order Info Card */}
              <div className="p-4 rounded-xl bg-[#FAF4EA] dark:bg-stone-900 border border-amber-900/10 dark:border-stone-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-stone-500 block">కస్టమర్ పేరు:</span>
                  <strong className="text-stone-900 dark:text-stone-100">{selectedOrder.customer.name}</strong>
                </div>
                <div>
                  <span className="text-stone-500 block">రొట్టెల పరిమాణం:</span>
                  <strong className="text-[#78350F] dark:text-amber-400 font-mono text-sm">{selectedOrder.quantity} రొట్టెలు (₹{selectedOrder.totalPaid})</strong>
                </div>
                <div>
                  <span className="text-stone-500 block">డెలివరీ తేదీ:</span>
                  <strong className="text-stone-800 dark:text-stone-200">{selectedOrder.deliveryDate}</strong>
                </div>
              </div>

              {/* Embed PostOrderFeedback for this order */}
              <PostOrderFeedback
                order={selectedOrder}
                onOrderUpdated={handleOrderUpdated}
              />
            </div>
          )}

          {!selectedOrder && !loading && !errorMessage && (
            <div className="p-8 text-center text-stone-400 dark:text-stone-500 text-xs sm:text-sm space-y-2">
              <Package className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600" />
              <p>ఆర్డర్ నంబర్ ఎంటర్ చేసి మీ డెలివరీ స్థితిని తనిఖీ చేయండి మరియు ఫీడ్‌బ్యాక్ ఇవ్వండి.</p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
