export { kafka } from "./client.js";
export { TOPICS, CONSUMER_GROUP } from "./topics.js";
export type { ValidationRequested } from "./messages.js";
export {
  getProducer,
  publishValidationRequested,
  publishToDlq,
  disconnectProducer,
} from "./producer.js";
