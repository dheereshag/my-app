import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import {
  CHILD_MIN_AGE,
  FESTIVAL_DATES,
  MAX_TODDLERS_PER_BOOKING,
  TODDLER_MAX_AGE,
  getCoveredFestivalDays,
} from "@/domain";
import { useBookingStore } from "@/store/booking-store";
import type { FieldErrors } from "@/store/booking-request";
import { DayPicker } from "./day-picker";
import { PersonCard } from "./person-card";
import { TicketedAttendeeFields } from "./ticketed-attendee-fields";
import { AgeField, TextField } from "./fields";

interface AttendeeFieldsProps {
  readonly errors: FieldErrors;
  readonly showErrors: boolean;
}

/** Adults (12+), children (5-11) and under-5s. Counts come from the tickets, never typed in. */
export function AttendeeFields({ errors, showErrors }: AttendeeFieldsProps) {
  const selection = useBookingStore((store) => store.selection);
  const attendees = useBookingStore((store) => store.attendees);
  const addToddler = useBookingStore((store) => store.addToddler);
  const updateToddler = useBookingStore((store) => store.updateToddler);
  const removeToddler = useBookingStore((store) => store.removeToddler);
  const coveredDays = getCoveredFestivalDays(selection);

  return (
    <div className="flex flex-col gap-8">
      <TicketedAttendeeFields errors={errors} showErrors={showErrors} />

      <section aria-labelledby="toddlers-heading" className="flex flex-col gap-4">
        <div>
          <h3 id="toddlers-heading" className="font-heading text-2xl font-semibold">
            Children under 5
          </h3>
          <p className="text-muted-foreground">
            They come free and need no ticket. Add them so the door team has everyone on the list.
          </p>
        </div>
        {attendees.toddlers.map((toddler, index) => (
          <PersonCard key={toddler.id} legend={`Under 5: child ${index + 1}`}>
            <TextField
              id={`toddler-${toddler.id}-name`}
              label="Full name"
              value={toddler.fullName}
              error={errors[`attendees.toddlers.${index}.fullName`]}
              showError={showErrors}
              onChange={(fullName) => updateToddler(toddler.id, { fullName })}
            />
            <AgeField
              id={`toddler-${toddler.id}-age`}
              label="Age"
              hint={`Free entry is for ages 0 to ${TODDLER_MAX_AGE}. From age ${CHILD_MIN_AGE} a child ticket is needed.`}
              value={toddler.age}
              error={errors[`attendees.toddlers.${index}.age`]}
              showError={showErrors}
              onChange={(age) => updateToddler(toddler.id, { age })}
            />
            <div className="flex flex-col gap-2">
              <p
                id={`toddler-${toddler.id}-days-label`}
                className="text-sm font-medium leading-none"
              >
                Which days will this child attend?
              </p>
              <DayPicker
                label={`Attendance days for ${toddler.fullName || `child ${index + 1}`}`}
                dates={FESTIVAL_DATES}
                enabledDates={coveredDays}
                value={toddler.attendingDays}
                invalid={showErrors && Boolean(errors[`attendees.toddlers.${index}.attendingDays`])}
                describedBy={`toddler-${toddler.id}-days-label`}
                onChange={(attendingDays) => updateToddler(toddler.id, { attendingDays })}
              />
              {showErrors && errors[`attendees.toddlers.${index}.attendingDays`] ? (
                <FieldError>{errors[`attendees.toddlers.${index}.attendingDays`]}</FieldError>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-fit"
              onClick={() => removeToddler(toddler.id)}
            >
              <HugeiconsIcon icon={Delete02Icon} aria-hidden="true" data-icon="inline-start" />
              Remove{toddler.fullName.trim() ? ` ${toddler.fullName.trim()}` : " this child"}
            </Button>
          </PersonCard>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-11 w-fit"
          disabled={attendees.toddlers.length >= MAX_TODDLERS_PER_BOOKING}
          onClick={addToddler}
        >
          <HugeiconsIcon icon={Add01Icon} aria-hidden="true" data-icon="inline-start" />
          Add a child under 5
        </Button>
      </section>
    </div>
  );
}
