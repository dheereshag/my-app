import type { HTMLInputTypeAttribute } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface BaseFieldProps {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  /** Errors stay quiet until the person has tried to continue. */
  readonly showError: boolean;
  readonly hint?: string;
  readonly optional?: boolean;
}

interface TextFieldProps extends BaseFieldProps {
  readonly value: string;
  readonly type?: HTMLInputTypeAttribute;
  readonly inputMode?: "text" | "email" | "tel" | "numeric";
  readonly autoComplete?: string;
  readonly maxLength?: number;
  readonly onChange: (value: string) => void;
}

function describedBy(props: BaseFieldProps): string | undefined {
  const ids = [
    props.hint ? `${props.id}-hint` : null,
    props.error && props.showError ? `${props.id}-error` : null,
  ];
  const joined = ids.filter((id) => id !== null).join(" ");
  return joined === "" ? undefined : joined;
}

function FieldShell({
  props,
  children,
}: {
  readonly props: BaseFieldProps;
  readonly children: React.ReactNode;
}) {
  const invalid = Boolean(props.error) && props.showError;
  return (
    <Field data-invalid={invalid ? true : undefined}>
      <FieldLabel htmlFor={props.id}>
        {props.label}
        {props.optional ? (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        ) : null}
      </FieldLabel>
      {children}
      {props.hint ? (
        <FieldDescription id={`${props.id}-hint`}>{props.hint}</FieldDescription>
      ) : null}
      {invalid ? <FieldError id={`${props.id}-error`}>{props.error}</FieldError> : null}
    </Field>
  );
}

export function TextField(props: TextFieldProps) {
  const invalid = Boolean(props.error) && props.showError;
  return (
    <FieldShell props={props}>
      <Input
        id={props.id}
        type={props.type ?? "text"}
        inputMode={props.inputMode}
        autoComplete={props.autoComplete ?? "off"}
        maxLength={props.maxLength}
        value={props.value}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy(props)}
        className="h-11 text-base"
        onChange={(event) => props.onChange(event.target.value)}
      />
    </FieldShell>
  );
}

interface AgeFieldProps extends BaseFieldProps {
  readonly value: number | undefined;
  readonly onChange: (value: number | undefined) => void;
}

/** Numeric input that simply ignores characters that can't be part of a number. */
export function AgeField(fieldProps: AgeFieldProps) {
  // A blank field gets a plain prompt instead of the schema's "must be a whole number".
  const props = {
    ...fieldProps,
    error: fieldProps.value === undefined && fieldProps.error ? "Enter an age." : fieldProps.error,
  };
  const invalid = Boolean(props.error) && props.showError;
  return (
    <FieldShell props={props}>
      <Input
        id={props.id}
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={props.value === undefined ? "" : String(props.value)}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy(props)}
        className="h-11 text-base"
        onChange={(event) => {
          const text = event.target.value.trim();
          if (text === "") {
            props.onChange(undefined);
            return;
          }
          const parsed = Number(text);
          if (!Number.isNaN(parsed)) {
            props.onChange(parsed);
          }
        }}
      />
    </FieldShell>
  );
}
