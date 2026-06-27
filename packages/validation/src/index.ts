export { validateImage } from "./run.js";
export type { ValidateOptions } from "./run.js";
export { THRESHOLDS } from "./config.js";
export { hammingDistance, perceptualHash } from "./checks/phash.js";
export { blurScore } from "./checks/blur.js";
export { detectFaces } from "./checks/face.js";
export type {
  ValidationResult,
  CheckResult,
  RejectionReason,
  CheckKey,
  Metrics,
  DuplicateLookup,
} from "./types.js";
