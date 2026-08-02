import { redirect } from "next/navigation";

/** Root page redirector — temporarily redirects to /login. */
export default function RootPage() {
  redirect("/login");
}
