import React from 'react';

interface BrandEmblemProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showText?: boolean;
}

// Simple text monogram replaces the photo logo everywhere it was used.
export const BrandEmblem: React.FC<BrandEmblemProps> = ({ size = 'md', className = '', showText = false }) => {
  const sizes = {
    sm: 'h-9 w-9 text-xl', md: 'h-12 w-12 text-2xl',
    lg: 'h-16 w-16 text-3xl', xl: 'h-20 w-20 text-4xl',
    '2xl': 'h-28 w-28 text-5xl',
  };
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <span aria-hidden="true" className={`${sizes[size]} inline-flex shrink-0 select-none items-center justify-center rounded-full bg-[#a34636] font-serif font-normal leading-none text-[#fffaf4]`}>
        మ
      </span>
      {showText && (
        <span className="min-w-0">
          <span className="block font-bold leading-tight tracking-tight text-[#26231f] dark:text-amber-100">Mana Enti Vanta</span>
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#756f67] dark:text-stone-400">HOME KITCHEN · KOLLUR</span>
        </span>
      )}
    </div>
  );
};
