import type { ReactNode } from "react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";

interface StepNavProps {
  readonly onBack?: () => void;
  readonly children: ReactNode;
}

/** Back on the left, the step's main action on the right; stacked and full width on phones. */
export function StepNav({ onBack, children }: StepNavProps) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <Button type="button" variant="outline" className="h-11 px-4 text-base" onClick={onBack}>
          <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" data-icon="inline-start" />
          Back
        </Button>
      ) : (
        <span />
      )}
      {children}
    </div>
  );
}
