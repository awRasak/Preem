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

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-paper placeholder:text-muted focus:border-line-strong focus:outline-none";

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
