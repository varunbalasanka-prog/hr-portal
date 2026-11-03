"use client";
import { useEffect, useState } from "react";
import type { PostRow, Showroom, SiteContent } from "@/lib/site";
import { ShowroomsEditor } from "./showrooms";
import { PostsEditor } from "./posts";
import { WordsEditor } from "./words";

const TABS = [["showrooms", "Showrooms"], ["blog", "Blog"], ["words", "Page words & logos"]] as const;
type Tab = (typeof TABS)[number][0];

/** The three parts of the website editor. The open tab is remembered in the address (#blog) so a refresh stays put. */
export function WebsiteEditor({ content, showrooms, posts, ready, viewBase }: {
  content: SiteContent; showrooms: Showroom[]; posts: PostRow[]; ready: boolean; viewBase: string;
}) {
  const [tab, setTab] = useState<Tab>("showrooms");
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (TABS.some(([k]) => k === h)) setTab(h as Tab);
  }, []);
  return (
    <div className="px-4 sm:px-6">
      <div className="scroll-thin mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); history.replaceState(null, "", `#${k}`); }}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition ${tab === k ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{label}</button>
        ))}
      </div>
      {tab === "showrooms" && <ShowroomsEditor rows={showrooms} businesses={content.businesses} ready={ready} />}
      {tab === "blog" && <PostsEditor rows={posts} ready={ready} viewBase={viewBase} />}
      {tab === "words" && <WordsEditor content={content} showrooms={showrooms} ready={ready} />}
    </div>
  );
}
