import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const jsonHeaders = { "content-type": "application/json" };

// Always return 200 with { text: "" } so the client never sees a 500.
// Signal upstream failures via x-stt-fallback header for client logging.
function emptyResult(reason: string, fallback = true) {
  return new Response(JSON.stringify({ text: "", error: reason, fallback }), {
    status: 200,
    headers: { ...jsonHeaders, ...(fallback ? { "x-stt-fallback": "true" } : {}) },
  });
}

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const key = process.env.GROQ_API_KEY;
        if (!key) return emptyResult("GROQ_API_KEY missing");

        let incoming: FormData;
        try {
          incoming = await request.formData();
        } catch {
          return emptyResult("Invalid form data", false);
        }

        const audio = incoming.get("audio");
        const language = (incoming.get("language") as string) || "en";
        const prompt = (incoming.get("prompt") as string) || "";

        if (!(audio instanceof Blob)) return emptyResult("Missing audio", false);
        if (audio.size > 5 * 1024 * 1024) return emptyResult("Audio too large", false);

        const filename = audio.type.includes("webm") ? "speech.webm" : "speech.wav";
        const primaryModel = process.env.GROQ_TRANSCRIBE_MODEL || "whisper-large-v3-turbo";
        const fallbackModel = "whisper-large-v3";

        const buildFormData = (model: string) => {
          const fd = new FormData();
          fd.append("file", audio, filename);
          fd.append("model", model);
          fd.append("language", language);
          fd.append("response_format", "json");
          fd.append("temperature", "0");
          if (prompt) fd.append("prompt", prompt);
          return fd;
        };

        const sendToGroq = (model: string) =>
          fetch(GROQ_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: buildFormData(model),
          });

        try {
          let res = await sendToGroq(primaryModel);
          let text = await res.text();
          if (!res.ok && primaryModel !== fallbackModel) {
            res = await sendToGroq(fallbackModel);
            text = await res.text();
          }
          if (!res.ok) return emptyResult(`Groq ${res.status}: ${text.slice(0, 200)}`);
          return new Response(text, { status: 200, headers: jsonHeaders });
        } catch (err) {
          return emptyResult(err instanceof Error ? err.message : "fetch failed");
        }
      },
    },
  },
});
