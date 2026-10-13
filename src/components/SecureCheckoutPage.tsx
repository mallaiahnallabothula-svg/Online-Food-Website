import { ArrowLeft, LockKeyhole, ShieldCheck } from 'lucide-react';
import { BrandEmblem } from './BrandEmblem';
import { UpcomingCheckoutPreview } from './UpcomingCheckoutPreview';
import { useLanguage } from '../context/LanguageContext';
import type { CheckoutSelection } from '../utils/checkoutSelection';
import type { ReorderRequest } from '../utils/reorder';

export function SecureCheckoutPage({ selection, onBack, onReorder }: {
  selection: CheckoutSelection | null;
  onBack: () => void;
  onReorder?: (request: ReorderRequest) => void;
}) {
  const { language } = useLanguage();
  const te = language === 'te';
  return (
    <div data-testid="secure-checkout-page" className="min-h-[80vh] bg-[#f7f2e9] px-4 pb-14 pt-7 dark:bg-[#211f1c] sm:px-6 sm:pt-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-[#ded7ce] pb-5 dark:border-stone-700">
          <div className="flex items-center gap-3">
            <BrandEmblem size="sm" />
            <div>
              <p className="text-base font-bold text-[#26231f] dark:text-stone-100">Mana Enti Vanta</p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#756f67] dark:text-stone-400">HOME KITCHEN · KOLLUR</p>
            </div>
          </div>
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#ded7ce] px-4 text-sm font-semibold text-[#ab4d3e] hover:bg-[#f0e7db] dark:border-stone-600 dark:text-[#e8ad99] dark:hover:bg-stone-800">
            <ArrowLeft size={16} aria-hidden="true" /> {te ? 'మెనూకి తిరిగి' : 'Back to menu'}
          </button>
        </div>
        <div className="mb-4">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ab4d3e] dark:text-[#e8ad99]">
            <LockKeyhole size={15} aria-hidden="true" /> {te ? 'సురక్షితమైన చెకౌట్' : 'SECURE CHECKOUT'}
          </p>
          <h1 className="solara-display mt-2 text-3xl leading-tight text-[#26231f] dark:text-stone-100 sm:text-5xl">{te ? 'డెలివరీ వివరాలు' : 'Delivery details'}</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#756f67] dark:text-stone-300">{te ? 'మీ డెలివరీ వివరాలు ఇచ్చి, పిన్ మరియు మొత్తం సరిచూసుకోండి.' : 'Confirm your delivery address, location pin and total before payment.'}</p>
        </div>
        {selection ? (
          <UpcomingCheckoutPreview period={selection.period} lines={selection.lines} subtotalPaisa={selection.subtotalPaisa} te={te} onReorder={onReorder} />
        ) : (
          <div role="status" className="rounded-xl border border-[#ded7ce] bg-white px-6 py-8 text-center dark:border-stone-600 dark:bg-stone-800">
            <h2 className="text-xl font-semibold">{te ? 'కార్ట్‌లో ఐటమ్స్ లేవు' : 'Your cart is empty'}</h2>
            <p className="mt-2 text-sm text-[#756f67] dark:text-stone-300">{te ? 'ముందుగా మెనూలో ఐటమ్స్ ఎంచుకోండి.' : 'Choose food items on the menu before proceeding to delivery.'}</p>
            <button type="button" onClick={onBack} className="mt-5 min-h-11 rounded-full bg-[#ab4d3e] px-6 font-semibold text-white">{te ? 'మెనూ చూడండి' : 'Explore menu'}</button>
          </div>
        )}
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-[#756f67] dark:text-stone-400">
          <ShieldCheck size={15} aria-hidden="true" />
          {te ? 'ధర, స్టాక్, డెలివరీ అర్హత పేమెంట్ ముందు సర్వర్‌లో ధృవీకరిస్తాం.' : 'Price, stock and delivery eligibility are verified before payment.'}
        </p>
      </div>
    </div>
  );
}
