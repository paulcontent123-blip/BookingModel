import Image from 'next/image';

export function BrandLogoMark({ className }: { className?: string }) {
  const classes = ['brand-logo-mark', className].filter(Boolean).join(' ');

  return (
    <span className={classes} aria-hidden="true">
      <Image
        src="/logo-booking-model.png"
        alt=""
        width={64}
        height={64}
        className="brand-logo-image"
      />
    </span>
  );
}
