import { ADULT_MIN_AGE, CHILD_MAX_AGE, CHILD_MIN_AGE } from "@/domain";
import type { FieldErrors } from "@/store/booking-request";
import { useBookingStore } from "@/store/booking-store";
import { AgeField, TextField } from "./fields";
import { PersonCard } from "./person-card";

export function TicketedAttendeeFields({
  errors,
  showErrors,
}: {
  readonly errors: FieldErrors;
  readonly showErrors: boolean;
}) {
  const attendees = useBookingStore((store) => store.attendees);
  const updateAdult = useBookingStore((store) => store.updateAdult);
  const updateChild = useBookingStore((store) => store.updateChild);
  return (
    <>
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
    </>
  );
}
