import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import generateWordHandler from "./api/generate-word.js";

const PORT = process.env.PORT || 3000;

async function start() {
  const app = express();
  app.use(express.json());

  // Same handler code Vercel runs in production — reused here for local dev.
  app.post("/api/generate-word", (req, res) => generateWordHandler(req, res));

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);

  app.listen(PORT, () => {
    console.log(`Vault Cracker running at http://localhost:${PORT}`);
    console.log(
      process.env.GEMINI_API_KEY
        ? "GEMINI_API_KEY loaded — AI words are live."
        : "WARNING: GEMINI_API_KEY not set in .env — falling back to offline words."
    );
  });
}

start();
