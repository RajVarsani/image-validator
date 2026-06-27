import { useState } from "react";
import UploadDropzone from "./upload-dropzone/index.js";
import ResultsToolbar from "./results-toolbar/index.js";
import ResultGrid from "./result-grid/index.js";
import ImageDetail from "./image-detail/index.js";
import { useImages, useUploadImages } from "./queries.js";
import type { FilterTab, ImageDto } from "./types.js";

export default function Validator({ sessionId }: { sessionId: string }) {
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { images, counts, refresh } = useImages(sessionId, filter);
  const { upload, isUploading } = useUploadImages();

  async function onUpload(files: File[]) {
    await upload(sessionId, files);
    refresh();
  }

  const detail: ImageDto | null = selectedId
    ? (images.find((i) => i.id === selectedId) ?? null)
    : null;

  return (
    <div className="flex flex-col gap-7">
      <UploadDropzone onUpload={onUpload} isUploading={isUploading} />
      <ResultsToolbar filter={filter} onFilter={setFilter} counts={counts} />
      <ResultGrid images={images} onSelect={(img) => setSelectedId(img.id)} />
      {detail && <ImageDetail image={detail} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
