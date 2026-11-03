import { useState } from "react";
import PropTypes from "prop-types";
import { Check, ChevronDown, CircleHelp, Copy, FileText } from "lucide-react";
import { Button } from "components/button";
import { Collapse } from "app/Collapse";

/** A block of text to copy (a file, a command, settings), with a title and a Copy button. */
export function CodeBlock({ title, code, note }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="min-w-0 overflow-hidden rounded-default border border-default">
      <div className="flex items-center justify-between gap-3 border-b border-default bg-surface-lv1 px-4 py-2">
        <span className="flex min-w-0 items-center gap-2 typo-medium-text-sm"><FileText size={14} className="shrink-0" /><span className="break-all">{title}</span></span>
        <Button size="sm" kind="text" prefixIcon={copied ? <Check /> : <Copy />} onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all bg-surface p-4 text-sm"><code>{code}</code></pre>
      {note && <p className="border-t border-default bg-surface-lv1 px-4 py-2 text-caption typo-regular-text-sm">{note}</p>}
    </div>
  );
}
CodeBlock.propTypes = {
  /** What the text is, e.g. the file name it goes into. */
  title: PropTypes.string.isRequired,
  /** The text to show and copy. */
  code: PropTypes.string.isRequired,
  /** A line under the block, e.g. what to replace. */
  note: PropTypes.string,
};

/** "Where do I find this?" under a field: closed by default, opens smoothly. */
export function FieldHelp({ title = "Where do I find this?", children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Button kind="text" size="sm" className="self-start" prefixIcon={<CircleHelp />} suffixIcon={<ChevronDown className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />} onClick={() => setOpen((v) => !v)}>
        {title}
      </Button>
      <Collapse open={open}>
        <div className="flex flex-col gap-2 rounded-default bg-surface-lv1 p-4 typo-regular-text-sm">{children}</div>
      </Collapse>
    </div>
  );
}
FieldHelp.propTypes = {
  /** The button text. Default "Where do I find this?". */
  title: PropTypes.string,
  /** The explanation: short steps, examples. */
  children: PropTypes.node.isRequired,
};

/** A section heading with an icon and one sentence that says what the section is for. */
export function SectionTitle({ icon, title, description, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="flex items-center gap-2 typo-semi-bold-text-lg">{icon}{title}</h3>
        {description && <p className="max-w-3xl text-caption typo-regular-text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}
SectionTitle.propTypes = {
  /** A lucide icon at size 20. */
  icon: PropTypes.node,
  /** The heading. */
  title: PropTypes.string.isRequired,
  /** One sentence: what this is for. */
  description: PropTypes.string,
  /** An element on the right, e.g. a Button. */
  action: PropTypes.node,
};

/** The first thing on a tab: what this tab is, in a soft panel with an icon. */
export function TabIntro({ icon, title, children }) {
  return (
    <div className="flex gap-4 rounded-default bg-surface-lv1 p-4">
      <div className="mt-0.5 shrink-0 text-primary">{icon}</div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="typo-semi-bold-text-base">{title}</p>
        <div className="flex flex-col gap-1 text-default typo-regular-text-sm">{children}</div>
      </div>
    </div>
  );
}
TabIntro.propTypes = {
  /** A lucide icon at size 24. */
  icon: PropTypes.node,
  /** What the tab is, as a short sentence. */
  title: PropTypes.string.isRequired,
  /** One or two sentences with the detail. */
  children: PropTypes.node,
};

/** One numbered step of a how-to: a number, a title and the content (text, a code block). */
export function Step({ n, title, children }) {
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-primary typo-semi-bold-text-sm text-primary">{n}</span>
        <div className="mt-1 w-0 flex-1 border-l border-default" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pb-8">
        <h4 className="typo-semi-bold-text-base">{title}</h4>
        {children}
      </div>
    </li>
  );
}
Step.propTypes = {
  /** The step number. */
  n: PropTypes.number.isRequired,
  /** What to do, in a few words. */
  title: PropTypes.string.isRequired,
  /** The explanation and any code to copy. */
  children: PropTypes.node,
};

/** Questions and answers that open one at a time, smoothly. */
export function FaqList({ items }) {
  const [openAt, setOpenAt] = useState(null);
  return (
    <ul className="flex flex-col divide-y divide-slate-200 rounded-default border border-default">
      {items.map((it, i) => (
        <li key={it.q} className="flex flex-col">
          <Button kind="text" className="justify-between px-4 py-3 text-left" suffixIcon={<ChevronDown className={`transition-transform duration-300 ${openAt === i ? "rotate-180" : ""}`} />} onClick={() => setOpenAt(openAt === i ? null : i)}>{it.q}</Button>
          <Collapse open={openAt === i}>
            <p className="px-4 pb-4 text-default typo-regular-text-sm">{it.a}</p>
          </Collapse>
        </li>
      ))}
    </ul>
  );
}
FaqList.propTypes = {
  /** The questions: `{ q, a }`. */
  items: PropTypes.arrayOf(PropTypes.shape({ q: PropTypes.string.isRequired, a: PropTypes.string.isRequired })).isRequired,
};
