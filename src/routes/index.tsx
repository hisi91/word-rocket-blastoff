import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "word-rocket-home") return;
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      frame.src = "about:blank";
      window.setTimeout(() => { frame.src = "/word-rocket.html"; }, 0);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src="/word-rocket.html"
      title="Word Rocket"
      style={{ width: "100%", height: "100vh", border: "none", display: "block" }}
    />
  );
}
