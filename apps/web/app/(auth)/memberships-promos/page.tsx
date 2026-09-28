import { redirect } from "next/navigation";

export default function LegacyMembershipsRedirect() {
  redirect("/memberships");
}
