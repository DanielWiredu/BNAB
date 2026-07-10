"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

export interface ComboOption {
  value: number;
  label: string;
}

/**
 * Type-ahead combobox backed by a native <datalist>. Dependency-free and
 * comfortable with large option sets (e.g. thousands of vessels). The bound
 * value is the option's numeric id as a string ("" when nothing matches).
 */
export function ComboBox({
  id,
  options,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const labelFor = React.useMemo(() => {
    const map = new Map(options.map((o) => [String(o.value), o.label]));
    return map;
  }, [options]);

  const valueForLabel = React.useMemo(() => {
    const map = new Map(options.map((o) => [o.label, String(o.value)]));
    return map;
  }, [options]);

  const [text, setText] = React.useState(() => labelFor.get(value) ?? "");

  // Keep the input text in sync when the bound value changes externally
  // (form reset, new requisition number, edit-mode load).
  React.useEffect(() => {
    setText(labelFor.get(value) ?? "");
  }, [value, labelFor]);

  return (
    <>
      <Input
        id={id}
        list={`${id}-list`}
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          onChange(valueForLabel.get(next) ?? "");
        }}
      />
      <datalist id={`${id}-list`}>
        {options.map((o) => (
          <option key={o.value} value={o.label} />
        ))}
      </datalist>
    </>
  );
}
