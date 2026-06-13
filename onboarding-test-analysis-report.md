# Fabricca Onboarding Süreci Uçtan Uca Test ve Tutarlılık Analiz Raporu

Bu rapor, neoliberal borçlandırma konulu bir yüksek lisans tezi matrisi girdisi kullanılarak, Fabricca onboarding sürecinin (Tez Matrisi Akademik Zenginleştirme, Özgünlük Analizi ve Konu Kutuları Oluşturma) adımlarının 5'er kez arka arkaya çalıştırılmasıyla elde edilen performans, hata, kalite ve tutarlılık (determinizm) analizlerini bir araya getirmektedir.

---

## 1. Test Parametreleri ve Girdi Verisi
- **Test Kullanıcısı:** `vedatdiyarcelikkeser@gmail.com`
- **Tarih:** 14 Haziran 2026
- **Tekrar Sayısı:** Adım başına 5 bağımsız iterasyon (Önbellekler temizlenerek çalıştırılmıştır)
- **Girdi Matrisi Özeti:**
  - *Çalışma Başlığı:* Neoliberalizmde Siyasal Bir İktidar İlişkisi Olarak Bireysel Borçlandırmanın İşleyişi: Türkiye Örneği
  - *Temel İddia:* Borçlandırılmış öznelerin pratik ve söylemleri pratiklerin işleyişinde kurucudur; neoliberal borçlu figürü "işçi-borçlu" olarak kurgulanmaktadır.
  - *Kuramsal Çerçeve:* Foucaultcu yönetimsellik ve Marksist sınıf analizi sentezi.
  - *Metodoloji:* Türkiye'de borçlularla derinlemesine nitel mülakatlar.

---

## 2. Genel Performans ve Süre Analizi Tablosu

| Test Edilen Onboarding Adımı (Server Action) | Başarı Oranı | Ortalama Süre (Avg) | Standart Sapma (StdDev) | En Kısa Süre (Min) | En Uzun Süre (Max) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Adım 1: submitThesisMatrixAction** | 5 / 5 (%100) | `16.817 ms` | `5.975 ms` | `9.476 ms` | `27.401 ms` |
| **Adım 3: startOriginalityAnalysisAction** | 5 / 5 (%100) | `112.616 ms` | `51.398 ms` | `55.107 ms` | `186.454 ms` |
| **Adım 4: generateBoxesForCurrentMatrixAction** | 5 / 5 (%100) | `37.963 ms` | `7.641 ms` | `24.129 ms` | `46.207 ms` |

- **Toplam Hata Oranı:** %0 (Çalıştırılan tüm adımlarda sıfır hata ile %100 başarı sağlanmıştır).
- **Süre Değerlendirmesi:** Adım 3 (Özgünlük Analizi), arka planda dış arama motoru sorguları (Tavily), yerel akademik veri tabanı (Tezara) taramaları ve çok aşamalı Gemini süzgeçleri kullandığı için en uzun süren adımdır (ortalama ~1.8 dakika). Diğer adımlar kabul edilebilir süre sınırları içerisindedir.

---

## 3. İyi Gidenler ve Başarılar (Strengths)

1. **Yüksek Yapısal ve Şemasal Kararlılık (Schema Rigidity):**
   Yapay zeka model çağrılarında en yüksek yaratıcılık/sapma katsayısı olan `Temperature = 1.0` kullanılmasına rağmen, JSON şema bütünlüğü tüm iterasyonlarda %100 oranında korunmuş, veritabanı yazımlarında hiçbir validasyon hatası veya tip uyuşmazlığı yaşanmamıştır.
2. **Nicel Determinizm (Risk Hesaplama Tutarlılığı):**
   Özgünlük Analizi adımında 5 iterasyonun tamamında tam olarak **aynı risk rozeti (`HIGH_RISK`)**, **aynı risk yüzdesi (`%80`)** ve **aynı çakışan tez sayısı (`6`)** üretilmiştir. Bu durum, arka plandaki ağırlıklandırma ve risk puanlama algoritmalarının sarsılmaz bir kararlılıkta çalıştığını kanıtlamaktadır.
3. **Akademik Dil ve Kavramsal Derinlik:**
   Tüm çıktılarda kullanılan Türkçe, elit akademik standartlara tam uyum göstermektedir. Adayın tez matrisinde sunduğu Foucaultcu ve Marksist sentez, yapay zeka tarafından kusursuz bir biçimde kavranmış ve olgunlaştırılmıştır. Çıktılarda; *"işçi-borçlu figürü"*, *"biyopolitika"*, *"finansal içerilme"*, *"özneleşme pratikleri"*, *"gri pratikler"* gibi ileri düzey kavramlar doğru bağlamlarda ve yüksek isabetle kullanılmıştır.
4. **Metodolojik Filtreleme ve Halüsinasyon Önleme (Wikipedia & Google Books):**
   Adım 4'te üretilen alt konu kutularında önerilen teorisyenler (*Maurizio Lazzarato, Michel Foucault, Karl Marx, David Harvey, Korkut Boratav, Ayşe Buğra*) ve metodolojik otoriteler (*Braun & Clarke, Denzin*), arka plandaki canlı Wikipedia/Google Books sorgularıyla doğrulanarak filtrelenmiş ve tamamen gerçek figürlerden seçilmiştir.

---

## 4. Sorunlar ve Epistemolojik Gerilimler (Tension Points)

1. **Metodolojik Epistemoloji Çelişkisi (Marksizm/Post-Yapısalcılık vs. Fenomenoloji):**
   Zenginleştirme ve kutu oluşturma çıktılarında metodoloji tasarımı için ısrarla *"fenomenolojik düzlem / fenomenolojik derinlik"* kavramları önerilmiştir. Ancak kuramsal omurgası Marksist sınıf analizi ve Foucaultcu söylemsel/biyopolitik yönetimsellik olan bir tezin fenomenolojiyle sentezlenmesi ontological bir uyuşmazlık (epistemological clash) riski barındırır. Fenomenoloji öznenin saf aşkın bilincine odaklanırken, Marksizm yapısal belirlenimlere, Foucault ise iktidarın özneyi kurma biçimlerine bakar.
2. **Metodolojik Yöntem Tutarsızlığı (Tümevarım vs. Tümdengelim):**
   İterasyonlar arasında analizin kimi yerde tamamen *"tümevarımsal (inductive)"*, kimi yerde ise *"kuramsal çerçeveyle uyumlu tematik analiz (deductive)"* olarak kurgulandığı görülmüştür. Bu kadar güçlü kuramsal çerçeveye sahip nitel bir saha araştırması tamamen tümevarımsal olamaz.
3. **Maddi Doğrulama Arama Boşluğu (The Empty Search Paradox):**
   Özgünlük analizi sırasında web tabanlı maddi doğrulama (Tavily) sorgularında internet verisi çekilemediği veya boş döndüğü durumlar yaşanmıştır. Sistem bu durumu akıllı bir geri çekilme (fall-back) ile tolere etse de, Tavily'nin teknik kesintileri maddi doğrulama briefing note'larının derinliğini azaltmaktadır.

---

## 5. Dikkat Edilmesi Gerekenler ve Geliştirme Önerileri

1. **Metodolojik Adlandırma Revizyonu:**
   Tez metodolojisindeki ontological çelişkileri önlemek adına, saha analizi yöntemi "fenomenolojik desen" yerine **"Eleştirel Söylem/Deneyim Analizi"** veya doğrudan teori ile sahanın diyalektik ilişkisini kuran **"Kaçımsamalı Nitel Analiz" (Abductive Qualitative Analysis)** olarak adlandırılmalıdır.
2. **Düşük Sıcaklık (Temperature) Filtresi (Adım 4 İçin):**
   Konu kutularının (Kartoteks) oluşturulması aşamasında, modelin kavramsal/teorik sınırlar dışına çıkmaması ve Marksist kavramları Foucaultcu kavramlarla (veya tam tersi) halüsinatif biçimde ilişkilendirmemesi için Adım 4'ün sıcaklık (Temperature) parametresi `1.0` seviyesinden `0.3 - 0.4` aralığına çekilmelidir.
3. **Canlı Kaynak Doğrulama ve DOI Entegrasyonu:**
   Özgünlük analizinde önerilen benzer tezlerin (örneğin raporda geçen *Emre Genç (2018)* veya *Cantürk (2021)*) halüsinasyon olmadığını garanti altına almak adına, sistem çıktılarına YÖK Tez No veya doğrudan URL/DOI linklerinin eklenmesi bir zorunluluk haline getirilmelidir.
4. **Ebeveyn Kutuların Boş Kalması:**
   Sistem tasarımı gereği, ana bölüm başlığı niteliğindeki 5 ebeveyn kutunun (Giriş, Teorik Zemin, Yöntem vb.) `theorists` ve `concepts` dizileri boş kalmaktadır. Adayın bu durumu bir hata olarak görmemesi için arayüzde *"Bu kutu bir kategori başlığıdır, alt başlıklar detaylandırılmıştır"* şeklinde yönlendirici bir bilgilendirme (tooltip) kullanılmalıdır.

---
*Rapor, ardışık 5 çalıştırma sonucu elde edilen log verilerine ve Gemini akademik denetim çıktılarına dayanarak oluşturulmuştur.*
