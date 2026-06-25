/**
 * Merkezi Session & Cookie Sabitleri (Single Source of Truth).
 *
 * Bu dosyadaki tüm değerler proje genelinde tek kaynaktır.
 * Hardcoded string/sayı kullanımını önlemek için buradan import edilir.
 */

/** Session cookie adı (Next.js cookie store key) */
export const SESSION_COOKIE_NAME = "fabricca_session";

/** Session cookie maksimum yaşam süresi (saniye) — 7 gün */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** Session bulunamadığında kullanıcıya gösterilecek hata mesajı */
export const SESSION_ERROR_MSG =
  "Oturum bulunamadı. Lütfen tekrar giriş yapın.";
