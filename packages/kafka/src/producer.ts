import type { Producer } from "kafkajs";
import { kafka } from "./client.js";
import { TOPICS } from "./topics.js";
import type { ValidationRequested } from "./messages.js";

let producer: Producer | undefined;
let connecting: Promise<Producer> | undefined;

export async function getProducer(): Promise<Producer> {
  if (producer) return producer;
  if (!connecting) {
    const p = kafka.producer({ allowAutoTopicCreation: false, idempotent: true });
    connecting = p.connect().then(() => {
      producer = p;
      return p;
    });
  }
  return connecting;
}

export async function publishValidationRequested(msg: ValidationRequested): Promise<void> {
  const p = await getProducer();
  await p.send({
    topic: TOPICS.VALIDATION_REQUESTED,
    messages: [
      {
        key: msg.imageId, // same image -> same partition -> ordered
        value: JSON.stringify(msg),
        headers: { "content-type": "application/json" },
      },
    ],
    acks: -1,
  });
}

export async function publishToDlq(msg: ValidationRequested & { error: string }): Promise<void> {
  const p = await getProducer();
  await p.send({
    topic: TOPICS.VALIDATION_DLQ,
    messages: [{ key: msg.imageId, value: JSON.stringify(msg) }],
  });
}

export async function disconnectProducer(): Promise<void> {
  if (producer) await producer.disconnect();
  producer = undefined;
  connecting = undefined;
}
