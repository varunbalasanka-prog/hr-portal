"use client";
import { useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { parseBody } from "@/lib/blog-format";
import { blocksToHtml, blocksToMarkdown, fixHref, htmlToBlocks } from "@/lib/blog-edit";

/** The editor's HTML as the stored post text (the same small format the site reads). */
function toMarkdown(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return blocksToMarkdown(htmlToBlocks(div));
}

/**
 * The blog post text box, Word/WhatsApp style: type, and tap a button for the line you are on. Heading, List and
 * Note box work on the line where the cursor is (no selecting first); tap again to turn it off. Bold works on
 * selected words, or on what you type next. Link asks for the words and the address.
 * Built on Tiptap, a widely used editor that behaves the same on phones and computers.
 */
export function RichEditor({ value, onChange }: { value: string; onChange: (md: string) => void }) {
  const [link, setLink] = useState<{ text: string; href: string; hasSelection: boolean; error?: string } | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false, codeBlock: false, strike: false, italic: false, underline: false, horizontalRule: false,
        link: { openOnClick: false, autolink: false, linkOnPaste: false, HTMLAttributes: { rel: null, target: null } },
      }),
    ],
    content: blocksToHtml(parseBody(value)),
    editorProps: {
      attributes: { class: "post-editor min-h-[24rem] px-4 py-3 outline-none sm:px-6", "aria-label": "Post text" },
      // Pasted text arrives as plain words (no outside fonts or colours).
      transformPastedHTML: (html) => {
        const div = document.createElement("div");
        div.innerHTML = html;
        return blocksToHtml(htmlToBlocks(div));
      },
    },
    onUpdate: ({ editor }) => onChange(toMarkdown(editor.getHTML())),
  });

  const on = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      heading: !!e?.isActive("heading"),
      bold: !!e?.isActive("bold") && !e?.isActive("heading"),
      list: !!(e?.isActive("bulletList") || e?.isActive("orderedList")),
      note: !!e?.isActive("blockquote"),
      link: !!e?.isActive("link"),
    }),
  });

  if (!editor) return <div className="min-h-[24rem] rounded-xl border border-slate-300 bg-white" />;
  const c = () => editor.chain().focus();

  const heading = () => {
    if (editor.isActive("heading")) return c().setParagraph().run();
    let ch = c();
    if (editor.isActive("bulletList")) ch = ch.toggleBulletList();
    if (editor.isActive("orderedList")) ch = ch.toggleOrderedList();
    if (editor.isActive("blockquote")) ch = ch.lift("blockquote");
    ch.setHeading({ level: 2 }).run();
  };
  const list = () => {
    if (editor.isActive("orderedList")) return c().toggleOrderedList().run();
    let ch = c();
    if (editor.isActive("heading")) ch = ch.setParagraph();
    if (editor.isActive("blockquote")) ch = ch.lift("blockquote");
    ch.toggleBulletList().run();
  };
  const note = () => {
    if (editor.isActive("blockquote")) return c().lift("blockquote").run();
    let ch = c();
    if (editor.isActive("heading")) ch = ch.setParagraph();
    if (editor.isActive("bulletList")) ch = ch.toggleBulletList();
    if (editor.isActive("orderedList")) ch = ch.toggleOrderedList();
    ch.setBlockquote().run();
  };

  const openLink = () => {
    if (editor.isActive("link")) editor.chain().extendMarkRange("link").run();
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, " ");
    setLink({ text, href: editor.getAttributes("link").href ?? "", hasSelection: from !== to });
  };
  const addLink = () => {
    if (!link) return;
    const href = fixHref(link.href);
    if (!href) return setLink({ ...link, error: "That doesn't look like a web address. Try balasanka.in/jewellery or www.bis.gov.in" });
    const words = link.text.trim() || link.href.trim();
    if (link.hasSelection) c().extendMarkRange("link").setLink({ href }).run();
    else c().insertContent({ type: "text", text: words, marks: [{ type: "link", attrs: { href } }] }).insertContent(" ").run();
    setLink(null);
  };

  const Btn = ({ active, label, onClick, icon }: { active?: boolean; label: string; onClick: () => void; icon: React.ReactNode }) => (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-xs font-semibold transition sm:flex-row sm:gap-1.5 sm:text-sm ${active ? "bg-brand text-white" : "text-slate-700 hover:bg-slate-100 active:bg-slate-200"}`}>
      <span aria-hidden className="text-base leading-none">{icon}</span>{label}
    </button>
  );

  return (
    <div className="rounded-xl border border-slate-300 bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/15">
      <div className="sticky top-14 z-10 flex gap-1 rounded-t-xl border-b border-slate-200 bg-slate-50/95 p-1.5 backdrop-blur lg:top-0" role="toolbar" aria-label="Formatting">
        <Btn label="Heading" icon={<b>H</b>} active={on?.heading} onClick={heading} />
        <Btn label="Bold" icon={<b className="font-black">B</b>} active={on?.bold} onClick={() => c().toggleBold().run()} />
        <Btn label="List" icon="•" active={on?.list} onClick={list} />
        <Btn label="Link" icon="🔗" active={on?.link} onClick={openLink} />
        <Btn label="Note box" icon={<span className="inline-block h-3.5 w-3.5 rounded-sm bg-slate-300 align-middle" />} active={on?.note} onClick={note} />
      </div>

      {link && (
        <div className="space-y-2 border-b border-slate-200 bg-sky-50 p-3 text-sm">
          {!link.hasSelection && (
            <label className="block">
              <span className="font-semibold text-slate-800">Words to show</span>
              <input className="input mt-1" value={link.text} placeholder="our jewellery showrooms" onChange={(e) => setLink({ ...link, text: e.target.value })} />
            </label>
          )}
          <label className="block">
            <span className="font-semibold text-slate-800">{link.hasSelection ? <>Link &ldquo;{link.text}&rdquo; to</> : "Web address"}</span>
            <input className="input mt-1" autoFocus value={link.href} placeholder="balasanka.in/jewellery  or  www.bis.gov.in" inputMode="url"
              onChange={(e) => setLink({ ...link, href: e.target.value, error: undefined })}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } if (e.key === "Escape") setLink(null); }} />
          </label>
          {link.error && <p className="text-red-700">{link.error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={addLink}>Add link</button>
            {on?.link && <button type="button" className="btn-outline" onClick={() => { c().extendMarkRange("link").unsetLink().run(); setLink(null); }}>Remove link</button>}
            <button type="button" className="btn-ghost" onClick={() => setLink(null)}>Cancel</button>
          </div>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
