import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { calculateSalary, rupees, salaryApproved } from "@/lib/salary";
import { DETAIL_LABELS, DOC_LABELS, MANDATORY_DOCS, docLabel, namesMatch } from "@/lib/onboarding";
import { CANDIDATE_COLUMNS, type Branch, type Candidate, type OnboardingSubmission } from "@/lib/types";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Onboarding documents · Balasanka HR", robots: { index: false } };

type Props = { params: Promise<{ id: string }> };
const PDF = /\.pdf(\?|$)/i;

/** Everything HR needs for joining and payroll on one page, printable. Stores never see onboarding documents. */
export default async function OnboardingDocuments({ params }: Props) {
  const { id } = await params;
  const { profile, supabase } = await requireProfile();
  if (profile.role === "branch") redirect("/dashboard");
  const { data: c } = await supabase.from("candidates").select(CANDIDATE_COLUMNS).eq("id", id).maybeSingle<Candidate>();
  if (!c) notFound();
  const [{ data: ob }, { data: branch }] = await Promise.all([
    supabase.from("onboarding_submissions").select("*").eq("candidate_id", id).maybeSingle<OnboardingSubmission>(),
    c.branch_id ? supabase.from("branches").select("*").eq("id", c.branch_id).maybeSingle<Branch>() : Promise.resolve({ data: null }),
  ]);
  const links: Record<string, string> = {};
  await Promise.all(Object.entries(ob?.files ?? {}).map(async ([key, path]) => {
    if (!path) return;
    if (path.startsWith("http")) { links[key] = path; return; }
    const { data } = await supabase.storage.from("onboarding-docs").createSignedUrl(path, 3600);
    if (data) links[key] = data.signedUrl;
  }));

  const d = ob?.details ?? {};
  const salary = salaryApproved(c) ? calculateSalary(c.basic_salary, c.allowances) : null;
  const married = (d.marital_status ?? c.marital_status ?? "").toLowerCase().startsWith("married");
  const a = c.aadhaar_check;
  const kids = Number(d.kids_count ?? 0);
  const v = (x?: string | null) => x || "-";

  const summary: [string, string][] = [
    ["Name", c.name], ["Mobile", c.mobile], ["Father's / husband's name", v(d.father_name ?? c.father_name)],
    ["Marital status", v(d.marital_status ?? c.marital_status)], ...(married ? [["Wedding date", d.wedding_date ? formatDate(d.wedding_date) : "-"] as [string, string]] : []),
    ["Email", v(d.email ?? c.email)], ["Address", v(c.address)],
    ["Branch", v(branch?.name ?? c.applied_locations[0])], ["Designation", v(c.designation ?? c.posts[0])],
    ["Actual joining date", formatDate(c.actual_joining_date)], ["Employee code", v(c.employee_code)], ["Shift", v(c.shift_time)],
    ["Salary", salary ? `Basic ₹${rupees(salary.basic)} + allowances ₹${rupees(salary.allowances)} = gross ₹${rupees(salary.gross)}` : c.salary_status === "proposed" ? "Waiting for admin approval" : "-"],
    ["Blood group", v(d.blood_group)], ["Emergency contact", d.emergency_name ? `${d.emergency_name} (${d.emergency_relationship ?? "-"}), ${d.emergency_mobile ?? "-"}` : "-"],
    ["ESI", d.esi_status ? `${d.esi_status}${d.esi_number ? `: ${d.esi_number}` : ""}` : "-"],
    ["UAN (PF)", d.uan_status ? `${d.uan_status}${d.uan_number ? `: ${d.uan_number}` : ""}` : "-"],
    ["Aadhaar check", !a ? "Not verified" : a.method === "in person" ? `Original seen by ${a.by} on ${formatDate(a.at)}`
      : `UIDAI ${a.method === "e-kyc" ? "e-KYC" : "Secure QR"}: ${a.name}, ${a.dob}, ${a.gender}, ending ${a.last4}${a.name && !namesMatch(a.name, c.name) ? " (NAME DOES NOT MATCH)" : ""}`],
  ];
  const family: [string, string][] = married
    ? [["Spouse", v(d.spouse_name)], ["Children", d.kids_count ?? "-"], ...Array.from({ length: Math.min(kids, 5) }, (_, i) => [`Child ${i + 1}`, v(d[`kid_${i + 1}_name`])] as [string, string])]
    : [["Mother", v(d.mother_name)]];
  const docs = Object.keys(DOC_LABELS).filter((k) => links[k] || MANDATORY_DOCS.includes(k));

  return (
    <main className="mx-auto max-w-[210mm] bg-white p-4 pb-24 text-sm text-black print:p-0">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-300 pb-2">
        <h1 className="text-lg font-bold">Onboarding documents: {c.name}</h1>
        <span className="text-xs text-slate-600">
          {ob ? <>Status: <b>{ob.status === "submitted" ? "to verify" : ob.status}</b> · submitted {formatDateTime(ob.submitted_at)}</> : "Onboarding form not submitted yet"}
          {" · "}printed {formatDateTime(new Date().toISOString())} by {profile.username}
        </span>
      </header>
      {ob?.status === "pending" && ob.missing_docs.length > 0 && <p className="mb-3 rounded bg-amber-50 p-2 text-amber-900">Sent back for correction: {ob.missing_docs.map(docLabel).join(", ")}</p>}

      <Table title="Employee details" rows={summary} />
      <Table title={married ? "Family (spouse & children)" : "Family (parents)"} rows={family} />
      {Object.entries(d).filter(([k, x]) => x && !(k in DETAIL_LABELS) && !["marital_status", "blood_group", "esi_status", "uan_status", "kids_count", "consent_version"].includes(k)).length > 0 && (
        <Table title="Other answers" rows={Object.entries(d).filter(([k, x]) => x && !(k in DETAIL_LABELS) && !["marital_status", "blood_group", "esi_status", "uan_status", "kids_count", "consent_version"].includes(k)).map(([k, x]) => [k.replace(/_/g, " "), String(x)])} />
      )}

      <h2 className="mb-2 mt-5 font-bold">Documents</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3">
        {docs.map((k) => (
          <figure key={k} className="break-inside-avoid rounded border border-slate-300 p-2">
            <figcaption className="mb-1 text-xs font-semibold">{docLabel(k)}{MANDATORY_DOCS.includes(k) ? " *" : ""}</figcaption>
            {!links[k] ? <div className="py-6 text-center text-xs text-red-700">Not uploaded</div>
              : PDF.test(links[k]) ? <a className="text-sky-700 underline" href={links[k]} target="_blank" rel="noreferrer">Open PDF</a>
                // eslint-disable-next-line @next/next/no-img-element
                : <a href={links[k]} target="_blank" rel="noreferrer"><img src={links[k]} alt={docLabel(k)} className="max-h-56 w-full object-contain" /></a>}
          </figure>
        ))}
      </div>
      <PrintButton />
    </main>
  );
}

function Table({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className="mb-4 break-inside-avoid">
      <h2 className="mb-1 font-bold">{title}</h2>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map(([k, x]) => (
            <tr key={k} className="border-b border-slate-200 align-top">
              <th className="w-1/3 py-1 pr-2 text-left font-semibold text-slate-600">{k}</th>
              <td className="py-1">{x}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
