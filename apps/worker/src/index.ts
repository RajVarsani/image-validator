import "./env.js";
import { kafka, TOPICS, CONSUMER_GROUP, publishToDlq, publishValidationRequested } from "@iv/kafka";
import { prisma } from "@iv/db";
import type { ValidationRequested } from "@iv/kafka";
import { processImage } from "./process.js";

const MAX_ATTEMPTS = 3;
const consumer = kafka.consumer({ groupId: CONSUMER_GROUP, sessionTimeout: 30_000 });

async function start() {
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.VALIDATION_REQUESTED, fromBeginning: false });
  console.log(`[worker] consuming ${TOPICS.VALIDATION_REQUESTED} as group '${CONSUMER_GROUP}'`);

  await consumer.run({
    autoCommit: true, // commit after eachMessage resolves -> at-least-once
    partitionsConsumedConcurrently: 3,
    eachMessage: async ({ message }) => {
      const data = JSON.parse(message.value!.toString()) as ValidationRequested;
      const attempt = data.attempt ?? 1;
      try {
        const status = await processImage(data);
        console.log(`[worker] ${data.originalFilename} → ${status}`);
      } catch (err) {
        console.error(`[worker] failed ${data.imageId} (attempt ${attempt}):`, err);
        // Handle the error so the offset advances (never hot-loop a poison message).
        if (attempt >= MAX_ATTEMPTS) {
          await publishToDlq({ ...data, error: String(err) });
          await prisma.image
            .update({ where: { id: data.imageId }, data: { status: "FAILED" } })
            .catch(() => {});
        } else {
          await publishValidationRequested({ ...data, attempt: attempt + 1 });
        }
      }
    },
  });
}

start().catch((e) => {
  console.error("[worker] fatal:", e);
  process.exit(1);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    console.log("[worker] shutting down…");
    await consumer.disconnect().catch(() => {});
    process.exit(0);
  });
}
