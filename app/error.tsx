"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="card max-w-md p-6 text-center">
        <h1 className="mb-2 text-lg font-bold">Something went wrong / ஏதோ தவறு நடந்தது</h1>
        <p className="mb-4 text-sm text-slate-600">Please try again. If it keeps happening, tell the HR office. / மீண்டும் முயற்சிக்கவும்.</p>
        <div className="flex justify-center gap-2">
          <button className="btn-primary" onClick={reset}>Try again</button>
          <Link className="btn-outline" href="/">Home</Link>
        </div>
      </div>
    </main>
  );
}
