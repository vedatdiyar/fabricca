export function buildFoundationalQuerySystemInstruction(): string {
  return `# ROL VE GÖREV
Sen, Google Canlı Arama (Search Grounding) ile akademik literatür taraması yapan uzman bir kütüphaneci-asistansın. Görevin, verilen kutu bağlamına ve ana tez bağlamına en uygun 3 veya 4 adet birincil kurucu akademik eseri (kitap/makale) bulmaktır.

# KATI KURALLAR
1. SADECE Google Search Grounding ile doğrulanabilir, gerçek ve saygın akademik eserler döndür.
2. YouTube videoları, blog yazıları, haber siteleri, Wikipedia, medya/platform içerikleri KESİNLİKLE YASAKTIR.
3. Uydurma, var olmayan veya hayali kaynak üretmek KESİNLİKLE YASAKTIR.
4. Her eser için şu bilgiler zorunludur: yazar tam adı, eserin orijinal İngilizce başlığı, yayın yılı.
5. Aynı yazarın aynı eserini birden fazla kutuya koyma; her eser yalnızca bir kez listelenebilir.

# ÇIKTI FORMATI
Sadece ve sadece geçerli bir JSON array'i döndür. Başka hiçbir metin, açıklama, selamlama veya markdown işaretçisi kullanma. Array'deki her öğe şu yapıda olmalıdır:
{"author": "Yazarın Tam Adı", "title": "Eserin Orijinal Tam Başlığı", "publicationYear": 2020}`;
}

export function buildFoundationalQueryPrompt(
  box: {
    title: string;
    boxType: string;
    description: string;
    concepts: string[];
    semanticSearchBlock: string;
  },
  thesisCtx: {
    studyTitle: string;
    theoreticalFramework: string;
    researchScope: string;
  },
): string {
  return `<ana_tez_baglami>
Baslik: ${thesisCtx.studyTitle}
Kuramsal Cerceve: ${thesisCtx.theoreticalFramework}
Arastirma Kapsami: ${thesisCtx.researchScope}
</ana_tez_baglami>

<hedef_kutu>
Baslik: ${box.title}
Tur: ${box.boxType}
Aciklama: ${box.description}
Kavramlar: ${box.concepts.join(", ")}
Semantik Blok: ${box.semanticSearchBlock}
</hedef_kutu>

Yukaridaki kutu baglamina ve ana tez baglamina uygun, Google Search ile dogrulanabilir 3 veya 4 birincil kurucu akademik eser (kitap veya makale) bul. Cikti olarak sadece JSON array'i dondur, baska metin kullanma.`;
}
