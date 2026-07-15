import { redirect } from "next/navigation";

// Root path always resolves to either the SOC overview (if authenticated)
// or the login page — proxy.ts enforces the actual auth check and
// will intercept this redirect target when there is no sns_token cookie.
export default function RootPage() {
  redirect("/overview");
}
