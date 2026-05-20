import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

const GROQ_TTS_URL = "https://api.groq.com/openai/v1/audio/speech";

// PlayAI voices (English). See https://console.groq.com/docs/text-to-speech
const ALLOWED_VOICES = new Set([
  "Arista-PlayAI", "Atlas-PlayAI", "Basil-PlayAI", "Briggs-PlayAI",
  "Calum-PlayAI", "Celeste-PlayAI", "Cheyenne-PlayAI", "Chip-PlayAI",
  "Cillian-PlayAI", "Deedee-PlayAI", "Fritz-PlayAI", "Gail-PlayAI",
  "Indigo-PlayAI", "Mamaw-PlayAI", "Mason-PlayAI", "Mikail-PlayAI",
  "Mitch-PlayAI", "Quinn-PlayAI", "Thunder-PlayAI",
]);

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.GROQ_API_KEY;
        if (!key) {
          return new Response(JSON.stringify({ error: "GROQ_API_KEY missing" }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }
        let body: { text?: string; voice?: string };
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400, headers: { "content-type": "application/json" },
          });
        }
        const text = (body.text || "").toString().trim();
        const voice = ALLOWED_VOICES.has(body.voice || "") ? body.voice! : "Celeste-PlayAI";
        if (!text || text.length > 300) {
          return new Response(JSON.stringify({ error: "Invalid text" }), {
            status: 400, headers: { "content-type": "application/json" },
          });
        }
        try {
          const res = await fetch(GROQ_TTS_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "playai-tts",
              voice,
              input: text,
              response_format: "wav",
            }),
          });
          if (!res.ok) {
            const errText = await res.text();
            return new Response(
              JSON.stringify({ error: `Groq ${res.status}: ${errText.slice(0, 200)}` }),
              { status: 502, headers: { "content-type": "application/json" } },
            );
          }
          const buf = await res.arrayBuffer();
          return new Response(buf, {
            status: 200,
            headers: {
              "content-type": "audio/wav",
              "cache-control": "public, max-age=86400",
            },
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "fetch failed" }),
            { status: 502, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
