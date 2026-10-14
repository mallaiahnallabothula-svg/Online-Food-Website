import React from 'react';

interface BrandEmblemProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showText?: boolean;
}

// Lightweight illustrated mark. Header copy stays managed by Header.tsx.
export const BrandEmblem: React.FC<BrandEmblemProps> = ({ size = 'md', className = '', showText = false }) => {
  const sizes = { sm: 36, md: 48, lg: 64, xl: 80, '2xl': 112 };
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src="/brand-illustration.svg" alt="" width={sizes[size]} height={sizes[size]}
        className="shrink-0 rounded-xl object-contain" aria-hidden="true" />
      {showText && (
        <span className="min-w-0">
          <span className="block font-bold leading-tight tracking-tight text-[#26231f] dark:text-amber-100">Mannu’s Cloud Kitchen</span>
          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#756f67] dark:text-stone-400">CLOUD KITCHEN · KOLLUR</span>
        </span>
      )}
    </div>
  );
};
