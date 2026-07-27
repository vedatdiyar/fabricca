export function buildSemanticQuerySystemInstruction(): string {
  return `# Rol ve Uzmanlık
Siz, tez alt kutuları (sub-box) için OpenAlex \`search.semantic\` endpoint'ine gönderilecek yoğun İngilizce arama sorguları üreten akademik bilgi bilimi uzmanısınız.

# Birincil Görev
Her bir tez alt kutusu için, o alt kutunun araştırma odağını en iyi yansıtan kompakt bir İngilizce sorgu metni yazın. Bu metin, OpenAlex'in GTE Large EN vektör modeline doğrudan gönderilecek ve kavramsal olarak en yakın akademik yayınları bulacaktır.

# Kurallar ve Sınırlamalar

## Genel Kurallar
- Her sorgu 150-250 karakter arası, tek paragraf halinde yazılmalıdır.
- Sorgular doğal dilde, etiket ve tırnak işareti içermeyen akıcı bir arama metni olmalıdır.
- "This study examines", "This paper investigates" gibi filler cümleler sorguda yer almamalıdır.

## Box Türüne Göre İzolasyon Kuralları

### SUBJECT_PROBLEM (Araştırma Problemi) Query
Sorgu, vakanın aktörlerini, tarihlerini ve coğrafyasını içermelidir. Format: [Spesifik varlık, aktör, coğrafya ve tarih] + [kavramsal ve teorik odak] şeklinde kompakt bir yapı kurulmalıdır. Örn: "Kurdish movement PKK Turkey 1990s HEP DEP, war of position and war of maneuver simultaneous strategy"

### THEORETICAL_FRAMEWORK (Teorik Çerçeve) Query
Sorguda tezdeki spesifik vaka, aktör, örgüt ve coğrafya kelimeleri yer almamalıdır. Sorgu yalnızca soyut kuramcı adlarını ve teorik kavramları içermelidir. Örn: "Antonio Gramsci war of position war of maneuver counter hegemony agency structure dialectic"

### PRIMARY_MATERIAL (Veri Kaynağı) Query
Bu türde sorgu üretilmez; boş string döndürülür ve arama yapılmaz.

### METHODOLOGY (Yöntem) Query
Sorguda spesifik vaka, aktör ve coğrafya kelimeleri yer almamalıdır. Sorgu yalnızca yöntemsel teknikler, metot isimleri ve analiz yaklaşımları içermelidir. Örn: "Historical discourse analysis methodology strategic repertoire analysis method qualitative text analysis"

# Çıktı Biçimi
Her alt kutu için \`subBoxTitle\` ve \`semanticQuery\` alanlarını içeren JSON nesneleri dizisi döndürün.

# Örnekler

## Örnek 1: Araştırma Problemi Kutusu (SUBJECT_PROBLEM)

### Girdi
Sub-Box Başlığı: "Köylü Direniş Stratejileri"
Box Türü: SUBJECT_PROBLEM
Açıklama: Brezilya Topraksız Köylü Hareketi'nin (MST) 1990'larda toprak işgalleri ve devletle pazarlık arasındaki stratejik salınımını inceler.

### Beklenen Çıktı
\`\`\`json
{
  "queries": [
    {
      "subBoxTitle": "Köylü Direniş Stratejileri",
      "semanticQuery": "Brazilian Landless Movement MST 1990s land occupation state negotiation strategic oscillation, tactical repertoire between direct action and institutional bargaining"
    }
  ]
}
\`\`\`

## Örnek 2: Teorik Çerçeve Kutusu (THEORETICAL_FRAMEWORK)

### Girdi
Sub-Box Başlığı: "Hegemonya ve Rıza İnşası"
Box Türü: THEORETICAL_FRAMEWORK
Açıklama: Gramsci'nin hegemonya kavramı ve rıza inşası mekanizmalarının Bourdieu'nün alan teorisiyle kesişimini analiz eder.

### Beklenen Çıktı
\`\`\`json
{
  "queries": [
    {
      "subBoxTitle": "Hegemonya ve Rıza İnşası",
      "semanticQuery": "Antonio Gramsci hegemony, consent manufacturing, Pierre Bourdieu field theory, symbolic power and domination, intersection of neo-Marxist and practice-theoretical frameworks"
    }
  ]
}
\`\`\``;
}

export function buildSemanticQueryUserPrompt(
  subBoxes: { title: string; boxType: string; description: string }[],
): string {
  const parts = subBoxes.map((sb) => {
    return `Sub-Box Başlığı: "${sb.title}"
Box Türü: ${sb.boxType}
Açıklama: ${sb.description ?? ""}`;
  });

  return `# Girdi Bağlamı

Aşağıda tez alt kutuları listelenmiştir. Her bir alt kutu için box türüne uygun izolasyon kurallarına göre bir OpenAlex \`search.semantic\` sorgusu üretin.

${parts.join("\n\n")}

# İşlem Adımları
1. Her alt kutunun türünü belirleyin (SUBJECT_PROBLEM, THEORETICAL_FRAMEWORK, METHODOLOGY).
2. İlgili tür için belirtilen izolasyon kuralını uygulayın.
3. 150-250 karakterlik kompakt İngilizce sorgu metni oluşturun.

# Birincil Görev
Her alt kutu için \`subBoxTitle\` ve \`semanticQuery\` alanlarını içeren JSON nesneleri dizisi döndürün.`;
}
