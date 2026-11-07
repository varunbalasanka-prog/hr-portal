import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExpiredLink } from "@/components/letterhead";
import { lookupDetails } from "./lookup";
import { DetailsForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your details · Balasanka Group", robots: { index: false } };

type Props = { params: Promise<{ token: string }> };

/** After-interview details: the questions the admin marked "after the interview", for candidates HR selected. */
export default async function DetailsPage({ params }: Props) {
  const { token } = await params;
  const found = await lookupDetails(token);
  if (!found) notFound();
  if (found.expired) return <ExpiredLink />;
  const done = !!found.submitted_at || !found.questions.length;
  return (
    <main className="mx-auto max-w-2xl p-3 sm:p-6">
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/balasanka_logo.png" alt="Balasanka logo" className="h-11 w-auto" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight text-brand">A few more details</h1>
            <p className="text-sm text-slate-500">இன்னும் சில விவரங்கள் · Balasanka Group</p>
          </div>
        </div>
        <div className="p-4 sm:p-6">
          {done ? (
            <div className="py-6 text-center" role="status">
              <h2 className="text-lg font-bold text-green-700">Already submitted / ஏற்கனவே சமர்ப்பிக்கப்பட்டது</h2>
              <p className="mt-2 text-sm text-slate-700">Dear <b>{found.name}</b>, we have your details. HR will contact you about the next step.</p>
              <p className="text-sm text-slate-600">உங்கள் விவரங்கள் எங்களிடம் உள்ளன. அடுத்த படி குறித்து HR உங்களைத் தொடர்பு கொள்வார்.</p>
            </div>
          ) : (
            <DetailsForm token={token} name={found.name} questions={found.questions} />
          )}
        </div>
      </div>
    </main>
  );
}
