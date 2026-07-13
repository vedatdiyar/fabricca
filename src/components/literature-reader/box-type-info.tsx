"use client";

interface BoxTypeInfoProps {
  boxType: string | null | undefined;
}

const BOX_TYPE_DESCRIPTIONS: Record<
  string,
  { title: string; description: string }
> = {
  PRIMARY_MATERIAL: {
    title: "Birincil Malzeme Alanı",
    description:
      "Bu alan, yapacağınız saha çalışması verileri (mülakat deşifreleri, anketler) veya kütüphanelerden toplayacağınız birincil kaynaklar (gazete, doküman, arşiv belgeleri) için ayrılmış size özel bir veri havuzudur. Onboarding tamamlandıktan sonra kendi belgelerinizi buraya yükleyebilirsiniz.",
  },
  CONTEXT: {
    title: "Bağlamsal Sınırlar Alanı",
    description:
      "Bu alan, tezinizin küresel/makro ve yerel/mikro çevresel arka plan faktörleri, yapısal olayları veya tarihsel/politik kısıtları için ayrılmış özel bir arka plan veri havuzudur. Onboarding tamamlandıktan sonra kendi bağlamsal belgelerinizi veya notlarınızı buraya ekleyebilirsiniz.",
  },
  RELATED_THESES: {
    title: "Sınırdaş Tez Havuzu",
    description:
      "Bu alan, özgünlük analizinde tespit edilen sınırdaş tez çalışmalarını barındırır.",
  },
};

export function getBoxTypeDescription(boxType: string | null | undefined) {
  return BOX_TYPE_DESCRIPTIONS[boxType ?? ""] ?? null;
}

export function BoxTypeInfo({ boxType }: BoxTypeInfoProps) {
  if (
    boxType !== "PRIMARY_MATERIAL" &&
    boxType !== "CONTEXT" &&
    boxType !== "RELATED_THESES"
  ) {
    return null;
  }

  const info = getBoxTypeDescription(boxType);

  if (!info) return null;

  return (
    <div className="p-6 border-b border-border/40 bg-primary/5">
      <div className="p-4 rounded-md bg-primary/10 border border-primary/20 leading-relaxed">
        <p className="font-medium text-foreground text-sm mb-1">{info.title}</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {info.description}
        </p>
      </div>
    </div>
  );
}
