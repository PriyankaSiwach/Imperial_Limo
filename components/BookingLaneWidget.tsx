"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const WIDGET_SRC =
  "https://bookinglane-widgets.s3.us-east-2.amazonaws.com/Widget/widget.js?token=31f2b325-c25a-4bc2-a798-cb1c179eca5d&lat=40.0393522&lng=-75.5997511";

/** BookingLane embed — omitted on the marketing home page (`/`). */
export default function BookingLaneWidget() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <>
      <div id="widget-by-bookinglane" />
      <Script id="bookinglane-widget" src={WIDGET_SRC} strategy="afterInteractive" />
    </>
  );
}