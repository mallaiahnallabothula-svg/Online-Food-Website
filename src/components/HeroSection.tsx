import React from 'react';
import { ArrowDown, CheckCircle2, Sparkles, MapPin, Clock, ShieldCheck } from 'lucide-react';
import heroImage from '../assets/images/jowar_roti_karam_hero_1789044812092.jpg';
import brandLogo from '../assets/images/mallikarjuna_rottelu_logo_1789103187340.jpg';

interface HeroSectionProps {
  onScrollToOrder: () => void;
  isOpen: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onScrollToOrder, isOpen }) => {
  return (
    <section className="relative overflow-hidden pt-4 pb-8 sm:py-10 bg-gradient-to-b from-[#FDFBF7] via-[#FAF4EA] to-[#FDFBF7] dark:from-[#1A1816] dark:via-[#211E1A] dark:to-[#1A1816]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Telugu Brand Info & CTA */}
          <div className="lg:col-span-7 flex flex-col space-y-5">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold text-[#78350F] bg-amber-100/90 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800 font-telugu shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>స్వచ్ఛమైన గ్రామీణ సంప్రదాయ ఆహారం</span>
            </div>

            {/* Brand Heading with Logo */}
            <div className="flex items-center gap-3 sm:gap-4">
              <img
                src={brandLogo}
                alt="Sri Mallikarjuna Palle Jonna Rottelu Official Logo"
                referrerPolicy="no-referrer"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-amber-700/40 shadow-md flex-shrink-0"
              />
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-[#451A03] dark:text-amber-50 font-telugu tracking-tight leading-tight">
                  శ్రీ మల్లికార్జున <br className="hidden sm:inline" />
                  <span className="text-[#78350F] dark:text-amber-400">పల్లె జొన్న రొట్టెలు</span>
                </h1>
                <p className="text-sm sm:text-lg font-semibold text-[#8C4A26] dark:text-amber-200/90 font-telugu">
                  పక్కా పల్లెటూరి స్వచ్ఛమైన ఇంటి రుచితో, వేడివేడి జొన్న రొట్టెలు
                </p>
              </div>
            </div>

            {/* Short authentic description strictly truthful to business details */}
            <p className="text-sm sm:text-base text-stone-700 dark:text-stone-300 font-telugu leading-relaxed">
              రోజూ తాజాగా సిద్ధం చేసే మధ్యస్థ పరిమాణపు జొన్న రొట్టెలు. ప్రతి రొట్టె కేవలం <strong className="text-[#78350F] dark:text-amber-300 font-bold">₹30</strong> మాత్రమే. ప్రతి పూర్తి 5 రొట్టెలకు 50 గ్రా. ఉచిత కారం (10 రొట్టెల వరకు ఒక కారం, 10 కంటే ఎక్కువ ఆర్డర్‌లకు రెండు కారాలూ ఉచితం)!
            </p>

            {/* Key Feature Highlights Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 pt-1 font-telugu">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50/80 dark:bg-stone-800/80 border border-amber-900/10 dark:border-stone-700">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">ధర: ఒక్కొక్కటి ₹30</h4>
                  <p className="text-xs text-stone-600 dark:text-stone-400">కనీస ఆర్డర్: 5 రొట్టెలు</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50/80 dark:bg-stone-800/80 border border-amber-900/10 dark:border-stone-700">
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">ఉచిత కారాలు</h4>
                  <p className="text-xs text-stone-600 dark:text-stone-400">ప్రతి 5 రొట్టెలకు 50 గ్రా. ఉచితం</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50/80 dark:bg-stone-800/80 border border-amber-900/10 dark:border-stone-700">
                <MapPin className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">ఉచిత డెలివరీ</h4>
                  <p className="text-xs text-stone-600 dark:text-stone-400">కొల్లూరు నుండి 5 కి.మీ. పరిధిలో</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50/80 dark:bg-stone-800/80 border border-amber-900/10 dark:border-stone-700">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100">డెలివరీ సమయం</h4>
                  <p className="text-xs text-stone-600 dark:text-stone-400">సాయంత్రం 6:00 – 8:00 గంటలు</p>
                </div>
              </div>
            </div>

            {/* Prominent Telugu CTA Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={onScrollToOrder}
                id="hero-order-now-btn"
                className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base sm:text-lg font-bold text-amber-50 bg-[#78350F] hover:bg-[#8C4A26] active:scale-[0.98] transition-all shadow-lg shadow-amber-950/25 font-telugu"
              >
                <span>ఆర్డర్ చేయండి</span>
                <ArrowDown className="w-5 h-5 animate-bounce" />
              </button>

              <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400 font-telugu">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>ఆన్‌లైన్ UPI పేమెంట్ మాత్రమే. సురక్షితమైనది.</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Image with Sample Image Label */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-[#F5EBE1] dark:border-stone-800 group">
              <img
                src={heroImage}
                alt="తాజా జొన్న రొట్టెలు మరియు కరివేపాకు, అవిసె గింజల కారాలు"
                className="w-full h-auto object-cover aspect-[4/3] group-hover:scale-102 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              
              {/* Sample Presentation Label */}
              <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-md text-amber-100 text-[11px] font-medium px-2.5 py-1 rounded-md border border-white/20 font-telugu">
                నమూనా చిత్రం / Sample Presentation
              </div>

              {/* Bottom Caption Overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-4 text-white">
                <p className="text-sm font-bold font-telugu text-amber-200">
                  వేడివేడి జొన్న రొట్టెలు + కరివేపాకు కారం & అవిసె గింజల కారం
                </p>
                <p className="text-xs text-stone-300 font-telugu">
                  ప్రతి 5 రొట్టెల కొనుగోలుపై 50 గ్రాముల కారం ఉచితం!
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
