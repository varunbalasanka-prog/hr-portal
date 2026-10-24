import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="card max-w-md p-6 text-center">
        <h1 className="mb-2 text-lg font-bold">Page not found / பக்கம் கிடைக்கவில்லை</h1>
        <p className="mb-4 text-sm text-slate-600">The link may be wrong or old. Looking for a job? Apply here. / வேலைக்கு இங்கே விண்ணப்பிக்கவும்.</p>
        <Link className="btn-primary" href="/apply">Apply for a job</Link>
      </div>
    </main>
  );
}
