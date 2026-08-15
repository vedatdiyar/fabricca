import { Target, Compass, BookOpen, Microscope } from "lucide-react";
import type { ComponentType } from "react";

export type MatrixKey =
  "subjectProblem" | "theoreticalFramework" | "primaryMaterial" | "methodology";

export interface MatrixCardDef {
  key: MatrixKey;
  number: number;
  badgeLabel: string;
  title: string;
  description: string;
  placeholder: string;
  icon: ComponentType<{ className?: string }>;
  accentColor: string;
  badgeColor: string;
  guidingQuestions: string[];
}

export const MATRIX_CARDS: MatrixCardDef[] = [
  {
    key: "subjectProblem",
    number: 1,
    badgeLabel: "Problem & Odak",
    title: "1. Araştırma Problemi, Aktörler ve Odak",
    description:
      "Tezin ana problemi, hipotezi ve odaklandığı temel aktör/kurumlar",
    placeholder:
      "Tezin araştırma problemini, temel sorunsalını, ele aldığı aktörleri ve mekânsal/dönemsel sınırlarını yazın...",
    icon: Target,
    accentColor: "bg-primary/10 text-primary border-primary/20",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
    guidingQuestions: [
      "Tezin yanıt aradığı temel araştırma sorusu ve ana hipotez nedir?",
      "Hangi aktörler, kurumlar veya toplumsal yapılar analiz odağında yer alıyor?",
      "Araştırmanın dönemsel ve mekânsal sınırları nasıl belirlendi?",
    ],
  },
  {
    key: "theoreticalFramework",
    number: 2,
    badgeLabel: "Teorik Çerçeve",
    title: "2. Teorik ve Kavramsal Çerçeve",
    description:
      "Çalışmayı ele aldığınız teorik mercek, model ve ana kavramlar",
    placeholder:
      "Çalışmanın teorik merceğini, analitik kavramlarını ve kavramsal modelini yazın...",
    icon: Compass,
    accentColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    guidingQuestions: [
      "Çalışmada hangi teorik mercek ve kavramsal modeller temel alınıyor?",
      "Araştırmanın ana analitik kavramları ve bu kavramların tanımları nelerdir?",
      "Yapı-özne ilişkisi veya nedensellik mekanizmaları nasıl temellendiriliyor?",
    ],
  },
  {
    key: "primaryMaterial",
    number: 3,
    badgeLabel: "Ampirik Malzeme",
    title: "3. Birincil Malzeme ve Veri Kaynakları",
    description:
      "İnceleyeceğiniz ampirik belgeler, arşivler, metinler ve veriler",
    placeholder:
      "Birincil kaynakları, arşiv metinlerini, parti/kurum belgelerini ve ampirik malzemeleri yazın...",
    icon: BookOpen,
    accentColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    guidingQuestions: [
      "Hangi arşiv belgeleri, resmi tutanaklar, parti programları veya saha verileri taranacak?",
      "Kullanılacak ampirik malzemenin temsil gücü ve güvenilirliği nasıl sağlanıyor?",
      "Birincil kaynaklar ile ikincil akademik literatür arasındaki denge nasıl kurgulandı?",
    ],
  },
  {
    key: "methodology",
    number: 4,
    badgeLabel: "Metodoloji",
    title: "4. Metodoloji ve Kodlama Yöntemi",
    description:
      "Verileri analiz etme biçiminiz, kodlama tipolojiniz ve araştırma tasarımınız",
    placeholder:
      "Nitel/söylemsel analiz yönteminizi, kodlama tipolojinizi ve araştırma tasarımınızı yazın...",
    icon: Microscope,
    accentColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    guidingQuestions: [
      "Hangi nitel/tarihsel analiz, söylem analizi veya kodlama şeması uygulanacak?",
      "Kategoriler ve tipolojiler birincil metinlerden nasıl türetilecek?",
      "Analiz sürecinde yanlılığı önleme ve doğrulama mekanizmaları nelerdir?",
    ],
  },
];
