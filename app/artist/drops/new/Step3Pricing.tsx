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

      {state.dropType === "early-access" && (
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
