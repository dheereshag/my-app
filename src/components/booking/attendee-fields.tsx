import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  ADULT_MIN_AGE,
  CHILD_MAX_AGE,
  CHILD_MIN_AGE,
  MAX_TODDLERS_PER_BOOKING,
  TODDLER_MAX_AGE,
} from "@/domain";
import { useBookingStore } from "@/store/booking-store";
import type { FieldErrors } from "@/store/booking-request";
import { AgeField, TextField } from "./fields";

interface AttendeeFieldsProps {
  readonly errors: FieldErrors;
  readonly showErrors: boolean;
}

function PersonCard({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <FieldSet className="rounded-xl border border-white/20 bg-white/5 p-4">
      <FieldLegend variant="label" className="font-semibold">
        {legend}
      </FieldLegend>
      <FieldGroup className="gap-4">{children}</FieldGroup>
    </FieldSet>
  );
}

/** Adults (12+), children (5-11) and under-5s. Counts come from the tickets, never typed in. */
export function AttendeeFields({ errors, showErrors }: AttendeeFieldsProps) {
  const attendees = useBookingStore((store) => store.attendees);
  const updateAdult = useBookingStore((store) => store.updateAdult);
  const updateChild = useBookingStore((store) => store.updateChild);
  const addToddler = useBookingStore((store) => store.addToddler);
  const updateToddler = useBookingStore((store) => store.updateToddler);
  const removeToddler = useBookingStore((store) => store.removeToddler);

  return (
    <div className="flex flex-col gap-8">
      {attendees.adults.length > 0 ? (
        <section aria-labelledby="adults-heading" className="flex flex-col gap-4">
          <div>
            <h3 id="adults-heading" className="font-heading text-2xl font-semibold">
              Other adults
            </h3>
            <p className="text-muted-foreground">
              Ages {ADULT_MIN_AGE} and over, one for each adult ticket. The door team uses this list
              to check people in.
            </p>
          </div>
          {attendees.adults.map((adult, index) => (
            <PersonCard key={adult.id} legend={`Adult ${index + 1}`}>
              <TextField
                id={`adult-${adult.id}-name`}
                label="Full name"
                value={adult.fullName}
                error={errors[`attendees.adults.${index}.fullName`]}
                showError={showErrors}
                onChange={(fullName) => updateAdult(adult.id, { fullName })}
              />
              <AgeField
                id={`adult-${adult.id}-age`}
                label="Age"
                hint={`Adult tickets are for ages ${ADULT_MIN_AGE} and over.`}
                value={adult.age}
                error={errors[`attendees.adults.${index}.age`]}
                showError={showErrors}
                onChange={(age) => updateAdult(adult.id, { age })}
              />
              <TextField
                id={`adult-${adult.id}-phone`}
                label="Mobile number"
                optional
                type="tel"
                inputMode="tel"
                maxLength={20}
                value={adult.phone ?? ""}
                error={errors[`attendees.adults.${index}.phone`]}
                showError={showErrors}
                onChange={(phone) => updateAdult(adult.id, { phone })}
              />
            </PersonCard>
          ))}
        </section>
      ) : null}

      {attendees.children.length > 0 ? (
        <section aria-labelledby="children-heading" className="flex flex-col gap-4">
          <div>
            <h3 id="children-heading" className="font-heading text-2xl font-semibold">
              Children
            </h3>
            <p className="text-muted-foreground">
              Ages {CHILD_MIN_AGE} to {CHILD_MAX_AGE}, one for each child ticket.
            </p>
          </div>
          {attendees.children.map((child, index) => (
            <PersonCard key={child.id} legend={`Child ${index + 1}`}>
              <TextField
                id={`child-${child.id}-name`}
                label="Full name"
                value={child.fullName}
                error={errors[`attendees.children.${index}.fullName`]}
                showError={showErrors}
                onChange={(fullName) => updateChild(child.id, { fullName })}
              />
              <AgeField
                id={`child-${child.id}-age`}
                label="Age"
                hint={`Child tickets are for ages ${CHILD_MIN_AGE} to ${CHILD_MAX_AGE}. A child of ${CHILD_MAX_AGE + 1} or older needs an adult ticket.`}
                value={child.age}
                error={errors[`attendees.children.${index}.age`]}
                showError={showErrors}
                onChange={(age) => updateChild(child.id, { age })}
              />
            </PersonCard>
          ))}
        </section>
      ) : null}

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
            <Button
              type="button"
              variant="outline"
              className="h-11 w-fit"
              onClick={() => removeToddler(toddler.id)}
            >
              <Trash2 aria-hidden="true" data-icon="inline-start" />
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
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add a child under 5
        </Button>
      </section>
    </div>
  );
}
