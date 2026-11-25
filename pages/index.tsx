import { BookingFlow } from "@/components/booking/booking-flow";
import type { Props } from "./index.server";
import "./style.css";

export default function HomePage({ availability }: Props) {
  return <BookingFlow availability={availability} />;
}
