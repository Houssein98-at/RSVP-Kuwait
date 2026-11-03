import React from 'react';
import backgroundCardUrl from '../assets/background_card.jpg';

export const QURAN_VERSE_TEXT =
  'وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً ۚ';

interface QrCardBackgroundProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  dir?: 'rtl' | 'ltr';
}

/**
 * Reusable background wrapper for all QR code cards across the application.
 * Displays the `background_card.jpg` asset with `object-cover` / `bg-cover`
 * positioning so it never stretches, distorts, or crops awkwardly across screen sizes,
 * while preserving consistent border styling and contrast for inner content and QR codes.
 */
export const QrCardBackground: React.FC<QrCardBackgroundProps> = ({
  children,
  className = '',
  innerClassName = '',
  dir,
}) => {
  return (
    <div
      className={`relative overflow-hidden bg-cover bg-center bg-no-repeat shadow-luxury text-center ${className}`}
      style={{
        backgroundImage: `url(${backgroundCardUrl})`,
      }}
    >
      {/* Ornate Inner Frame */}
      <div
        className={`relative z-10 ${innerClassName}`}
        dir={dir}
      >
        {children}
      </div>
    </div>
  );
};

export { backgroundCardUrl };

