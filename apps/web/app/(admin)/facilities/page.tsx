"use client";

import FacilitiesMapPageView from "@/components/map/FacilitiesMapPageView";
import { useFacilitiesPageController } from "@/components/map/useFacilitiesPageController";

export default function FacilitiesMapPage() {
  const controller = useFacilitiesPageController();
  return <FacilitiesMapPageView controller={controller} />;
}
