import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[11px] font-bold text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

// text-base (16px), not text-sm -- iOS Safari auto-zooms the page on focus
// for any text input under 16px and doesn't reliably zoom back out after
// blur, leaving the page zoomed in and the layout overflowing.
const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-base text-paper placeholder:text-muted focus:border-line-strong focus:outline-none";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea {...props} className={`${inputClass} ${props.className ?? ""}`} />
  );
}
