import type { ThesisMatrix } from "../../types";

export function buildThesisBoxGenerationPrompt(params: ThesisMatrix): string {
  const matrixJson = JSON.stringify(params, null, 2);
  return `# Girdi Bağlamı
${matrixJson}

# Birincil Görev
Sistem talimatındaki evrensel alokasyon kurallarını ve kadran bazlı sorgu izole standartlarını uygulayarak 5 kadranlı epistemolojik kutu yapısını JSON formatında üretin.

# Kadran İzole Teyit Talimatı
Aşağıdaki kadran bazlı \`semanticQuery\` izolasyon kurallarına harfiyen uyun:
- **CONCEPTUAL**: \`semanticQuery\` alanı saf teorik olmalı, ampirik vaka, aktör veya coğrafi ad içermemelidir. Kuramcı isimleri, soyut kavramlar ve felsefi mekanizmalar 2-4 cümlelik (300-800 karakter) zengin İngilizce paragraf olarak yazılmalıdır.
- **DATA_PROTOCOL**: \`semanticQuery\` alanı saf metodolojik olmalı, ampirik vaka veya aktör adı içermemelidir. Metodoloji, analiz teknikleri ve veri standartları 2-4 cümlelik zengin İngilizce paragraf olarak yazılmalıdır.
- **PROBLEMATIZATION ve CONTEXT**: \`semanticQuery\` alanı tez matrisindeki ampirik aktörleri, tarihsel dönemi, coğrafi parametreleri ve ampirik gerilimleri tanımlayan 2-4 cümlelik zengin İngilizce paragraflar olarak yazılmalıdır.
- **PRIMARY_MATERIAL**: \`semanticQuery\` her zaman boş string (\`""\`) olmalıdır.

# Dil Kuralı
"title", "description" ve "concepts" alanlarının tamamı akademik Türkçe; yalnızca \`semanticQuery\` alanı İngilizce olmalıdır.`;
}
