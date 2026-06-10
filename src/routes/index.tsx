import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { ConnectionIndicator } from "@/components/ConnectionIndicator";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [gameScreen, setGameScreen] = useState("START");
  const [gamePaused, setGamePaused] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;

      if (event.data?.type === "word-rocket-state") {
        setGameScreen(String(event.data.screen || "START"));
        setGamePaused(Boolean(event.data.paused));
        return;
      }

      if (event.data?.type !== "word-rocket-home") return;

      setGameScreen("START");
      setGamePaused(false);
      frame.src = "about:blank";
      window.setTimeout(() => {
        frame.src = "/word-rocket.html";
      }, 0);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const showConnectionIndicator =
    (gameScreen === "PLAYING" || gameScreen === "LEVEL_INTRO") && !gamePaused;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <iframe
        ref={iframeRef}
        src="/word-rocket.html"
        title="Word Rocket"
        className="block h-screen w-full border-0"
      />
      <ConnectionIndicator visible={showConnectionIndicator} />
    </div>
  );
}
