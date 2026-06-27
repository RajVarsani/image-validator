import "./env.js";
import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { router as imagesRouter } from "./routes/images.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "api" }));
app.use("/api", imagesRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "file too large" });
  console.error("[api] error:", err?.message ?? err);
  res.status(500).json({ error: "internal error" });
});

app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}`);
});
