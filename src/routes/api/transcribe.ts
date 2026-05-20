import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.GROQ_API_KEY;
        if (!key) {
          return new Response(JSON.stringify({ error: "GROQ_API_KEY missing" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        let incoming: FormData;
        try {
          incoming = await request.formData();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid form data" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const audio = incoming.get("audio");
        const language = (incoming.get("language") as string) || "en";
        const prompt = (incoming.get("prompt") as string) || "";

        if (!(audio instanceof Blob)) {
          return new Response(JSON.stringify({ error: "Missing audio" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (audio.size > 5 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "Audio too large" }), {
            status: 413,
            headers: { "content-type": "application/json" },
          });
        }

        const fd = new FormData();
        fd.append("file", audio, "speech.webm");
        fd.append("model", "whisper-large-v3");
        fd.append("language", language);
        fd.append("response_format", "json");
        fd.append("temperature", "0");
        if (prompt) fd.append("prompt", prompt);

        try {
          const res = await fetch(GROQ_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: fd,
          });
          const text = await res.text();
          if (!res.ok) {
            return new Response(
              JSON.stringify({ error: `Groq ${res.status}: ${text.slice(0, 200)}` }),
              { status: 502, headers: { "content-type": "application/json" } },
            );
          }
          return new Response(text, {
            status: 200,
            headers: { "content-type": "application/json" },
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
