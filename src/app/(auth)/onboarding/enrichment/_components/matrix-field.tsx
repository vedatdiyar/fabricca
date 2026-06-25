"use client";

import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface MatrixFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** İki haneli alan numarası rozeti (ör: "01"). */
  number?: string;
  /** Alan başlığının yanında gösterilecek Lucide ikonu. */
  Icon?: LucideIcon;
  /** Alan altında gösterilen yardımcı/bilgilendirme metni. */
  hint?: string;
}

/**
 * MatrixField — enrichment adımı için düzenlenebilir matris alanı.
 * Numara rozeti, ikon ve ipucu metni desteğiyle alan kartı render eder.
 * Enrichment adımında `border-primary/20` sınırı ile AI çıktısı olduğu belirtilir.
 *
 * @param props - Bileşen prop'ları
 * @param props.id - Input elementinin benzersiz kimliği
 * @param props.label - Kullanıcıya gösterilen alan başlığı
 * @param props.value - Input'un mevcut değeri
 * @param props.onChange - Değer değiştiğinde tetiklenen callback
 * @param props.required - Alanın zorunlu olup olmadığı
 * @param props.number - İki haneli alan numarası rozeti (ör: "01")
 * @param props.Icon - Alan başlığının yanında gösterilecek Lucide ikonu
 * @param props.hint - Alan altında gösterilen yardımcı açıklama metni
 */
export function MatrixField({
  id,
  label,
  value,
  onChange,
  required = true,
  number,
  Icon,
  hint,
}: MatrixFieldProps) {
  return (
    <Card className="space-y-2 p-4 hover:border-primary/20 rounded-md">
      <div className="flex items-center gap-2">
        {number && (
          <span className="inline-flex h-5 w-7 items-center justify-center rounded bg-primary/10 text-[10px] font-bold tracking-wider text-primary">
            {number}
          </span>
        )}
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <Label
          htmlFor={id}
          className="cursor-pointer text-sm font-semibold text-foreground"
        >
          {label}
        </Label>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="textarea-academic border-border"
      />
      {hint && (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      )}
    </Card>
  );
}
