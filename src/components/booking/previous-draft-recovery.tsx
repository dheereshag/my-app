import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useBookingStore } from "@/store/booking-store";

export function PreviousDraftRecovery({
  restoreFailed,
  onStartOver,
}: {
  readonly restoreFailed: boolean;
  readonly onStartOver: () => void;
}) {
  const previousCheck = useBookingStore((store) => store.previousCheck);
  const checkPreviousBooking = useBookingStore((store) => store.checkPreviousBooking);
  const checking = previousCheck.status === "checking";

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl items-center px-4 py-12">
      <Card className="w-full bg-white/5 ring-white/20">
        <CardHeader>
          <CardTitle>
            <h1 className="font-heading text-3xl font-semibold">
              {restoreFailed
                ? "We couldn't restore your saved booking"
                : "Check your previous booking"}
            </h1>
          </CardTitle>
          <CardDescription className="text-base">
            {restoreFailed
              ? "Your saved data has not been changed. Contact the organizer before starting over."
              : "The festival dates have changed. Your previous booking may already have been completed, even if its confirmation was not shown."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {previousCheck.status === "failed" ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>We couldn't confirm the previous booking</AlertTitle>
              <AlertDescription>{previousCheck.message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            {!restoreFailed ? (
              <Button type="button" disabled={checking} onClick={() => void checkPreviousBooking()}>
                {checking ? <Spinner aria-hidden="true" data-icon="inline-start" /> : null}
                {checking ? "Checking..." : "Check previous booking"}
              </Button>
            ) : null}
            <Button type="button" variant="outline" disabled={checking} onClick={onStartOver}>
              Start a new booking
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Starting over creates a separate booking and replaces this saved draft.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
