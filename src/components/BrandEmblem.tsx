import React from 'react';
import logoImage from '../assets/images/mana_enti_vanta_logo_1789296509537.jpg';

interface BrandEmblemProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showText?: boolean;
}

export const BrandEmblem: React.FC<BrandEmblemProps> = ({
  size = 'md',
  className = '',
  showText = false,
}) => {
  const sizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
    '2xl': 'w-28 h-28',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden shadow-md shadow-amber-950/20 border-2 border-amber-600/40 dark:border-amber-500/30 flex-shrink-0 select-none bg-amber-50`}
        title="మన ఇంటి వంట (Mana Enti Vanta) Rotis"
      >
        <img
          src={logoImage}
          alt="మన ఇంటి వంట - అచ్చమైన పల్లెటూరి రుచులు"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
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
