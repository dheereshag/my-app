import { Checkbox } from "@/components/ui/checkbox";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { BOOKER_MIN_AGE } from "@/domain";
import { useBookingStore } from "@/store/booking-store";
import type { FieldErrors } from "@/store/booking-request";
import { AgeField, TextField } from "./fields";

interface BookerFormProps {
  readonly errors: FieldErrors;
  readonly showErrors: boolean;
  /** Whether the tickets include an adult place the booker could take. */
  readonly canAttend: boolean;
}

export function BookerForm({ errors, showErrors, canAttend }: BookerFormProps) {
  const booker = useBookingStore((store) => store.booker);
  const setBooker = useBookingStore((store) => store.setBooker);

  return (
    <FieldSet>
      <FieldLegend>
        <span className="font-heading text-2xl font-semibold">About you</span>
      </FieldLegend>
      <p className="-mt-2 text-muted-foreground">
        You are the person booking and paying. We use these details to contact you.
      </p>
      <FieldGroup>
        <TextField
          id="booker-name"
          label="Full name"
          autoComplete="name"
          value={booker.fullName}
          error={errors["booker.fullName"]}
          showError={showErrors}
          onChange={(fullName) => setBooker({ fullName })}
        />
        <TextField
          id="booker-email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={booker.email}
          error={errors["booker.email"]}
          showError={showErrors}
          onChange={(email) => setBooker({ email })}
        />
        <TextField
          id="booker-phone"
          label="Mobile number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          value={booker.phone}
          error={errors["booker.phone"]}
          showError={showErrors}
          onChange={(phone) => setBooker({ phone })}
        />
        <AgeField
          id="booker-age"
          label="Your age"
          hint={`The person booking must be ${BOOKER_MIN_AGE} or older.`}
          value={booker.age}
          error={errors["booker.age"]}
          showError={showErrors}
          onChange={(age) => setBooker({ age })}
        />
        {canAttend ? (
          <div className="flex min-h-11 items-center gap-3">
            <Checkbox
              id="booker-attending"
              checked={booker.isAttendingAsAdult}
              onCheckedChange={(checked) => setBooker({ isAttendingAsAdult: checked })}
            />
            <Label htmlFor="booker-attending" className="text-base">
              I am coming too (uses one of the adult places)
            </Label>
          </div>
        ) : null}
      </FieldGroup>
    </FieldSet>
  );
}
