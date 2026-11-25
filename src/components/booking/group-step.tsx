import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRequiredAttendeeCounts } from "@/domain";
import { validateGroup } from "@/store/booking-request";
import { useBookingStore } from "@/store/booking-store";
import { AttendeeFields } from "./attendee-fields";
import { BookerForm } from "./booker-form";
import { focusFirstInvalid } from "./focus";
import { StepNav } from "./step-nav";

export function GroupStep() {
  const selection = useBookingStore((store) => store.selection);
  const booker = useBookingStore((store) => store.booker);
  const attendees = useBookingStore((store) => store.attendees);
  const setStep = useBookingStore((store) => store.setStep);
  const [showErrors, setShowErrors] = useState(false);

  const errors = validateGroup({ selection, promoCode: "", booker, attendees });
  const canAttend = getRequiredAttendeeCounts(selection).adults > 0;

  function handleContinue() {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      focusFirstInvalid();
      return;
    }
    setStep("review");
  }

  return (
    <div className="flex flex-col gap-8">
      <BookerForm errors={errors} showErrors={showErrors} canAttend={canAttend} />
      <AttendeeFields errors={errors} showErrors={showErrors} />
      {showErrors && Object.keys(errors).length > 0 ? (
        <p role="alert" className="text-sm text-destructive">
          Some details need another look. They are marked above.
        </p>
      ) : null}
      <StepNav onBack={() => setStep("tickets")}>
        <Button type="button" className="h-11 px-6 text-base" onClick={handleContinue}>
          Review order
          <ArrowRight aria-hidden="true" data-icon="inline-end" />
        </Button>
      </StepNav>
    </div>
  );
}
