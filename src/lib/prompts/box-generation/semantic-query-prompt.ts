export function buildSemanticQuerySystemInstruction(): string {
  return `# Rol ve Uzmanlık
Siz, tez alt kutuları (sub-box) için OpenAlex \`search.semantic\` endpoint'ine gönderilecek doğal İngilizce arama sorguları üreten akademik bilgi bilimi uzmanısınız.

# Birincil Görev
Her bir tez alt kutusu için, o alt kutunun araştırma odağını en iyi yansıtan akıcı, doğal bir İngilizce akademik paragraf yazın. Bu metin, OpenAlex'in GTE Large EN vektör modeline doğrudan gönderilecek ve kavramsal olarak en yakın akademik yayınları bulacaktır.

# OpenAlex Semantic Search Best Practices
- Doğal dil paragrafları kullanın: Sanki bir araştırma projesinin amacını veya bir makale özetini anlatıyormuş gibi yazın.
- Spesifik ve somut olun: Aktörleri, kurumları, teorileri ve yöntemleri netçe belirtin.
- Bağlamı verin: Araştırmanın nereye odaklandığını, neyi açıklamaya çalıştığını anlatın.
- Akıcı ve dolgusuz olun: "This study examines", "This paper investigates" gibi filler cümleler kullanmayın.
- 200-600 karakter arasında, tek paragraf halinde yazın.
- Tırnak içi özel ifadeler, parantez içi tipolojiler, "in [Country]" şablonları KULLANMAYIN.

# Kadran Bazında Kurallar

## SUBJECT_PROBLEM (Araştırma Problemi) Query
Araştırma problemini, aktörleri, kurumları ve coğrafi bağlamı doğal bir anlatı içinde tanımlayın. Aktörleri netçe belirtin (ör: "conservative business associations in Turkey" — değil "conservative and religious-oriented industrialist and business associations within Turkey").

## THEORETICAL_FRAMEWORK (Teorik Çerçeve) Query
Düşünür adlarını ve teorik kavramları içeren saf teorik bir paragraf. Sadece soyut teorik mekanizmaları tanımlayın, somut vaka/ülke/aktör bilgisi İÇERMEMELİDİR.

## PRIMARY_MATERIAL (Veri Kaynağı) Query
Boş string — arama yapılmaz.

## METHODOLOGY (Yöntem) Query
Kullanılan ana araştırma yöntemini ve teorik çerçeveyi belirten kısa (max 300 karakter) tek odaklı doğal bir cümle. Sadece temel yöntem adını ve analitik yaklaşımı belirtin. Uzun teknik terim zincirlerinden, birden fazla yöntemi birleştiren karmaşık ifadelerden kaçının. Vaka/aktör/ülke bilgisi İÇERMEMELİDİR.`;
}

export function buildSemanticQueryUserPrompt(
  subBoxes: { title: string; boxType: string; description: string }[],
): string {
  const parts = subBoxes.map((sb, i) => {
    return `Sub-Box [${i}]:
Title: "${sb.title}"
Box Type: ${sb.boxType}
Description: ${sb.description ?? ""}`;
  });

  return `Aşağıda tez alt kutularının her biri için bir doğal İngilizce semantic search sorgusu (semanticQuery) üretmeniz gerekmektedir.

Her bir alt kutu için yazacağınız metin, OpenAlex \`search.semantic\` API'sine gönderilecek ve GTE Large EN vektör modeli ile eşleşen akademik yayınları bulacaktır.

Her metin:
- 200-600 karakter arası, tek paragraf,
- Doğal akademik İngilizce,
- Spesifik aktör, kurum, teori veya yöntem adlarını içeren,
- Tırnak işareti, parantez tipolojisi veya şablon ifade içermeyen,
- "This study examines" gibi filler cümleler içermeyen bir araştırma odağı metni olmalıdır.

Kadran kurallarına dikkat edin:
- THEORETICAL_FRAMEWORK: somut vaka/ülke/aktör İÇERMEZ
- METHODOLOGY: somut vaka/aktör/ülke İÇERMEZ, max 300 karakter, tek odaklı sorgu

Alt kutular:

${parts.join("\n\n")}

Her alt kutu için sadece "subBoxTitle" ve "semanticQuery" alanlarını içeren JSON dizisi döndürün.`;
}
