import { CalendarX2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT_METADATA } from "@/domain";

export function EventClosed() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl items-center px-4 py-12">
      <Card className="w-full bg-white/5 ring-white/20">
        <CardHeader>
          <Badge variant="secondary" className="w-fit">
            <CalendarX2 aria-hidden="true" data-icon="inline-start" />
            Booking closed
          </Badge>
          <CardTitle className="font-heading text-3xl font-semibold sm:text-4xl">
            {EVENT_METADATA.name} has ended
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            The festival ran {EVENT_METADATA.dateRangeLabel}. New bookings are no longer available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If you already have a booking, use your confirmation reference at the door.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
