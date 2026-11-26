import { z } from "zod";
import {
  ADULT_MIN_AGE,
  BOOKER_MIN_AGE,
  CHILD_MAX_AGE,
  CHILD_MIN_AGE,
  MAX_AGE,
  MAX_TODDLERS_PER_BOOKING,
  TODDLER_MAX_AGE,
  TODDLER_MIN_AGE,
} from "./catalog";
import { FestivalDaysSchema } from "./ticket-schemas";

const PHONE_PATTERN = /^(?=(?:\D*\d){7})[+\d\s().-]+$/;

export const FullNameSchema = z
  .string({ error: "Full name is required." })
  .trim()
  .min(2, { error: "Full name must be at least 2 characters." })
  .max(100, { error: "Full name must be 100 characters or fewer." });

export const EmailSchema = z
  .string({ error: "Email address is required." })
  .trim()
  .pipe(z.email({ error: "Enter a valid email address." }));

export const PhoneSchema = z
  .string({ error: "Phone number is required." })
  .trim()
  .max(20, { error: "Phone number must be 20 characters or fewer." })
  .refine((val) => PHONE_PATTERN.test(val), {
    error: "Enter a valid phone number with at least 7 digits.",
  });

export const OptionalPhoneSchema = z
  .string({ error: "Phone number must be text." })
  .trim()
  .max(20, { error: "Phone number must be 20 characters or fewer." })
  .refine((val) => val.length === 0 || PHONE_PATTERN.test(val), {
    error: "Enter a valid phone number with at least 7 digits.",
  })
  .transform((val) => (val.length === 0 ? undefined : val))
  .optional();

export const BookerAgeSchema = z
  .int({ error: "Age must be a whole number." })
  .min(BOOKER_MIN_AGE, {
    error: `The person booking must be at least ${BOOKER_MIN_AGE} years old.`,
  })
  .max(MAX_AGE, { error: `Age must be ${MAX_AGE} or less.` });

export const AdultAgeSchema = z
  .int({ error: "Age must be a whole number." })
  .min(ADULT_MIN_AGE, {
    error: `Adult attendees must be at least ${ADULT_MIN_AGE} years old.`,
  })
  .max(MAX_AGE, { error: `Age must be ${MAX_AGE} or less.` });

export const ChildAgeSchema = z
  .int({ error: "Age must be a whole number." })
  .min(CHILD_MIN_AGE, {
    error: `Child attendees on a child ticket must be at least ${CHILD_MIN_AGE} years old (children under 5 attend free).`,
  })
  .max(CHILD_MAX_AGE, {
    error: `Attendees aged 12 and above require an adult ticket (child ticket max age is ${CHILD_MAX_AGE}).`,
  });

export const ToddlerAgeSchema = z
  .int({ error: "Age must be a whole number." })
  .min(TODDLER_MIN_AGE, { error: "Age cannot be negative." })
  .max(TODDLER_MAX_AGE, {
    error: `Free toddler admission is for ages ${TODDLER_MIN_AGE} to ${TODDLER_MAX_AGE} only.`,
  });

export const AttendeeIdSchema = z
  .string({ error: "Attendee ID is required." })
  .trim()
  .min(1, { error: "Attendee ID cannot be empty." })
  .max(100, { error: "Attendee ID is too long." });

export const BookerSchema = z.strictObject({
  fullName: FullNameSchema,
  email: EmailSchema,
  phone: PhoneSchema,
  age: BookerAgeSchema,
  isAttendingAsAdult: z.boolean({
    error: "Specify whether the booker is attending as an adult.",
  }),
});

export const AdultAttendeeSchema = z.strictObject({
  id: AttendeeIdSchema,
  fullName: FullNameSchema,
  age: AdultAgeSchema,
  phone: OptionalPhoneSchema,
});

export const ChildAttendeeSchema = z.strictObject({
  id: AttendeeIdSchema,
  fullName: FullNameSchema,
  age: ChildAgeSchema,
});

export const ToddlerAttendeeSchema = z.strictObject({
  id: AttendeeIdSchema,
  fullName: FullNameSchema,
  age: ToddlerAgeSchema,
  attendingDays: FestivalDaysSchema.refine((days) => days.length > 0, {
    error: "Choose at least one festival day for this child.",
  }),
});

export const AttendeeGroupSchema = z.strictObject({
  adults: z.array(AdultAttendeeSchema).default([]),
  children: z.array(ChildAttendeeSchema).default([]),
  toddlers: z
    .array(ToddlerAttendeeSchema)
    .max(MAX_TODDLERS_PER_BOOKING, {
      error: `You can add at most ${MAX_TODDLERS_PER_BOOKING} children under 5 to one booking.`,
    })
    .default([]),
});
