import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

const GROQ_TTS_URL = "https://api.groq.com/openai/v1/audio/speech";
const jsonHeaders = { "content-type": "application/json" };

function ttsUnavailable(message: string) {
  return new Response(JSON.stringify({ audio: false, fallback: true, error: message }), {
    status: 200,
    headers: { ...jsonHeaders, "x-tts-fallback": "true" },
  });
}

// Orpheus voices (English). See https://console.groq.com/docs/text-to-speech/orpheus
const ALLOWED_VOICES = new Set([
  "autumn", "diana", "hannah", "austin", "daniel", "troy",
]);

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.GROQ_API_KEY;
        if (!key) {
          return ttsUnavailable("GROQ_API_KEY missing");
        }
        let body: { text?: string; voice?: string };
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400, headers: jsonHeaders,
          });
        }
        const text = (body.text || "").toString().trim();
        const voice = ALLOWED_VOICES.has(body.voice || "") ? body.voice! : "hannah";
        if (!text || text.length > 300) {
          return new Response(JSON.stringify({ error: "Invalid text" }), {
            status: 400, headers: jsonHeaders,
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
              model: "canopylabs/orpheus-v1-english",
              voice,
              input: text,
              response_format: "wav",
            }),
          });
          if (!res.ok) {
            const errText = await res.text();
            return ttsUnavailable(`Groq ${res.status}: ${errText.slice(0, 200)}`);
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
          return ttsUnavailable(err instanceof Error ? err.message : "fetch failed");
        }
      },
    },
  },
});
