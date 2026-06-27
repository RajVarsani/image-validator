import ImageCard from "./image-card/index.js";
import type { ImageDto } from "../types.js";

interface Props {
  images: ImageDto[];
  onSelect: (img: ImageDto) => void;
}

export default function ResultGrid({ images, onSelect }: Props) {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border py-20 text-center">
        <span className="text-base font-semibold text-ink">No photos yet</span>
        <span className="max-w-sm text-sm text-muted">
          Drop some photos above. We'll check each one and sort them here as they finish.
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-4">
      {images.map((img) => (
        <ImageCard key={img.id} image={img} onClick={() => onSelect(img)} />
      ))}
    </div>
  );
}
