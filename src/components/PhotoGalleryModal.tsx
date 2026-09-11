import React, { useState } from 'react';
import { X, Download, ChevronLeft, ChevronRight, Check, Image as ImageIcon, Sparkles, ExternalLink } from 'lucide-react';
import { ORIGINAL_PHOTOS, OriginalPhoto } from '../data/originalPhotos';

interface PhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPhotoId?: string;
}

export const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({
  isOpen,
  onClose,
  initialPhotoId,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (initialPhotoId) {
      const idx = ORIGINAL_PHOTOS.findIndex((p) => p.id === initialPhotoId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadAllProgress, setDownloadAllProgress] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentPhoto: OriginalPhoto = ORIGINAL_PHOTOS[currentIndex] || ORIGINAL_PHOTOS[0];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % ORIGINAL_PHOTOS.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + ORIGINAL_PHOTOS.length) % ORIGINAL_PHOTOS.length);
  };

  const downloadSinglePhoto = async (photo: OriginalPhoto) => {
    try {
      setDownloadingId(photo.id);
      const response = await fetch(photo.src);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = photo.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      // Fallback direct link
      const link = document.createElement('a');
      link.href = photo.src;
      link.download = photo.filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setTimeout(() => setDownloadingId(null), 800);
    }
  };

  const downloadAllPhotos = async () => {
    setDownloadAllProgress(true);
    for (let i = 0; i < ORIGINAL_PHOTOS.length; i++) {
      const photo = ORIGINAL_PHOTOS[i];
      try {
        const response = await fetch(photo.src);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = photo.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        // Stagger downloads to avoid browser block
        await new Promise((resolve) => setTimeout(resolve, 350));
      } catch (err) {
        console.error('Download error for', photo.filename, err);
      }
    }
    setDownloadAllProgress(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md transition-opacity">
      <div 
        className="relative w-full max-w-5xl bg-white dark:bg-[#1C1A17] rounded-2xl shadow-2xl border border-amber-900/20 dark:border-stone-800 overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-amber-900/10 dark:border-stone-800 bg-[#FAF4EA]/80 dark:bg-[#211E1A]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-200/70 dark:bg-amber-950/60 text-[#78350F] dark:text-amber-300">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-[#451A03] dark:text-amber-100 font-telugu">
                అసలైన ఫోటోల గ్యాలరీ & డౌన్‌లోడ్
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-telugu">
                శ్రీ మల్లికార్జున పల్లె జొన్న రొట్టెలు • ఒరిజినల్ హై-క్వాలిటీ చిత్రాలు
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadAllPhotos}
              disabled={downloadAllProgress}
              id="download-all-photos-modal-btn"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-50 bg-[#78350F] hover:bg-[#8C4A26] disabled:opacity-50 transition-all font-telugu shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadAllProgress ? 'డౌన్‌లోడ్ అవుతున్నాయి...' : `అన్ని ఫోటోలు డౌన్‌లోడ్ (${ORIGINAL_PHOTOS.length})`}</span>
            </button>

            <button
              onClick={onClose}
              id="close-gallery-modal-btn"
              className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content: Stage and Info */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Main Photo Display Stage */}
          <div className="lg:col-span-8 flex flex-col items-center justify-center relative">
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-stone-900 border border-stone-800 flex items-center justify-center shadow-inner group">
              <img
                src={currentPhoto.src}
                alt={currentPhoto.titleTe}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />

              {/* Tag Badge */}
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs text-amber-200 text-xs font-bold px-3 py-1 rounded-full border border-white/20 font-telugu">
                {currentPhoto.tag}
              </div>

              {/* Resolution Badge */}
              <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-xs text-stone-300 text-[11px] font-mono px-2 py-0.5 rounded border border-white/10">
                {currentPhoto.resolution}
              </div>

              {/* Prev / Next Navigation buttons on Stage */}
              <button
                onClick={handlePrev}
                id="gallery-prev-btn"
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white transition-transform hover:scale-110 shadow-lg cursor-pointer"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={handleNext}
                id="gallery-next-btn"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white transition-transform hover:scale-110 shadow-lg cursor-pointer"
                aria-label="Next photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Photo Counter */}
            <div className="mt-2 text-xs font-medium text-stone-500 font-mono">
              {currentIndex + 1} of {ORIGINAL_PHOTOS.length}
            </div>
          </div>

          {/* Details & Download Options */}
          <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold text-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 font-telugu">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>ఒరిజినల్ ఫోటో (100% అసలైనది)</span>
              </div>

              <h4 className="text-xl font-extrabold text-stone-900 dark:text-stone-100 font-telugu leading-snug">
                {currentPhoto.titleTe}
              </h4>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-sans font-medium">
                {currentPhoto.titleEn}
              </p>

              <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-stone-800/60 border border-amber-900/10 dark:border-stone-700 text-xs text-stone-700 dark:text-stone-300 font-telugu leading-relaxed">
                {currentPhoto.descriptionTe}
              </div>

              <div className="text-xs text-stone-500 font-mono space-y-1 pt-1">
                <div>ఫైల్ పేరు: <span className="text-stone-700 dark:text-stone-300 font-bold">{currentPhoto.filename}</span></div>
                <div>రిజల్యూషన్: <span className="text-stone-700 dark:text-stone-300 font-bold">{currentPhoto.resolution}</span></div>
                <div>ఫార్మాట్: <span className="text-stone-700 dark:text-stone-300 font-bold">JPG (High Quality)</span></div>
              </div>
            </div>

            {/* Download Button for current photo */}
            <div className="pt-3 border-t border-stone-200 dark:border-stone-800 space-y-2">
              <button
                onClick={() => downloadSinglePhoto(currentPhoto)}
                id="download-single-photo-btn"
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-amber-50 bg-[#78350F] hover:bg-[#8C4A26] transition-all shadow-md font-telugu cursor-pointer"
              >
                {downloadingId === currentPhoto.id ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300 animate-bounce" />
                    <span>డౌన్‌లోడ్ అవుతోంది...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>ఈ ఫోటో డౌన్‌లోడ్ చేసుకోండి</span>
                  </>
                )}
              </button>

              <button
                onClick={downloadAllPhotos}
                disabled={downloadAllProgress}
                className="sm:hidden w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#78350F] dark:text-amber-200 bg-amber-100 dark:bg-stone-800 border border-amber-300 dark:border-stone-700 font-telugu"
              >
                <Download className="w-3.5 h-3.5" />
                <span>అన్ని {ORIGINAL_PHOTOS.length} ఫోటోలు డౌన్‌లోడ్</span>
              </button>
            </div>
          </div>
        </div>

        {/* Thumbnail Filmstrip */}
        <div className="p-3 sm:p-4 border-t border-amber-900/10 dark:border-stone-800 bg-[#FAF4EA]/50 dark:bg-[#181614] overflow-x-auto">
          <div className="flex items-center gap-3">
            {ORIGINAL_PHOTOS.map((photo, index) => (
              <button
                key={photo.id}
                onClick={() => setCurrentIndex(index)}
                id={`thumb-${photo.id}`}
                className={`relative rounded-xl overflow-hidden flex-shrink-0 w-20 h-16 sm:w-24 sm:h-18 border-2 transition-all cursor-pointer ${
                  currentIndex === index
                    ? 'border-[#78350F] ring-2 ring-[#78350F]/40 scale-105 shadow-md'
                    : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={photo.src}
                  alt={photo.titleTe}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-x-0 bottom-0 bg-black/75 py-0.5 px-1 text-[9px] font-bold text-amber-200 truncate font-telugu text-center">
                  {photo.tag}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
