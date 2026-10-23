'use client';

import { useState } from 'react';

/** Màu nước theo tên món, dùng cho hình minh hoạ khi không có / lỗi ảnh. */
export function drinkTint(name: string): { liquid: string; bg: string } {
  const n = name.toLowerCase();
  if (n.includes('matcha') || n.includes('trà xanh')) return { liquid: '#8fb35f', bg: '#e3ecd5' };
  if (n.includes('đào') || n.includes('cam')) return { liquid: '#f0a066', bg: '#fbe6d4' };
  if (n.includes('cappuccino') || n.includes('latte')) return { liquid: '#c89a6c', bg: '#f1e4d6' };
  if (n.includes('cà phê') || n.includes('coffee')) return { liquid: '#6e4528', bg: '#eadccd' };
  if (n.includes('hồng trà') || n.includes('bí đao')) return { liquid: '#b8662e', bg: '#f6e6d6' };
  if (n.includes('sữa')) return { liquid: '#d9b98f', bg: '#f3eadf' };
  return { liquid: '#a8c47f', bg: '#e3ecd5' };
}

/** Ly nhựa có nắp vòm – minh hoạ đơn giản. */
export function CupIllustration({
  liquid,
  pearls = false,
  cream = false,
  className = '',
}: {
  liquid: string;
  pearls?: boolean;
  cream?: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 120 160" className={className} aria-hidden="true">
      {/* ống hút */}
      <rect x="66" y="0" width="9" height="62" rx="3" fill="#2d5a3a" transform="rotate(12 70 40)" />
      {/* nắp */}
      <path d="M22 44 Q60 14 98 44 Z" fill="#ffffff" fillOpacity="0.85" stroke="#18241c" strokeOpacity="0.15" />
      <rect x="16" y="42" width="88" height="8" rx="4" fill="#ffffff" stroke="#18241c" strokeOpacity="0.15" />
      {/* thân ly */}
      <path d="M22 50 L32 152 Q33 158 39 158 L81 158 Q87 158 88 152 L98 50 Z" fill="#ffffff" fillOpacity="0.55" />
      <path d="M25 66 L33.5 150 Q34 154 39 154 L81 154 Q86 154 86.5 150 L95 66 Z" fill={liquid} />
      {cream && <path d="M24.5 62 L95.5 62 L94.5 74 Q60 82 25.7 74 Z" fill="#fffaf2" />}
      {pearls && (
        <g fill="#3a2414">
          {[
            [44, 146], [54, 148], [64, 147], [74, 146], [49, 139], [59, 140],
            [69, 139], [79, 140], [42, 137], [54, 132], [64, 133],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4.6" />
          ))}
        </g>
      )}
      {/* vệt sáng */}
      <path d="M33 70 L40 140" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Ảnh món từ `imageUrl`; nếu không có hoặc tải lỗi thì hiện hình ly minh hoạ
 * cùng tông màu, để menu không bao giờ có ô trống.
 */
export function DrinkImage({
  name,
  imageUrl,
  className = '',
  pearls,
  cream,
}: {
  name: string;
  imageUrl?: string;
  className?: string;
  pearls?: boolean;
  cream?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const tint = drinkTint(name);
  const showImage = imageUrl && failedUrl !== imageUrl;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundColor: tint.bg }}
    >
      {showImage ? (
        // Ảnh từ nhiều tên miền khác nhau nên dùng <img> thay vì next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          onError={() => setFailedUrl(imageUrl)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-end justify-center pt-[12%]">
          <CupIllustration liquid={tint.liquid} pearls={pearls} cream={cream} className="h-[82%] w-auto" />
        </div>
      )}
    </div>
  );
}

/** Ly cho bộ chọn size: cao dần theo S / M / L. */
export function SizeCup({ size, active }: { size: 'S' | 'M' | 'L'; active: boolean }) {
  const h = size === 'S' ? 30 : size === 'M' ? 38 : 46;
  return (
    <svg viewBox="0 0 40 50" className="h-12 w-10" aria-hidden="true">
      <path
        d={`M${8} ${50 - h} L${12} 48 Q12.5 50 15 50 L25 50 Q27.5 50 28 48 L${32} ${50 - h} Z`}
        fill={active ? 'var(--leaf)' : 'transparent'}
        stroke={active ? 'var(--leaf)' : 'var(--muted)'}
        strokeWidth="2"
        strokeLinejoin="round"
        className="transition-colors"
      />
      <rect
        x="6"
        y={50 - h - 4}
        width="28"
        height="4"
        rx="2"
        fill={active ? 'var(--leaf-deep)' : 'var(--muted)'}
      />
    </svg>
  );
}
