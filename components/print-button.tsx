"use client";
export function PrintButton() {
  return (
    <div className="fixed inset-x-0 bottom-0 flex justify-center bg-brand p-3 print:hidden">
      <button className="rounded-md bg-sky-600 px-5 py-2 text-sm font-bold text-white" onClick={() => window.print()}>Download / save as PDF</button>
    </div>
  );
}
