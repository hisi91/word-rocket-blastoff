import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

const jsonHeaders = { "content-type": "application/json" };
const DEFAULT_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function unavailable(message: string, status = 503) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: jsonHeaders,
  });
}

export const Route = createFileRoute("/api/ping-groq")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.GROQ_API_KEY;
        if (!key) return unavailable("GROQ_API_KEY missing");

        const url = process.env.GROQ_PING_URL || DEFAULT_GROQ_URL;

        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: process.env.GROQ_PING_MODEL || "llama-3.1-8b-instant",
              messages: [{ role: "user", content: "ok" }],
              max_tokens: 1,
              temperature: 0,
            }),
          });

          if (!response.ok) {
            const body = await response.text();
            return unavailable(`Groq ${response.status}: ${body.slice(0, 160)}`);
          }

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: {
              ...jsonHeaders,
              "cache-control": "no-store",
            },
          });
        } catch (error) {
          return unavailable(error instanceof Error ? error.message : "fetch failed");
        }
      },
    },
  },
});
