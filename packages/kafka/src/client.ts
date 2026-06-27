import { Kafka, logLevel } from "kafkajs";

export const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID ?? "image-validator",
  brokers: (process.env.KAFKA_BROKERS ?? "localhost:9292").split(","),
  logLevel: logLevel.NOTHING,
  retry: { retries: 8, initialRetryTime: 300 },
});
