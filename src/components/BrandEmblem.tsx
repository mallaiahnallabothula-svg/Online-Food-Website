import React from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface BrandEmblemProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

export const BrandEmblem: React.FC<BrandEmblemProps> = ({
  size = 'md',
  className = '',
  showText = false,
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
    xl: 'w-10 h-10',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-[#78350F] to-[#451A03] text-amber-100 flex items-center justify-center font-extrabold shadow-md shadow-amber-950/20 border border-amber-500/30 flex-shrink-0 select-none`}
        title="మన ఇంటి వంట (Mana Enti Vanta)"
      >
        <span className="font-telugu font-bold text-amber-100">
          మన
        </span>
      </div>

      {showText && (
        <div className="space-y-0.5">
          <h2 className="font-extrabold font-telugu text-[#451A03] dark:text-amber-100 leading-tight">
            మన ఇంటి వంట
          </h2>
          <p className="text-[11px] font-medium text-amber-800/80 dark:text-amber-300/80 font-telugu">
            అచ్చమైన పల్లెటూరి రుచులు
          </p>
        </div>
      )}
    </div>
  );
};
