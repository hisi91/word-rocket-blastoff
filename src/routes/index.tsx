import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/word-rocket.html"
      title="Word Rocket"
      style={{ width: "100%", height: "100vh", border: "none", display: "block" }}
    />
  );
}
