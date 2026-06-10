import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

const jsonHeaders = { "content-type": "application/json" };
const DEFAULT_LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function unavailable(message: string, status = 503) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: jsonHeaders,
  });
}

export const Route = createFileRoute("/api/ping-ai")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return unavailable("LOVABLE_API_KEY missing");

        const url = process.env.LOVABLE_AI_PING_URL || DEFAULT_LOVABLE_AI_URL;

        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: process.env.LOVABLE_AI_PING_MODEL || "gpt-4o-mini",
              messages: [{ role: "user", content: "ok" }],
              max_tokens: 1,
              temperature: 0,
            }),
          });

          if (!response.ok) {
            const body = await response.text();
            return unavailable(`Lovable AI ${response.status}: ${body.slice(0, 160)}`);
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
