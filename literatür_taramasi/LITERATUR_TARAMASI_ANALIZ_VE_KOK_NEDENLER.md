# Literatür Taraması Sistemi: Canlı DB Analizi, Ampirik Testler ve Kök Neden Raporu

> **Tarih:** 4 Eylül 2026  
> **Statü:** Ampirik Olarak Doğrulandı & Güncellendi  
> **Kapsam:** Canlı veritabanı (`boxes`, `sources`), OpenAlex API, Cohere Rerank, Gemini Flash Jüri simülasyonları ve boru hattı orkestrasyonu.  
> **Mimari Anayasa:** `docs/LLM_INTEGRATION.md` Bölüm 8 (*Universality & Leakage Shield*).

---

## 1. Yönetici Özeti

Bu rapor, Fabricca literatür taraması boru hattının (`multi-channel-search.ts` -> `phase2-jury.ts` -> `phase3-selection.ts`) canlı veritabanı çıktılarını ve `POTANSIYEL_LITERATUR_KAYNAKLARI.md` ideal seed havuzuna kıyasla ortaya çıkan sapmaları inceler. Belgelenen tüm iddialar ve kök nedenler; canlı DB sorguları, OpenAlex API testleri ve tam boru hattı simülasyonuyla ampirik olarak test edilmiş, kanıtlanmış ve doğrulanmıştır.

---

## 2. Genel Durum Karşılaştırma Matrisi

| Alt Kutu ID | Kutu Türü & Başlığı | DB Örtüşme | Başarı | Ampirik Test ve Doğrulama Durumu |
| :---: | :--- | :---: | :---: | :--- |
| **187** | **Legal Siyasal Alan ve Kurumsal Hat** (`SUBJECT_PROBLEM`) | **3 / 4** | **%75** | **Doğrulandı:** Watts (1999), Watts (2010), Barkey (1998) seçili. Eksik Aylin Güney (2002), salt vektörde 0/50 kalırken sözcüksel aramada **1. sırada** çıkmaktadır. |
| **186** | **Yasadışı ve Silahlı Mücadele Hattı** (`SUBJECT_PROBLEM`) | **2 / 4** | **%50** | **Doğrulandı:** Gunes Kitap (2012) ve Akkaya & Jongerden (2012) seçili. Gunes Makale (2012) jüriden 90 aldı; Yeğen (2016) ise dar arama ifadesi nedeniyle havuz dışı kaldı ("peace negotiations" eklenince **1. sırada**). |
| **188** | **Manevra ve Mevzi Savaşları Ekolü** (`THEORETICAL_FRAMEWORK`) | **2 / 4** | **%50** | **Doğrulandı:** Egan Monografi (95 puan) ve Egan Makale (90 puan) seçildi. Egan'ın 3. makalesi (90 puan) doğrudan **`authorCounts >= 2` kotasına takılarak elendi**. Gramsci (1971) sözcükselde **1. sırada**. |
| **189** | **Eleştirel Söylem Analizi ve Yakın Okuma** (`METHODOLOGY`) | **0 / 4** *(Canlı DB)* | **%0** | **Ağ Darboğazı Kanıtlandı:** Donoghue (90 puan) ve Fairclough (95 puan) tekil simülasyonda 1. ve 2. seçilmektedir. Çoklu kutu paralel çalıştırmasında Channel 1b, `semanticQueue` (1 req/s) darboğazı ve 10 sn `withProviderTimeout` nedeniyle **0 sonuç** üretip havuza girememiştir. |

---

## 3. Alt Kutu Bazlı Ampirik Bulgular

### 3.1. Alt Kutu 186: Yasadışı ve Silahlı Mücadele Hattı (`SUBJECT_PROBLEM`)
* **Kutu Verisi:** `openAlexSearchPhrases: ["PKK political discourse 1990s", "Kurdish insurgency strategy Turkey"]`
* **Mevcut DB (`sources`):**
  1. `[ID: 824]` *The Kurdish National Movement in Turkey* — Cengiz Gunes (Monografi) — **[İDEAL]**
  2. `[ID: 825]` *Reassembling the Political...* — Akkaya & Jongerden (Makale) — **[İDEAL]**
  3. `[ID: 826]` *The PKK's Ideological Odyssey* — Ahmet Hamdi Akkaya (2020) — *(Tali odak)*
  4. `[ID: 827]` *The Ideological Transformation of the PKK...* — Güllistan Yarkın — *(Dar odak)*
* **Eksik Eserlerin Ampirik Test Sonuçları:**
  * **Cengiz Gunes (2012/2013), *Mobilization, Myth and Violence*:**
    * Channel 1a semantik aramada 2. sırada havuza girdi (`Relevance: 1.0368`).
    * Canlı simülasyonda jüriden **90 puan** aldı ve seçilen ilk 4 arasına girdi.
  * **Mesut Yeğen (2016), *Armed Struggle to Peace Negotiations* (`DOI: 10.1080/19436149.2016.1218162`):**
    * Channel 1a (Semantik 50) ve mevcut 2 arama ifadesinde: **BULUNAMADI (0/50)**.
    * Dönemsel kırılmayı içeren `"PKK peace negotiations democratic autonomy"` ifadesiyle sözcüksel aramada: **1. SIRADA BULUNDU**.

---

### 3.2. Alt Kutu 187: Legal Siyasal Alan ve Kurumsal Hat (`SUBJECT_PROBLEM`)
* **Kutu Verisi:** `openAlexSearchPhrases: ["HADEP electoral manifestos Turkey", "Kurdish legal parties 1990s"]`
* **Mevcut DB (`sources`):**
  1. `[ID: 828]` *Activists in Office* — Nicole F. Watts (Monografi) — **[İDEAL]**
  2. `[ID: 829]` *Allies and Enemies...* — Nicole F. Watts (Makale) — **[İDEAL]**
  3. `[ID: 830]` *The People's Democracy Party (HADEP)...* — Henri J. Barkey (Makale) — **[İDEAL]**
  4. `[ID: 831]` *Kurdish Politics in Turkey* — Cengiz Gunes (Kitap Bölümü) — *(İdeal listede yok)*
* **Eksik Eserin Ampirik Test Sonucu:**
  * **Aylin Güney (2002), *The People's Democracy Party* (`DOI: 10.1080/714005704`):**
    * Channel 1a (Semantik 50) ve Channel 1b (Semantik 10): **BULUNAMADI (0/50)**.
    * Sözcüksel başlık araması (`searchOpenAlexByTitleFilter`): **1. SIRADA BULUNDU** (`Authors: ["Aylın Güney"]`).

---

### 3.3. Alt Kutu 188: Manevra ve Mevzi Savaşları Ekolü (`THEORETICAL_FRAMEWORK`)
* **Kutu Verisi:** `openAlexSearchPhrases: ["Daniel Egan Gramsci war of position", "War of movement war of position spectrum"]`
* **Mevcut DB (`sources`):**
  1. `[ID: 832]` *The Dialectic of Position and Maneuver* — Daniel Egan (Monografi) — **[İDEAL]**
  2. `[ID: 833]` *Gramsci's War of Position as Siege Warfare...* — Daniel Egan (Makale) — **[İDEAL]**
  3. `[ID: 834]` *Anti-capitalism Within and Beyond Capitalism...* — İlhan Onur Acaroğlu — *(İdeal listede yok)*
  4. `[ID: 835]` *From Subordination to Revolution...* — John Chalcraft — *(İdeal listede yok)*
* **Ampirik Doğrulama (Yazar Kotası ve Gramsci):**
  * **Daniel Egan (2014), *Rethinking War of Maneuver/War of Position*:**
    * Channel 1b'de 2. sırada havuza girdi; jüriden **90 puan** aldı.
    * Ancak `phase3-selection.ts` içindeki `canSelectAuthor` fonksiyonu `(authorCounts.get("egan") >= 2)` şartı nedeniyle eseri **algoritmik olarak eledi**.
    * Yerine 85 puanlı Acaroğlu ve Chalcraft seçildi.
  * **Antonio Gramsci (1971), *Selections from the Prison Notebooks* (`W3033078819`):**
    * Semantik aramada 0/50 kaldı; sözcüksel aramada **1. SIRADA BULUNDU**.

---

### 3.4. Alt Kutu 189: Eleştirel Söylem Analizi ve Yakın Okuma (`METHODOLOGY`)
* **Kutu Verisi:** `openAlexSearchPhrases: ["Critical discourse analysis Gramscian approach", "Peter Ives language and hegemony"]`
* **Mevcut DB (`sources`):** ID 836–839 (Dunmire, Matytsina, Wedeen, Dedaić — İdeal havuz: 0/4).
* **Ampirik Doğrulama ve Ağ Darboğazı Keşfi:**
  * **Matthew Donoghue (2018), *Beyond Hegemony* (`DOI: 10.1177/0032321717722362`):**
    * Önceki rapordaki *"jüri eşik dalgalanması"* varsayımı **yanlışlanmıştır**.
    * Gerçek neden: Çoklu kutu çalıştırmasında 1 req/s limitli `semanticQueue`'da biriken istekler, `withProviderTimeout` (10000ms) sınırını aşmış ve Kutu 189'un Channel 1b çağrısı **iptal edilmiştir** (`openAlexTitleCount: 0`).
    * Kuyruk baskısı olmadan (izole) çalıştırıldığında Channel 1b 18 aday getirmiş, Donoghue jüriden **90 puan** alarak **2. sırada seçilmiştir**.
  * **Norman Fairclough (1995/2013), *Critical Discourse Analysis*:**
    * İzole simülasyonda jüriden **95 puan** alarak **1. sırada seçilmiştir**.
    * OpenAlex'teki 1992 tarihli *Discourse and Social Change* (W2007161913, 11.706 atıf) kaydı ise kitap incelemesini yazan "Dwight Fee" ile birleştirildiği için semantik aramalarda kaybolmaktadır.
  * **Peter Ives (2004), *Language and Hegemony in Gramsci*:**
    * Semantik arama doğrudan kitabın kendisini değil, **Niels Helsloot**'un yazdığı 2 adet kitap incelemesini getirmekte; `isBookReview` filtresi bunları haklı olarak elemektedir.
    * Sözcüksel başlık aramasında ise orijinal kitap (`W635152870`, Pluto Press) **1. SIRADA BULUNMAKTADIR**.

---

## 4. Doğrulanmış Yapısal ve Algoritmik Kök Nedenler

### Kök Neden 1: Çift Kanallı Arama Dengesizliği (Salt Vektör Kullanımı) — [DOĞRULANDI]
* `multi-channel-search.ts` içinde Channel 1b, yorum satırının aksine sözcüksel değil `searchOpenAlexTargetedSemantic` (vektörel) çağırmaktadır.
* `openalex-search.ts` içerisindeki sözcüksel `searchOpenAlexByTitleFilter` kodu hiçbir yerde kullanılmamaktadır.
* **Sonuç:** Gramsci (1971), Ives (2004) ve Aylin Güney (2002) semantik vektörde kaybolmakta; ancak sözcüksel aramayla 1. sıradan havuza girebilmektedir.

### Kök Neden 2: Algoritmik Yazar Kotası (`authorCounts >= 2`) — [DOĞRULANDI]
* `phase3-selection.ts:103` satırındaki `!surnames.some((s) => (authorCounts.get(s) || 0) >= 2)` kontrolü tek bir yazardan en fazla 2 eser kabul etmektedir.
* **Sonuç:** Daniel Egan'ın 3 temel eseri (95, 90, 90 puan) ilk 3 sırada olmasına rağmen 3. eser kod seviyesinde reddedilmiş, kontenjan 85 puanlı diğer yazarlara verilmiştir.

### Kök Neden 3: Sosyal Bilimlerde "Book Review Tuzağı" — [DOĞRULANDI & GENİŞLETİLDİ]
* OpenAlex semantik vektörü, beşeri bilimlerde monografilerin yerine dergilerde yayımlanan kısa kitap inceleme yazılarını getirmektedir (Peter Ives -> Niels Helsloot; Norman Fairclough -> Dwight Fee).
* `isBookReview` filtreleri bu yazıları doğru şekilde elemekte; ancak sözcüksel geri-izleme mekanizması olmadığı için ana kitaplar kaybolmaktadır.

### Kök Neden 4: Arama İfadelerinin Kapsam Sınırı — [DOĞRULANDI]
* Kutu 186'daki ifadeler yalnızca "isyana/söyleme" odaklıdır. Dönemsel kırılma terimleri ("peace negotiations", "democratic autonomy") bulunmadığı için Mesut Yeğen gibi dönemeç eserleri semantik uzayda dışarıda kalmaktadır.

### Kök Neden 5: Paralel Kuyruk Kilitlenmesi ve Zaman Aşımı İptali — [YENİ KEŞİF / DÜZELTİLDİ]
* `semanticQueue` OpenAlex kuralı gereği **1 req/s** hız limitine sahiptir.
* 4 kutu aynı anda `executePhase1Search` başlattığında 12 semantik istek kuyruğa girmekte, kuyruk gecikmesi `PROVIDER_TIMEOUT_MS = 10000` (10 saniye) sınırını aşmaktadır.
* Kuyrukta bekleyen Channel 1b istekleri `AbortController` ile sessizce iptal edilmekte (`openAlexTitleCount: 0`), Donoghue ve türevi 1b adayları havuza girememektedir.

---

## 5. Madde 8 Evrensellik İlkeleri Doğrultusunda Çözüm Stratejisi

Hiçbir teze, yazara veya esere özel istisna yapılmaksızın uygulanacak mimari çözümler:

1. **Channel 1b'yi Hızlı Sözcüksel Kuyruğa Taşıma (`openAlexQueue`):**
   * Channel 1b, 1 req/s'lik `searchOpenAlexTargetedSemantic` yerine, 100 req/s limitli `searchOpenAlexByTitleFilter` fonksiyonunu çağırmalıdır. Bu adım kuyruk zaman aşımını tamamen bitirirken kanonik kitapları 1. sıradan havuza çeker.
2. **Kutu Türüne Duyarlı / Puan Korumalı Yazar Kotası:**
   * `phase3-selection.ts` içinde `THEORETICAL_FRAMEWORK` kutularında yazar tavanı 3'e esnetilmeli veya jüri puanı 90+ olan kurucu metinlerde tekil yazar doyum bariyeri esnetilmelidir.
3. **Çok Boyutlu Arama İfadeleri (Multi-Facet Search Phrasing):**
   * Kutu üretim isteminde (`semantic-query.prompt.ts`) üretilen arama ifadeleri dönemsel kırılmaları, kuramsal mekanizmaları ve kavramsal karşıtlıkları içerecek şekilde 3-4 ifadeye çıkarılmalıdır.
4. **Book Review Otomatik Çözümleme (Title Disambiguation):**
   * `isBookReview` tarafından elenen kayıtlardan (`"Review of: [Eser]"`, `"... By [Yazar]"`) orijinal başlık ayıklanıp doğrudan sözcüksel arama kuyruğuna beslenmelidir.
