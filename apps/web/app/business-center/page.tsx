import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The Business Centre (BSK) is now part of the one Dantown Centre.
export default function BusinessCenterRedirect() {
  redirect("/centre");
}
