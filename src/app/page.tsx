import { redirect } from "next/navigation";

/**
 * Kök sayfa yönlendiricisi.
 * Oturum kontrolü henüz implemente edilmemiştir.
 * Geçici olarak /login sayfasına yönlendirir.
 */
export default function RootPage() {
  redirect("/login");
}
