import React from 'react';

interface VathmosLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showFrame?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<VathmosLogoProps['size']>, string> = {
  xs: 'w-7 h-7',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export const VathmosLogo: React.FC<VathmosLogoProps> = ({
  size = 'md',
  showFrame = true,
  className = '',
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      fill="none"
      aria-label="Vathmos"
      role="img"
      className={`${SIZE_CLASSES[size]} shrink-0 select-none ${className}`.trim()}
    >
      {showFrame && (
        <rect
          x="1"
          y="1"
          width="38"
          height="38"
          rx="9"
          fill="#0B1120"
          stroke="#1E293B"
          strokeWidth="1.5"
        />
      )}
      {/* Stepped rubric bars forming left descending arm (vathmos = calibrated step/degree) */}
      <path d="M8.5 10.5H14.3L16.4 15.0H10.6Z" fill="#F8FAFC" />
      <path d="M11.6 17.2H17.4L19.5 21.7H13.7Z" fill="#E2E8F0" />
      <path d="M14.7 23.9H19.83L17.3 29.5Z" fill="#94A3B8" />
      {/* Ascending verification stroke forming right arm */}
      <path d="M17.3 29.5H22.7L31.5 10.5H25.9L17.3 29.5Z" fill="#38BDF8" />
    </svg>
  );
};
