"use client";

import { Field, Input } from "@/components/Field";
import type { WizardState } from "./types";

export function Step3Pricing({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}) {
  const isExclusive = state.dropType === "exclusive";

  return (
    <div>
      <p className="mb-4 text-xs text-muted">
        Every Preem drop is pay-what-you-want — fans can pay more, but never less than
        the minimum you set here.
      </p>
      <Field label="Minimum Price (₦)">
        <Input
          required
          type="number"
          min={1}
          value={state.minPriceNaira}
          onChange={(e) => onChange({ minPriceNaira: e.target.value })}
          placeholder="800"
        />
      </Field>

      <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface px-3.5 py-3">
        <input
          type="checkbox"
          checked={isExclusive}
          onChange={(e) =>
            onChange({ dropType: e.target.checked ? "exclusive" : "early-access" })
          }
          className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
        />
        <span>
          <span className="block text-sm font-bold text-paper">
            Make this exclusive to Preem
          </span>
          <span className="mt-0.5 block text-[11px] text-muted">
            Keep this drop only on Preem — it won&apos;t be released anywhere else.
          </span>
        </span>
      </label>

      {!isExclusive && (
        <Field label="Public release date">
          <Input
            required
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={state.releaseDate}
            onChange={(e) => onChange({ releaseDate: e.target.value })}
          />
          <p className="mt-1.5 text-[11px] text-muted">
            When you plan to release this elsewhere. Preem stays exclusive to this drop until then.
          </p>
        </Field>
      )}
    </div>
  );
}
