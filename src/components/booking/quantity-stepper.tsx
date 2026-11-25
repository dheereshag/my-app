import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuantityStepperProps {
  /** What is being counted, used for the button names: "Fewer Day Pass – Adult". */
  readonly label: string;
  readonly value: number;
  readonly max: number;
  readonly disabled?: boolean;
  readonly onChange: (value: number) => void;
}

export function QuantityStepper({ label, value, max, disabled, onChange }: QuantityStepperProps) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11"
        aria-label={`Fewer ${label}`}
        disabled={disabled || value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden="true" />
      </Button>
      <output aria-live="polite" className="w-10 text-center text-lg font-semibold tabular-nums">
        {value}
      </output>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11"
        aria-label={`More ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  );
}
