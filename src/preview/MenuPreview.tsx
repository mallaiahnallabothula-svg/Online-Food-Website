import { useState } from 'react';
import {
  ArrowRight, Check, Clock3, Coffee, Leaf, MapPin, Minus, Moon, Plus,
  ShieldCheck, ShoppingBag, Sparkles, Sun, UtensilsCrossed, Wheat,
} from 'lucide-react';
import { MENU_CATALOG, NEW_MENU_LAUNCH_ENABLED, NEW_MENU_ORDER_POLICY, type MealPeriod, type MenuItem } from '../../shared/menuCatalog.ts';

const rupees = (paisa: number) => '₹' + (paisa / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const mealDetails = {
  MORNING: {
    title: 'A fresh start to your day.',
    subheading: 'Breakfast favourites, made for your morning.',
    slot: '7:00 AM – 11:00 AM',
    itemLabel: 'Breakfast menu',
  },
  EVENING: {
    title: 'Evenings taste like home.',
    subheading: 'Warm, simple food for the end of the day.',
    slot: '6:00 PM – 8:00 PM',
    itemLabel: 'Evening menu',
  },
} as const;

function quantityLabel(item: MenuItem) {
  if (item.saleUnit === 'PIECE') return 'each';
  return 'per plate';
}

function servingLabel(item: MenuItem) {
  if (item.saleUnit === 'PIECE') return item.minimumQuantity > 1 ? 'Minimum ' + item.minimumQuantity + ' pieces' : 'Sold per piece';
  return item.piecesPerUnit !== null ? item.piecesPerUnit + ' pieces / plate' : 'Per plate';
}

function MenuCard({
  item, quantity, onAdd, onLess,
}: {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onLess: () => void;
}) {
  const morning = item.mealPeriod === 'MORNING';
  return (
    <article
      className="group overflow-hidden rounded-[26px] border border-stone-200/80 bg-white shadow-[0_16px_48px_-30px_rgba(47,38,27,.28)] transition-transform duration-200 hover:-translate-y-1"
      data-testid="preview-menu-card"
      data-item-id={item.id}
    >
      <div className={'relative flex h-36 items-center justify-center overflow-hidden sm:h-44 ' + (morning ? 'bg-[#F1E8D6]' : 'bg-[#E5EBE1]')}>
        <div aria-hidden="true" className={'absolute -left-12 -top-16 h-44 w-44 rounded-full border-[30px] opacity-50 ' + (morning ? 'border-[#E1CFB3]' : 'border-[#C9D9C5]')} />
        <div aria-hidden="true" className={'absolute -bottom-24 -right-8 h-48 w-48 rounded-full border-[24px] opacity-60 ' + (morning ? 'border-[#E1CFB3]' : 'border-[#C9D9C5]')} />
        <div className={'relative flex h-20 w-20 items-center justify-center rounded-[22px] border border-white/80 shadow-sm ' + (morning ? 'bg-[#FAF4E9] text-[#986B3E]' : 'bg-[#F0F4ED] text-[#55735B]')}>
          {item.saleUnit === 'PIECE' ? <Wheat size={38} strokeWidth={1.3} aria-hidden="true" /> : <UtensilsCrossed size={38} strokeWidth={1.3} aria-hidden="true" />}
        </div>
        <span className="absolute bottom-3 right-3 rounded-full bg-white/85 px-3 py-1 text-[10px] font-semibold tracking-wide text-stone-600 backdrop-blur-sm">Real photo coming soon</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-bold leading-snug text-[#283B30] sm:text-[19px]">{item.nameEn}</h3>
            <p className="mt-0.5 text-[13px] font-medium text-stone-500">{item.nameTe}</p>
          </div>
          <p className="shrink-0 text-xl font-extrabold text-[#36573E]">{rupees(item.pricePaisa)}</p>
        </div>
        <div className="min-h-[55px] space-y-1 text-[12px] text-stone-600">
          <p>{servingLabel(item)} <span className="text-stone-400">· {quantityLabel(item)}</span></p>
          {item.includesChutney && <p className="inline-flex items-center gap-1 font-semibold text-[#42754F]"><Check size={13} aria-hidden="true" /> Chutney included</p>}
          {item.dailyPlateLimit !== null && <p>Daily limit: {item.dailyPlateLimit} plates <span className="text-stone-400">(availability not checked)</span></p>}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-stone-400">Preview selection</span>
          {quantity === 0 ? (
            <button
              type="button"
              onClick={onAdd}
              aria-label={'Add ' + item.nameEn}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#28533A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#173D28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28533A]"
            >
              <Plus size={16} aria-hidden="true" /> Add
            </button>
          ) : (
            <div className="inline-flex items-center gap-3 rounded-full border border-[#CCD9CC] bg-[#EFF5EE] p-1">
              <button type="button" onClick={onLess} aria-label={'Decrease ' + item.nameEn} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#28533A] hover:bg-stone-100 focus-visible:outline-2"><Minus size={15}/></button>
              <output aria-label={item.nameEn + ' quantity'} className="min-w-5 text-center text-sm font-extrabold tabular-nums text-[#28533A]">{quantity}</output>
              <button type="button" onClick={onAdd} aria-label={'Increase ' + item.nameEn} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#28533A] text-white hover:bg-[#173D28] focus-visible:outline-2"><Plus size={15}/></button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * An isolated design preview. No API calls, address capture, checkout,
 * payment submission, inventory request or storage mutations.
 */
export default function MenuPreview() {
  const [period, setPeriod] = useState<MealPeriod>('MORNING');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const items = MENU_CATALOG.filter(item => item.mealPeriod === period);
  const selected = items.filter(item => (quantities[item.id] || 0) > 0);
  const subtotalPaisa = selected.reduce((sum, item) => sum + item.pricePaisa * (quantities[item.id] || 0), 0);
  const minimumCartPaisa = NEW_MENU_ORDER_POLICY.minimumCartPaisa;
  const minRemaining = Math.max(0, minimumCartPaisa - subtotalPaisa);
  const details = mealDetails[period];

  function choosePeriod(next: MealPeriod) {
    if (next !== period) {
      setPeriod(next);
      setQuantities({}); // A visual preview never mixes separate delivery slots.
    }
  }
  function increment(item: MenuItem) {
    setQuantities(previous => ({
      ...previous,
      [item.id]: (previous[item.id] || 0) === 0 ? item.minimumQuantity : previous[item.id]! + 1,
    }));
  }
  function decrement(item: MenuItem) {
    setQuantities(previous => ({
      ...previous,
      [item.id]: (previous[item.id] || 0) <= item.minimumQuantity ? 0 : previous[item.id]! - 1,
    }));
  }

  return (
    <div className="min-h-screen bg-[#F9F7F1] font-sans text-[#243629]">
      <div className="bg-[#DFC48C] px-4 py-2 text-center text-[11px] font-extrabold uppercase tracking-[.13em] text-[#3B331C] sm:text-xs">
        <ShieldCheck size={14} className="mr-1.5 inline-block align-[-2px]" aria-hidden="true" />
        Design preview only — orders and payments are disabled
      </div>
      <header className="border-b border-[#E7E4DA] bg-[#FBFAF6]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#28533A] text-[#F6EED7]"><Leaf size={25} strokeWidth={1.6} aria-hidden="true" /></span>
            <div>
              <p className="text-lg font-extrabold leading-tight tracking-tight text-[#23432D]">మన ఇంటి వంట</p>
              <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-stone-500">Mana Enti Vanta</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-sm font-semibold text-stone-600 sm:flex"><MapPin size={16} aria-hidden="true" /> Kollur, Hyderabad</div>
          <span className="rounded-full border border-[#E9D5AE] bg-[#FEF5DF] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#946627]">Preview V1</span>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#234431] text-[#FFFCF4]">
          <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-36 h-[460px] w-[460px] rounded-full border-[80px] border-[#355C42] opacity-70" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-52 left-1/3 h-96 w-96 rounded-full border-[70px] border-[#355C42]/70" />
          <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.4fr_0.6fr] lg:items-center lg:gap-16">
            <div>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-[#F6DEA7]"><Sparkles size={15} aria-hidden="true" /> A little home in every bite</p>
              <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">Simple food.<br /><span className="text-[#F0CE83]">Warm moments.</span></h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-[#E3EEE2] sm:text-base">Explore our planned morning and evening menu. Fresh flavours, clear prices, and the comfort of familiar food.</p>
              <div className="mt-7 flex flex-wrap gap-2.5">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold"><Clock3 size={16} aria-hidden="true" /> 24-hour pre-orders planned</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold"><ShoppingBag size={16} aria-hidden="true" /> Minimum cart {rupees(minimumCartPaisa)}</span>
              </div>
            </div>
            <div className="rounded-[28px] border border-white/20 bg-white/10 p-6 shadow-[0_24px_80px_-30px_rgba(0,0,0,.4)] backdrop-blur-sm sm:p-7">
              <p className="text-xs font-bold uppercase tracking-[.19em] text-[#EBD5AC]">Our planned delivery hours</p>
              <div className="mt-6 flex items-center gap-4 border-b border-white/15 pb-5">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F2D99E] text-[#294C36]"><Sun size={23} aria-hidden="true" /></span>
                <div><p className="text-sm font-bold">Morning</p><p className="mt-1 text-sm text-[#D9E5D6]">7:00 AM – 11:00 AM</p></div>
              </div>
              <div className="flex items-center gap-4 pt-5">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4DEC9] text-[#294C36]"><Moon size={23} aria-hidden="true" /></span>
                <div><p className="text-sm font-bold">Evening</p><p className="mt-1 text-sm text-[#D9E5D6]">6:00 PM – 8:00 PM</p></div>
              </div>
              <p className="mt-5 text-xs leading-5 text-[#D9E5D6]">All times IST · At least 30 minutes' lead time after order confirmation. Exact delivery time is not guaranteed.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-8 sm:pt-14">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#A57540]">The menu · 10 favourites</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{details.title}</h2>
              <p className="mt-2 text-sm text-stone-600">{details.subheading}</p>
            </div>
            <div role="tablist" aria-label="Meal period" className="inline-flex w-full gap-1 rounded-2xl bg-[#EBE9E0] p-1.5 sm:w-auto">
              <button type="button" role="tab" aria-selected={period === 'MORNING'} onClick={() => choosePeriod('MORNING')} className={'flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors sm:flex-none ' + (period === 'MORNING' ? 'bg-[#28533A] text-white shadow-sm' : 'text-[#425649] hover:bg-white/70')}>
                <Sun size={18} aria-hidden="true" /> Morning (6)
              </button>
              <button type="button" role="tab" aria-selected={period === 'EVENING'} onClick={() => choosePeriod('EVENING')} className={'flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors sm:flex-none ' + (period === 'EVENING' ? 'bg-[#28533A] text-white shadow-sm' : 'text-[#425649] hover:bg-white/70')}>
                <Moon size={18} aria-hidden="true" /> Evening (4)
              </button>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E1D7] pb-4 text-sm">
            <p className="inline-flex items-center gap-2 font-bold text-[#30553A]"><Coffee size={18} aria-hidden="true" /> {details.itemLabel} <span className="rounded-full bg-[#E3EBE0] px-2 py-0.5 text-xs">{items.length} items</span></p>
            <p className="inline-flex items-center gap-2 text-stone-500"><Clock3 size={16} aria-hidden="true" /> {details.slot} IST</p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6" role="tabpanel" aria-label={details.itemLabel}>
            {items.map(item => (
              <MenuCard
                key={item.id}
                item={item}
                quantity={quantities[item.id] || 0}
                onAdd={() => increment(item)}
                onLess={() => decrement(item)}
              />
            ))}
          </div>

          <div className="mt-9 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
            <aside className="rounded-[24px] border border-[#E4D6B7] bg-[#FFF7E5] p-6 sm:p-7">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#FAEAC3] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#936629]"><Sparkles size={15} aria-hidden="true" /> Coming soon</span>
              <h3 className="mt-4 text-xl font-extrabold text-[#5B4227]">Complimentary Karam Podi</h3>
              <p className="mt-2 text-sm leading-6 text-[#755B3C]">We are preparing this extra for a future release. Selection is not available in this preview.</p>
              <span className="mt-4 inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-[#E4D6B7] bg-[#FAEFD6] px-4 py-2.5 text-sm font-semibold text-[#A58A61]" aria-disabled="true">Not available yet</span>
            </aside>

            <aside className="rounded-[24px] border border-[#D9E0D4] bg-white p-6 shadow-[0_15px_40px_-28px_rgba(25,48,35,.22)] sm:p-7" aria-label="Preview cart summary">
              <div className="flex items-center justify-between gap-3">
                <h3 className="inline-flex items-center gap-2 text-xl font-extrabold text-[#23432D]"><ShoppingBag size={21} aria-hidden="true" /> Your sample basket</h3>
                <span className="rounded-full bg-[#EDF4EB] px-3 py-1 text-xs font-bold text-[#3F6B49]">Preview only</span>
              </div>
              {selected.length ? (
                <ul className="mt-5 space-y-2 text-sm" aria-label="Selected preview items">
                  {selected.map(item => (
                    <li key={item.id} className="flex justify-between gap-4 text-stone-600"><span>{item.nameEn} × {quantities[item.id]}</span><strong className="text-[#23432D]">{rupees(item.pricePaisa * (quantities[item.id] || 0))}</strong></li>
                  ))}
                </ul>
              ) : <p className="mt-5 text-sm leading-6 text-stone-500">Select a dish above to try the sample basket. Nothing will be ordered or charged.</p>}
              <div className="mt-5 flex items-center justify-between border-t border-[#E4E9E1] pt-4">
                <span className="font-semibold text-stone-600">Food subtotal</span>
                <strong className="text-2xl font-extrabold text-[#23432D]" data-testid="preview-subtotal">{rupees(subtotalPaisa)}</strong>
              </div>
              <p className={'mt-3 text-sm font-medium ' + (minRemaining > 0 ? 'text-[#9B6631]' : 'text-[#367348]')} data-testid="preview-minimum-message">
                {minRemaining > 0 ? 'Add ' + rupees(minRemaining) + ' more to reach the ' + rupees(minimumCartPaisa) + ' minimum.' : 'Sample basket meets the ' + rupees(minimumCartPaisa) + ' minimum.'}
              </p>
              <p className="mt-2 text-xs leading-5 text-stone-500">Sample basket is for design review only. Delivery charges and actual stock are not calculated here. Switching meal periods clears sample selections.</p>
              <button type="button" disabled aria-label="Checkout unavailable in design preview" className="mt-5 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-[#AAB5A9] px-5 py-3.5 text-sm font-bold text-white">
                Checkout not available yet <ArrowRight size={18} aria-hidden="true" />
              </button>
            </aside>
          </div>
          <p className="mt-8 text-center text-xs leading-5 text-stone-500">This is an inactive design preview. No food can be purchased here. The existing live customer checkout remains unchanged. New menu launch enabled: {NEW_MENU_LAUNCH_ENABLED ? 'yes' : 'no'}.</p>
        </section>
      </main>
      <footer className="border-t border-[#E7E2D5] bg-[#F0EEE5] px-5 py-7 text-center text-xs text-stone-600">
        <p className="font-bold text-[#2D543A]">మన ఇంటి వంట · Mana Enti Vanta</p>
        <p className="mt-1">Made for Kollur · Food menu design preview</p>
      </footer>
    </div>
  );
}
