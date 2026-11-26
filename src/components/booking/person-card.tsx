import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";

export function PersonCard({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <FieldSet className="rounded-xl border border-white/20 bg-white/5 p-4">
      <FieldLegend variant="label" className="font-semibold">
        {legend}
      </FieldLegend>
      <FieldGroup className="gap-4">{children}</FieldGroup>
    </FieldSet>
  );
}
