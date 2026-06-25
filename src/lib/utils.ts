import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind CSS sınıflarını birleştirmek için yardımcı fonksiyon.
 * clsx ile koşullu sınıf birleştirmesi yapar,
 * tailwind-merge ile çelişen sınıfları çözer.
 *
 * @param inputs - Birleştirilecek sınıf değerleri
 * @returns Birleştirilmiş ve çözülmüş sınıf stringi
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
