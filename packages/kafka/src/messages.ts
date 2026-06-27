/** Event emitted by the API when a new image is uploaded and needs validation. */
export interface ValidationRequested {
  imageId: string; // also the Kafka message key (per-image ordering)
  sessionId: string;
  storageKey: string; // S3 key where the original bytes live
  bucket: string;
  mimeType: string;
  originalFilename: string;
  uploadedAt: string; // ISO
  attempt?: number; // retry bookkeeping
}
