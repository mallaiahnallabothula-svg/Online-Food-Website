import React from 'react';
import { ArrowDown, CheckCircle2, Sparkles, MapPin, Clock, ShieldCheck, Smartphone, Heart, Flame } from 'lucide-react';
import { BrandEmblem } from './BrandEmblem';
import { useLanguage } from '../context/LanguageContext';

interface HeroSectionProps {
  onScrollToOrder: () => void;
  isOpen: boolean;
  onOpenInstallModal?: () => void;
  isInstalled?: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ 
  onScrollToOrder, 
  isOpen, 
  onOpenInstallModal,
  isInstalled = false,
}) => {
  const { t, language } = useLanguage();

  return (
    <section className="relative overflow-hidden pt-6 pb-10 sm:py-12 bg-gradient-to-b from-[#FDFBF7] via-[#FAF4EA] to-[#FDFBF7] dark:from-[#1A1816] dark:via-[#211E1A] dark:to-[#1A1816]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Brand Info & CTA */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold text-[#78350F] bg-amber-100/90 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800 font-telugu shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>{t.badgeTraditional}</span>
            </div>

            {/* Brand Heading & Emblem */}
            <div className="flex items-center gap-4">
              <BrandEmblem size="xl" />
              <div className="space-y-1">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#451A03] dark:text-amber-50 font-telugu tracking-tight leading-tight">
                  {t.brandName}
                </h1>
                <p className="text-base sm:text-xl font-bold text-[#8C4A26] dark:text-amber-300 font-telugu">
                  {t.brandTagline}
                </p>
                <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-medium">
                  {t.brandSubtext}
                </p>
              </div>
            </div>

            {/* Short authentic description */}
            <p className="text-sm sm:text-base text-stone-700 dark:text-stone-300 font-telugu leading-relaxed">
              {t.heroDescription}
            </p>

            {/* Key Feature Highlights Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 pt-1 font-telugu">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 dark:bg-stone-800/80 border border-amber-900/10 dark:border-stone-700">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">{t.featurePriceTitle}</h4>
                  <p className="text-xs text-stone-600 dark:text-stone-400">{t.featurePriceSub}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 dark:bg-stone-800/80 border border-amber-900/10 dark:border-stone-700">
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">{t.featureKaramTitle}</h4>
                  <p className="text-xs text-stone-600 dark:text-stone-400">{t.featureKaramSub}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 dark:bg-stone-800/80 border border-amber-900/10 dark:border-stone-700">
                <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">{t.featureDeliveryTitle}</h4>
                  <p className="text-xs text-stone-600 dark:text-stone-400">{t.featureDeliverySub}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 dark:bg-stone-800/80 border border-amber-900/10 dark:border-stone-700">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">{t.featureTimeTitle}</h4>
                  <p className="text-xs text-stone-600 dark:text-stone-400">{t.featureTimeSub}</p>
                </div>
              </div>
            </div>

            {/* Clean CTA & Android App Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
              <button
                onClick={onScrollToOrder}
                id="hero-order-now-btn"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl text-base sm:text-lg font-bold text-amber-50 bg-[#78350F] hover:bg-[#8C4A26] active:scale-[0.98] transition-all shadow-lg shadow-amber-950/20 font-telugu cursor-pointer"
              >
                <span>{t.orderNowBtn}</span>
                <ArrowDown className="w-5 h-5 animate-bounce" />
              </button>

              {!isInstalled && onOpenInstallModal && (
                <button
                  onClick={onOpenInstallModal}
                  id="hero-install-app-btn"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm sm:text-base font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100/90 dark:bg-emerald-950/60 hover:bg-emerald-200 dark:hover:bg-emerald-900/80 border border-emerald-300 dark:border-emerald-700 transition-all font-telugu shadow-xs cursor-pointer"
                >
                  <Smartphone className="w-4.5 h-4.5 text-emerald-700 dark:text-emerald-400" />
                  <span>{t.androidAppBtn}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400 font-telugu">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>{t.securePaymentNote}</span>
            </div>
          </div>

          {/* Right Column: Clean Highlights Card (Zero Photos - Pristine & Fast) */}
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-[#211E1A] rounded-2xl shadow-xl border border-amber-900/15 dark:border-stone-800 p-6 sm:p-7 space-y-5">
              
              <div className="border-b border-stone-200 dark:border-stone-800 pb-4">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 text-xs font-bold font-telugu mb-2">
                  <Flame className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>{language === 'te' ? 'తాజా బ్యాచ్' : "Today's Fresh Batch"}</span>
                </div>
                <h3 className="text-xl font-bold text-[#451A03] dark:text-amber-100 font-telugu">
                  {t.highlightsTitle}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 font-telugu mt-0.5">
                  {t.highlightsSubtitle}
                </p>
              </div>

              {/* Four Clean Pillars */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-stone-800 text-[#78350F] dark:text-amber-400 flex items-center justify-center font-bold flex-shrink-0 text-sm">
                    🌾
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-telugu">
                      {t.pureIngredientsTitle}
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 font-telugu leading-relaxed">
                      {t.pureIngredientsDesc}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-stone-800 text-[#78350F] dark:text-amber-400 flex items-center justify-center font-bold flex-shrink-0 text-sm">
                    🔥
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-telugu">
                      {t.freshlyMadeTitle}
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 font-telugu leading-relaxed">
                      {t.freshlyMadeDesc}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-stone-800 text-[#78350F] dark:text-amber-400 flex items-center justify-center font-bold flex-shrink-0 text-sm">
                    🌿
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-telugu">
                      {t.healthyNutritiousTitle}
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 font-telugu leading-relaxed">
                      {t.healthyNutritiousDesc}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-stone-800 text-[#78350F] dark:text-amber-400 flex items-center justify-center font-bold flex-shrink-0 text-sm">
                    ❤️
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-telugu">
                      {t.hygienicKitchenTitle}
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-400 font-telugu leading-relaxed">
                      {t.hygienicKitchenDesc}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Trust Badge */}
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs font-medium font-telugu text-stone-600 dark:text-stone-400">
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{language === 'te' ? '100% పల్లెటూరి సంప్రదాయం' : '100% Traditional Village Craft'}</span>
                </span>
                <span className="font-mono text-[11px] text-stone-500">
                  కొల్లూరు • Kolluru
                </span>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
