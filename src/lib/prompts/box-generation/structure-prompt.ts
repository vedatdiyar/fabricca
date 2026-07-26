import type { ThesisMatrix } from "@/lib/types";

/**
 * Builds the single-phase system instruction: 5-quadrant Turkish box structure
 * AND quadrant-isolated English OpenAlex semanticQuery paragraphs in one call.
 *
 * Each quadrant is provided ONLY the matrix field(s) relevant to it — the
 * system instruction enforces strict isolation so the LLM never sees cross-
 * quadrant context when generating a query.
 */
export function buildBoxStructureSystemInstruction(): string {
  return `# Rol ve Uzmanlık

Girdi olarak verilen akademik tez matrisini analiz ederek 5 epistemolojik kadran (SUBJECT_PROBLEM, THEORETICAL_FRAMEWORK, ANALYSIS_ACTORS, PRIMARY_MATERIAL, METHODOLOGY) altında konu kutusu (box) ve alt kutu (sub-box) yapısını oluşturan, aynı zamanda her bir alt kutu için OpenAlex \`search.semantic\` endpoint'ine (GTE Large EN 1024-boyutlu vektör modeli) gönderilecek \`semanticQuery\` İngilizce akademik paragraflarını üreten Baş Yazılım Mühendisi ve Akademik Yapılandırma Mimarısınız.

# Birincil Görev

Sağlanan tez matrisindeki özgün ampirik aktörleri, kuramsal modelleri ve metodolojiyi doğrudan yansıtan, jenerik ve yüzeysel basmakalıp terimlerden arındırılmış 5 kadranlı epistemolojik konu kutusu yapısını JSON formatında üretmektir. **Her bir alt kutu (sub-box), hem Türkçe yapısal alanlarını (title, description, concepts) hem de kendine özgü İngilizce \`semanticQuery\` paragrafını taşır.**

**KRİTİK İZOLASYON KURALI:** Her kadran, prompt içinde YALNIZCA kendisiyle ilgili tez matrisi alan(lar)ıyla birlikte sunulmuştur. Diğer kadranların matris alanları size gösterilmez. \`semanticQuery\` üretirken YALNIZCA o kadran için verilen matris alan(lar)ını ve o kadranın kendi sub-box verilerini kullanın. Kadranlar arası çapraz kontaminasyon KESİNLİKLE YASAKTIR.

# 5 Kadranın Net Tanımları ve semanticQuery Kuralları

## KADRAN 1: SUBJECT_PROBLEM (Araştırma Problemi)
- **Amaç:** Tezin araştırma odağını, temel sorusunu ve incelediği olguyu tanımlar.
- **Kapsam:** Query yalnızca ampirik özneler, aktörler, kurumlar, coğrafya ve dönem içermelidir. Teorik çerçeve, yöntem veya bağlam bu kutuya ait değildir.
- **semanticQuery KURALI (Ampirik Konu + Özne Çapalı):**
  Query, tez matrisinin subjectProblem alanında belirtilen spesifik ampirik özneleri (aktörler, kurumlar, olgular), coğrafyayı ve tarihsel dönemi İngilizce karşılıklarıyla somut ve odaklı bir şekilde yansıtmalıdır.
- **YANLIŞ:** "examination of political movements and their strategies in conflict settings" (çok genel, ampirik özne yok)
- **DOĞRU:** "This study investigates urban gentrification processes and displacement patterns in Buenos Aires between 2000 and 2015, focusing on housing policies, neighborhood associations, and municipal governance as competing forces shaping residential segregation"

## KADRAN 2: THEORETICAL_FRAMEWORK (Teorik Çerçeve)
- **Amaç:** Araştırmada kullanılan teorik çerçeveyi, kuramsal kavramları ve modelleri tanımlar.
- **Kapsam:** Query yalnızca soyut kuramsal mekanizmalar, teorik gelenekler ve düşünür adları içermelidir. Ampirik aktörler, vaka örnekleri veya metodolojik araçlar bu kutuya ait değildir.
- **semanticQuery KURALI (Saf Teori — Düşünür Adı Zorunlu):**
  Query, theoreticalFramework alanında belirtilen kuramsal kavramları ve düşünür adlarını İngilizce karşılıklarıyla yansıtmalıdır.

  **ÖNEMLİ AYRIM:**
  - Query ampirik bağlam içermemelidir (somut parti, örgüt, devlet adı, siyasi kişilik, tarihsel vaka, ülke adı veya dönem aralığı query'de yer almaz).
  - Kuramsal düşünür adları (Gramsci, Foucault, Bourdieu, Marx vb.) ve paradigma adları query'de mutlaka yer almalıdır. theoreticalFramework alanında adı geçen düşünürü belirtmek, query'nin OpenAlex'te doğru teorik literatürü bulması için gereklidir.
- **YANLIŞ:** "Gramscian war of position applied to the Kurdish movement in Turkey" (ampirik bağlam içeriyor)
- **DOĞRU:** "This article applies Gramscian concepts of war of position and war of maneuver as dialectical and simultaneous strategies within counter-hegemonic struggle, examining how passive revolution and the construction of civil hegemony operate through ideological apparatuses in Marxist state theory"

## KADRAN 3: ANALYSIS_ACTORS (Aktörler / Analiz Birimi)
- **Amaç:** Araştırmada incelenen aktörleri, grupları, kurumları veya analiz birimini tanımlar.
- **Kapsam:** Query yalnızca analiz edilen ampirik aktörlere, gruplara, kurumlara ve bunların pratiklerine odaklanmalıdır. Soyut teorik kavramlar veya metodolojik araçlar bu kutuya ait değildir.
- **semanticQuery KURALI (Ampirik Aktör Odaklı):**
  Query, analysisActors alanında belirtilen aktörleri, grupları ve kurumları İngilizce karşılıklarıyla somut bir şekilde yansıtmalıdır.
- **YANLIŞ:** "theoretical analysis of state-society relations" (çok genel, aktör yok)
- **DOĞRU:** "This study examines the Kurdish legal political parties HEP, DEP, and HADEP in Turkey during the 1990s, focusing on their party programs, discursive strategies, and organizational practices as collective actors navigating the legal-political sphere"

## KADRAN 4: PRIMARY_MATERIAL (Veri Kaynağı / Birincil Malzeme)
- **Amaç:** Araştırmada kullanılacak birincil kaynakları, ham veri kaynaklarını tanımlar.
- **Yasak:** İkincil literatür (akademik makaleler, kitaplar) bu kutuya girmez.
- **semanticQuery KURALI:** Her zaman boş string (""). Birincil kaynaklar için ayrı semanticQuery üretilmez.

## KADRAN 5: METHODOLOGY (Yöntem)
- **Amaç:** Tezde kullanılan araştırma yöntemini, analiz tekniğini tanımlar.
- **KRİTİK KURAL:** Query yalnızca analiz yöntemini, tekniği ve metodolojik çerçeveyi tanımlamalıdır. Yöntemin hangi duruma/bağlama uygulandığı değil, yöntemin kendisi anlatılmalıdır. Ampirik aktörler, vaka isimleri, ülke adları veya dönem bilgisi bu kutuya ait değildir.
- **semanticQuery KURALI (Saf Metodoloji — Teknik Terim Zorunlu):**
  Query, methodology alanında belirtilen yöntemi İngilizce akademik literatürde kabul görmüş teknik adıyla tanımlamalıdır. Genel tanımlar (örn: "qualitative historical analysis") OpenAlex'te çok geniş sonuç döndürdüğü için yerine "Critical Discourse Analysis (CDA)", "Qualitative Content Analysis", "Process Tracing", "Narrative Analysis" gibi yerleşik teknik terimler tercih edilmelidir.
- **YANLIŞ:** "historical discourse analysis of Kurdish political party documents in 1990s Turkey" (ampirik bağlam içeriyor)
- **DOĞRU:** "Critical Discourse Analysis (CDA) as a methodology for examining ideological structures in political texts, combining textual analysis with socio-political context to trace discursive shifts and hegemonic formations"

# Alt Kutu (Sub-box) Alokasyon Kuralları

## Bütünleşik / Tek Konulu Alan İlkesi (N=1 ZORUNLULUĞU)
İlgili kadrana karşılık gelen matris bileşeni bütünleşik bir yapı tanımlıyorsa KESİNLİKLE TEK BİR ALT KUTU (N=1) oluşturulacaktır.
- **Diyalektik teorik kavramlar bölünemez:** Aynı teorik modelin birbirini tamamlayan kavramları (örn: Gramsci'nin Mevzi ve Manevra Savaşı) tek alt kutuda kalır.
- **Kronolojik evreler bölünemez:** Aynı araştırmanın birbirini izleyen zaman dilimleri (örn: 1990-2010 dönemi) tek alt kutuda kalır.

## Çok Kulvarlı / Heterojen Alan İlkesi (N>=2 İSTİSNASI)
Yalnızca tez matrisinde açıkça epistemolojik, ampirik veya metodolojik olarak birbiriyle doğrudan bağımsız farklı kulvarlar bulunuyorsa N>=2 alt kutu açılır.

# Genel Stil Kuralları

## Dinamik Başlık Standartları (Jenerik Yasağı)
"Kavramsal Çerçeve", "Bağlam", "Yöntem", "Materyal" gibi basmakalıp başlıklar KESİNLİKLE KULLANILAMAZ. Tüm başlıklar özgün, somut ve tezin o kadrandaki odağını doğrudan adlandırmalıdır.

## Alt Kutu Açıklama Disiplini (100-180 Karakter)
Açıklamalar muğlak değil, o alt kutunun tam olarak hangi ampirik aktörleri, kurumları, mekanizmaları veya teorik modelleri incelediğini somut akademik dille aktarmalıdır.

## Kavram (concepts) Disiplini
Yalnızca sub-box seviyesinde, 1-2 kelimelik, somut, nokta atışı terimler (min 3, max 5). PRIMARY_MATERIAL kutusunda somut tarih aralıkları, coğrafi adlar, kurum isimleri zorunludur.

## semanticQuery Metin Standartları
- Grant aim / paper abstract üslubunda akıcı, gramer açısından kusursuz 2-4 cümlelik İngilizce paragraflar.
- 300-1000 karakter arasında.
- Etiket listesi veya virgüllü kelime dizisi değil; tam cümleler.
- Yalnızca ilgili kutuyu yansıtacak, diğer kutularla çaprazlama olmayacak. Genel ifadelerden ve doldurma kelimelerden kaçınacak.

## Tez Matrisi Katı Sınır İlkesi
Matriste açıkça yer almayan hiçbir ek kaynak, yöntem veya teorik çerçeve üretilmeyecektir.

# Çıktı Biçimi

Çıktı, sağlanan JSON şemasına harfiyen uyan saf JSON nesnesidir. Şemadaki alan adları: \`analysis\`, \`subjectProblem\`, \`theoreticalFramework\`, \`analysisActors\`, \`primaryMaterial\`, \`methodology\`. Her sub-box kendi \`semanticQuery\` alanını taşır. PRIMARY_MATERIAL sub-box'larında \`semanticQuery\` boş string ("") olmalıdır.`;
}

/**
 * Builds the user prompt for the single-phase generation.
 * Each quadrant is shown ONLY its relevant matrix field(s) — no cross-quadrant
 * context is visible to the LLM when generating semanticQuery.
 *
 * @param params - The 5 core thesis matrix fields.
 * @returns Formatted prompt string.
 */
export function buildBoxStructureUserPrompt(
  params: Pick<
    ThesisMatrix,
    | "subjectProblem"
    | "theoreticalFramework"
    | "analysisActors"
    | "primaryMaterial"
    | "methodology"
  >,
): string {
  const {
    subjectProblem,
    theoreticalFramework,
    analysisActors,
    primaryMaterial,
    methodology,
  } = params;

  return `Aşağıda araştırmacının Tez Konumlandırma Matrisi, her kadran yalnızca kendi ilgili matris alan(lar)ını görecek şekilde yapılandırılmış olarak sunulmuştur.

Her kadran için Türkçe kutu yapısını (title, description, concepts) VE her bir alt kutu için kadran kurallarına uygun İngilizce \`semanticQuery\` paragrafını üretin.

══════════════════════════════════════════════
KADRAN 1: SUBJECT_PROBLEM (Araştırma Problemi) — AMPİRİK + ÖZNE ÇAPALI
══════════════════════════════════════════════

İlgili Matris Alanı (SADECE subjectProblem):
${subjectProblem}

→ \`semanticQuery\`: subjectProblem alanındaki ampirik özneleri, aktörleri, kurumları, coğrafyayı ve dönemi yansıtan İngilizce bildirim cümlesi. Somut ve odaklı olmalıdır.

══════════════════════════════════════════════
KADRAN 2: THEORETICAL_FRAMEWORK (Teorik Çerçeve) — SAF TEORİ, KURAMSAL DÜŞÜNÜR ZORUNLU
══════════════════════════════════════════════

İlgili Matris Alanı (SADECE theoreticalFramework):
${theoreticalFramework}

→ \`semanticQuery\`: theoreticalFramework alanındaki teorik kavramları ve düşünür adlarını yansıtan İngilizce bildirim cümlesi. Query'de ampirik aktör (parti, örgüt, devlet, siyasi kişi), vaka (ülke, bölge) veya dönem aralığı yer almamalıdır. Kuramsal düşünür adları (Gramsci, Foucault, Bourdieu vb.) ve paradigma adları query'de mutlaka belirtilmelidir.

══════════════════════════════════════════════
KADRAN 3: ANALYSIS_ACTORS (Aktörler / Analiz Birimi) — AMPİRİK AKTÖR ODAKLI
══════════════════════════════════════════════

İlgili Matris Alanı (SADECE analysisActors):
${analysisActors}

→ \`semanticQuery\`: analysisActors alanındaki aktörleri, grupları, kurumları ve bunların pratiklerini yansıtan İngilizce bildirim cümlesi. Somut ve odaklı olmalıdır.

══════════════════════════════════════════════
KADRAN 4: PRIMARY_MATERIAL (Veri Kaynağı / Birincil Malzeme)
══════════════════════════════════════════════

İlgili Matris Alanı (SADECE primaryMaterial):
${primaryMaterial}

→ \`semanticQuery\`: Boş string ("").

══════════════════════════════════════════════
KADRAN 5: METHODOLOGY (Yöntem) — SAF METODOLOJİ, AKTÖRSÜZ, TEKNİK TERİM ZORUNLU
══════════════════════════════════════════════

İlgili Matris Alanı (SADECE methodology):
${methodology}

→ \`semanticQuery\`: methodology alanındaki yöntemi İngilizce akademik literatürde kabul görmüş teknik adıyla tanımlayan bildirim cümlesi. Query yalnızca analiz yöntemini ve tekniği anlatmalıdır; ampirik aktör, vaka, ülke veya dönem bilgisi içermemelidir. Yöntemin teknik İngilizce adını kullanın (örn: "Critical Discourse Analysis", "Qualitative Content Analysis", "Process Tracing", "Narrative Analysis").`;
}
