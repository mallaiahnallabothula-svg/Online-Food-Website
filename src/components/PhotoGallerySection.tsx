import React from 'react';
import { Eye, Sparkles, CheckCircle2 } from 'lucide-react';
import { ORIGINAL_PHOTOS } from '../data/originalPhotos';

interface PhotoGallerySectionProps {
  onOpenModal: (photoId?: string) => void;
}

export const PhotoGallerySection: React.FC<PhotoGallerySectionProps> = ({ onOpenModal }) => {
  return (
    <section className="py-12 bg-[#FAF4EA]/70 dark:bg-[#1C1A17] border-y border-amber-900/10 dark:border-stone-800" id="original-photos-section">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header with Title & View Gallery CTA */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 border border-emerald-300 font-telugu">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>100% అసలైన ఫోటోలు / Original Authentic Photos</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#451A03] dark:text-amber-100 font-telugu tracking-tight">
              మా వంటశాల అసలైన ఫోటోలు
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-300 font-telugu max-w-2xl">
              స్వచ్ఛమైన పల్లెటూరి జొన్న రొట్టెలు, సంప్రదాయ కాల్పు మరియు సహజ సిద్ధమైన కరివేపాకు, అవిసె గింజల కారాల ఒరిజినల్ చిత్రాలు.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenModal()}
              id="gallery-section-view-all-btn"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-amber-50 bg-[#78350F] hover:bg-[#8C4A26] transition-all shadow-md font-telugu cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>పూర్తి గ్యాలరీని చూడండి ({ORIGINAL_PHOTOS.length})</span>
            </button>
          </div>
        </div>

        {/* Photos Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {ORIGINAL_PHOTOS.slice(0, 4).map((photo) => (
            <div
              key={photo.id}
              onClick={() => onOpenModal(photo.id)}
              className="group bg-white dark:bg-stone-900 rounded-2xl overflow-hidden border border-amber-900/10 dark:border-stone-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer"
            >
              {/* Image Box */}
              <div className="relative aspect-[4/3] overflow-hidden bg-stone-100 dark:bg-stone-800">
                <img
                  src={photo.src}
                  alt={photo.titleTe}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Category Tag Badge */}
                <div className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-xs text-amber-200 text-[11px] font-bold px-2.5 py-0.5 rounded-md font-telugu">
                  {photo.tag}
                </div>

                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/75 backdrop-blur-md text-xs font-bold font-telugu">
                    <Eye className="w-3.5 h-3.5" />
                    <span>పెద్దదిగా చూడండి</span>
                  </div>
                </div>
              </div>

              {/* Photo Information */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 font-telugu line-clamp-1">
                    {photo.titleTe}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 font-sans mt-0.5">
                    {photo.titleEn}
                  </p>
                  <p className="text-xs text-stone-600 dark:text-stone-300 font-telugu mt-1.5 line-clamp-2 leading-relaxed">
                    {photo.descriptionTe}
                  </p>
                </div>

                <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-stone-400 dark:text-stone-500 uppercase">
                    {photo.resolution}
                  </span>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#78350F] dark:text-amber-300 group-hover:underline font-telugu">
                    <Eye className="w-3.5 h-3.5" />
                    <span>వీక్షించండి</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Verification banner */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 font-telugu">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>ఈ వెబ్‌సైట్‌లోని చిత్రాలన్నీ శ్రీ మల్లికార్జున పల్లె జొన్న రొట్టెల ప్రత్యక్ష అసలైన ఛాయాచిత్రాలు.</span>
          </div>
          <button
            onClick={() => onOpenModal()}
            className="font-bold underline hover:text-emerald-700 dark:hover:text-emerald-100 flex-shrink-0 cursor-pointer"
          >
            పూర్తి గ్యాలరీని వీక్షించండి →
          </button>
        </div>
      </div>
    </section>
  );
};
