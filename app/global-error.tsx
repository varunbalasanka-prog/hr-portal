"use client";

/** Last resort when the root layout itself fails; must render its own <html>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 18 }}>Something went wrong / ஏதோ தவறு நடந்தது</h1>
          <button onClick={reset} style={{ marginTop: 12, padding: "8px 16px" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
