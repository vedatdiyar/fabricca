import { Sparkles } from "lucide-react";

/**
 * Özgünlük ve Risk Analizi için Premium Yükleme Ekranı (Server/Client Loading UI).
 * Arama ve analiz süresince (15-30 sn) kullanıcıyı bilgilendiren animasyonlu panel sunar.
 */
export default function OnboardingRiskLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center justify-center space-y-8 max-w-md mx-auto text-center">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <Sparkles className="w-6 h-6 text-primary absolute animate-pulse" />
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            Risk Analiz Motorları Çalışıyor
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Yapay zeka asistanınız tez matrisinizi inceliyor, veri tabanlarını
            tarıyor ve risk raporunu hazırlıyor. Bu işlem 15-30 saniye
            sürebilir.
          </p>
        </div>

        <div className="w-full bg-muted border border-border rounded-lg p-5 text-left space-y-4">
          <div className="flex items-center gap-3 text-sm text-foreground">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></div>
            <span className="font-medium">
              Sorgu ve doğrulama parametreleri üretiliyor...
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full bg-border"></div>
            <span>Tavily ve Tezara paralel motorları koşturuluyor...</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full bg-border"></div>
            <span>Karşılaştırmalı literatür matrisi yapılandırılıyor...</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full bg-border"></div>
            <span>Nihai risk seviyesi ve tavsiyeler hazırlanıyor...</span>
          </div>
        </div>
      </div>
    </main>
  );
}
