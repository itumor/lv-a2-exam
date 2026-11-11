import { redirect } from "next/navigation";

// ponytail: no landing page yet (spec route "/"); go straight to the dashboard.
export default function Home() {
  redirect("/dashboard");
}
