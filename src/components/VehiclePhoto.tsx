import Image from "next/image";
import clsx from "clsx";
import { getVehiclePhoto } from "@/lib/vehiclePhoto";

type Variant = "thumb" | "card" | "hero";

interface VehiclePhotoProps {
  make: string;
  model: string;
  variant?: Variant;
  /** Pass `priority` on above-the-fold images (e.g. detail-page hero). */
  priority?: boolean;
  className?: string;
}

const VARIANTS: Record<Variant, {
  width: number;
  height: number;
  sizes: string;
  rounded: string;
  containerClass: string;
}> = {
  thumb: {
    width: 56,
    height: 40,
    sizes: "56px",
    rounded: "rounded-lg",
    containerClass: "w-14 h-10",
  },
  card: {
    width: 640,
    height: 360,
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px",
    rounded: "rounded-lg",
    containerClass: "w-full aspect-[16/9]",
  },
  hero: {
    width: 1280,
    height: 720,
    sizes: "(max-width: 1024px) 100vw, 780px",
    rounded: "rounded-xl",
    containerClass: "w-full aspect-[16/9]",
  },
};

export default function VehiclePhoto({
  make,
  model,
  variant = "thumb",
  priority = false,
  className,
}: VehiclePhotoProps) {
  const src = getVehiclePhoto(make, model);
  const v = VARIANTS[variant];

  if (!src) {
    return (
      <div
        className={clsx(
          v.containerClass,
          v.rounded,
          "bg-ink-100 flex items-center justify-center",
          className
        )}
        aria-label={`${make} ${model}`}
      >
        <svg viewBox="0 0 240 100" className="w-10 h-5 fill-ink-300" aria-hidden="true">
          <path d="M30 65 L30 55 Q32 45 50 40 L80 30 Q100 20 130 20 L165 20 Q185 20 200 30 L215 40 Q225 45 225 55 L225 65 Q220 70 210 70 L200 70 Q198 60 185 60 Q172 60 170 70 L80 70 Q78 60 65 60 Q52 60 50 70 L40 70 Q30 70 30 65 Z" />
          <circle cx="65" cy="70" r="12" />
          <circle cx="185" cy="70" r="12" />
        </svg>
      </div>
    );
  }

  return (
    <div className={clsx(v.containerClass, v.rounded, "relative overflow-hidden bg-ink-100", className)}>
      <Image
        src={src}
        alt={`${make} ${model}`}
        fill
        sizes={v.sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
