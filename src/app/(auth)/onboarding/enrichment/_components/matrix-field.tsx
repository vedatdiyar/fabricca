"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface MatrixFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

/**
 * MatrixField component renders a styled form field containing a Label
 * and an academic-styled Textarea element, specifically designed for
 * onboarding matrix editing steps.
 *
 * @param props The properties of the MatrixField component.
 * @param props.id Unique identifier for the input element.
 * @param props.label User-facing text describing the input.
 * @param props.value Current text value of the input.
 * @param props.onChange Callback triggered when the input value changes.
 * @param props.required Indicates if the input is required in the form.
 */
export function MatrixField({
  id,
  label,
  value,
  onChange,
  required = true,
}: MatrixFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block font-semibold text-foreground">
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="textarea-academic"
      />
    </div>
  );
}
