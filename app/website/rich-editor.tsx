"use client";
import { useEffect, useRef, useState } from "react";
import { parseBody } from "@/lib/blog-format";
import { blocksToHtml, blocksToMarkdown, fixHref, htmlToBlocks } from "@/lib/blog-edit";

type Active = { block: string; bold: boolean; link: boolean };

/* The browser's own editing commands. execCommand is old but is still the one thing every phone and computer
   browser does the same way, and it keeps Undo (Ctrl+Z) working. */
const cmd = (name: string, value?: string) => document.execCommand(name, false, value);

function currentBlock(root: HTMLElement): string {
  let n: Node | null = document.getSelection()?.anchorNode ?? null;
  let found = "p";
  while (n && n !== root) {
    if (n.nodeType === 1) {
      const t = (n as Element).tagName;
      if (t === "LI") return (n.parentElement?.tagName ?? "UL").toLowerCase();
      if (t === "BLOCKQUOTE") return "note";
      if (/^H[1-6]$/.test(t)) found = t === "H1" || t === "H2" ? "h2" : "h3";
    }
    n = n.parentNode;
  }
  return found;
}

function linkAt(root: HTMLElement): HTMLAnchorElement | null {
  let n: Node | null = document.getSelection()?.anchorNode ?? null;
  while (n && n !== root) {
    if (n.nodeType === 1 && (n as Element).tagName === "A") return n as HTMLAnchorElement;
    n = n.parentNode;
  }
  return null;
}

/**
 * The blog post text box: type as normal and tap a button to make a heading, bold words, a list, a link or a
 * shaded note. What shows in the box is how the post looks on balasanka.in. It reads and hands back the stored
 * text (`value`), so nothing else about saving a post changes.
 */
export function RichEditor({ value, onChange }: { value: string; onChange: (md: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const saved = useRef<Range | null>(null);
  const [active, setActive] = useState<Active>({ block: "p", bold: false, link: false });
  const [linkBar, setLinkBar] = useState<{ href: string; error?: string } | null>(null);

  // Fill the box once when a post opens. After that the box is the source and only reports changes.
  useEffect(() => {
    if (!box.current) return;
    box.current.innerHTML = blocksToHtml(parseBody(value));
    try { cmd("defaultParagraphSeparator", "p"); } catch { /* older browsers: new lines become <div>, read the same */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onSel = () => {
      const root = box.current;
      const sel = document.getSelection();
      if (!root || !sel?.anchorNode || !root.contains(sel.anchorNode)) return;
      const block = currentBlock(root);
      // Headings are already heavy, so the browser calls them bold; the Bold button only means bold words.
      setActive({ block, bold: !/^h[23]$/.test(block) && document.queryCommandState("bold"), link: !!linkAt(root) });
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const report = () => { if (box.current) onChange(blocksToMarkdown(htmlToBlocks(box.current))); };

  /** Puts the box back to exactly what will be saved (drops anything pasted or typed that the site can't show). */
  const tidyBox = () => {
    if (!box.current || linkBar) return;
    const html = blocksToHtml(htmlToBlocks(box.current));
    if (box.current.innerHTML !== html) box.current.innerHTML = html;
  };

  const act = (fn: () => void) => {
    box.current?.focus();
    fn();
    report();
  };

  const setBlock = (tag: "p" | "h2" | "h3" | "blockquote") => act(() => {
    const now = currentBlock(box.current!);
    if (now === "ul") cmd("insertUnorderedList");
    if (now === "ol") cmd("insertOrderedList");
    if (now === "note" && tag !== "blockquote") cmd("formatBlock", "p");
    // A second tap on the same button turns it back into normal text.
    const same = (tag === "blockquote" && now === "note") || tag === now;
    cmd("formatBlock", same ? "p" : tag);
  });

  const setList = (kind: "ul" | "ol") => act(() => {
    const now = currentBlock(box.current!);
    if (now === "h2" || now === "h3" || now === "note") cmd("formatBlock", "p");
    cmd(kind === "ul" ? "insertUnorderedList" : "insertOrderedList");
  });

  const openLink = () => {
    const root = box.current!;
    const sel = document.getSelection();
    const a = linkAt(root);
    if (a) {
      const r = document.createRange();
      r.selectNodeContents(a);
      saved.current = r;
      return setLinkBar({ href: a.getAttribute("href") ?? "" });
    }
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !root.contains(sel.anchorNode)) {
      return setLinkBar({ href: "", error: "First select (highlight) the words that should become the link, then tap Link." });
    }
    saved.current = sel.getRangeAt(0).cloneRange();
    setLinkBar({ href: "" });
  };

  const restore = () => {
    box.current?.focus();
    const sel = document.getSelection();
    if (saved.current && sel) { sel.removeAllRanges(); sel.addRange(saved.current); }
  };

  const applyLink = () => {
    if (!saved.current) return setLinkBar(null);
    const href = fixHref(linkBar?.href ?? "");
    if (!href) return setLinkBar({ href: linkBar?.href ?? "", error: "That doesn't look like a web address. Try balasanka.in/jewellery or www.bis.gov.in" });
    restore();
    cmd("createLink", href);
    saved.current = null;
    setLinkBar(null);
    report();
  };

  const removeLink = () => {
    restore();
    cmd("unlink");
    saved.current = null;
    setLinkBar(null);
    report();
  };

  const Btn = ({ on, label, title, onClick, children }: { on?: boolean; label: string; title?: string; onClick: () => void; children?: React.ReactNode }) => (
    <button type="button" aria-pressed={on} title={title ?? label}
      onMouseDown={(e) => e.preventDefault() /* keep the cursor where it is in the text */}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center gap-1 rounded-md px-2.5 text-sm font-semibold transition ${on ? "bg-brand text-white" : "text-slate-700 hover:bg-slate-100"}`}>
      {children}{label}
    </button>
  );

  return (
    <div className="rounded-xl border border-slate-300 bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
      <div className="sticky top-14 z-10 flex flex-wrap items-center gap-0.5 lg:top-0 rounded-t-xl border-b border-slate-200 bg-slate-50/95 p-1.5 backdrop-blur" role="toolbar" aria-label="Formatting">
        <Btn label="Normal text" on={active.block === "p"} onClick={() => setBlock("p")} />
        <Btn label="Heading" on={active.block === "h2"} onClick={() => setBlock("h2")} />
        <Btn label="Small heading" on={active.block === "h3"} onClick={() => setBlock("h3")} />
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden />
        <Btn label="Bold" on={active.bold} onClick={() => act(() => cmd("bold"))}><b className="font-black">B</b></Btn>
        <Btn label="List" title="Bullet list" on={active.block === "ul"} onClick={() => setList("ul")}><span aria-hidden>•</span></Btn>
        <Btn label="List" title="Numbered list" on={active.block === "ol"} onClick={() => setList("ol")}><span aria-hidden>1.</span></Btn>
        <Btn label={active.link ? "Change link" : "Link"} on={active.link} onClick={openLink}><span aria-hidden>🔗</span></Btn>
        <Btn label="Note box" on={active.block === "note"} onClick={() => setBlock("blockquote")}><span aria-hidden className="inline-block h-3.5 w-3.5 rounded-sm bg-slate-300" /></Btn>
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden />
        <Btn label="Undo" onClick={() => act(() => cmd("undo"))}><span aria-hidden>↶</span></Btn>
      </div>

      {linkBar && (
        <div className="space-y-2 border-b border-slate-200 bg-sky-50 p-3 text-sm">
          {saved.current ? <>
            <label className="block font-semibold text-slate-800" htmlFor="post-link">Where should the link go?</label>
            <div className="flex flex-wrap gap-2">
              <input id="post-link" className="input min-w-0 flex-1" autoFocus placeholder="balasanka.in/jewellery  or  www.bis.gov.in" value={linkBar.href}
                onChange={(e) => setLinkBar({ href: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setLinkBar(null); }} />
              <button type="button" className="btn-primary" onClick={applyLink}>Add link</button>
              {active.link && <button type="button" className="btn-outline" onClick={removeLink}>Remove link</button>}
              <button type="button" className="btn-ghost" onClick={() => { saved.current = null; setLinkBar(null); }}>Cancel</button>
            </div>
          </> : null}
          {linkBar.error && <p className={saved.current ? "text-red-700" : "text-slate-700"}>{linkBar.error}
            {!saved.current && <button type="button" className="btn-ghost ml-2 !min-h-7" onClick={() => setLinkBar(null)}>OK</button>}</p>}
        </div>
      )}

      <div ref={box} contentEditable suppressContentEditableWarning role="textbox" aria-multiline aria-label="Post text"
        className="post-editor min-h-[26rem] px-4 py-3 outline-none sm:px-6"
        onInput={report}
        onBlur={tidyBox}
        onPaste={(e) => {
          // Pasted text comes in as plain words: one paragraph per line, no outside colours or fonts.
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain").replace(/\r\n/g, "\n").trim();
          if (!text) return;
          const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
          const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          if (lines.length === 1) cmd("insertText", lines[0]);
          else cmd("insertHTML", lines.map((l) => `<p>${esc(l)}</p>`).join(""));
          report();
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openLink(); }
        }} />
    </div>
  );
}
