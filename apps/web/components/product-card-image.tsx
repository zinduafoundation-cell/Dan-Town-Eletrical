"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductCardImage({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <div className="product-shape" aria-hidden="true" />;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 240px"
      className="product-card-image"
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}
