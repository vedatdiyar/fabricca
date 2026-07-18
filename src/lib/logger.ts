export interface TokenUsage {
  input?: number;
  output?: number;
  total?: number;
}

type ServiceName =
  | "gemini"
  | "cloudflare"
  | "tezara"
  | "db"
  | "auth"
  | "flow"
  | "matrix"
  | "originality"
  | "risk"
  | "complete"
  | "boxes"
  | "wikipedia"
  | "literature"
  | "library"
  | "openalex"
  | "crossref"
  | "dashboard";

export interface LogParams {
  service?: ServiceName;
  step?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
  error?: unknown;
  tokens?: TokenUsage;
  filePath?: string;
  status?: "START" | "SUCCESS" | "FAILED" | "RETRY";
}

export interface LoggerInstance {
  flowId: string;
  lastTokens?: TokenUsage;
  lastPayloadPath?: string;
  info(arg1: string | Record<string, unknown>, params?: LogParams): void;
  warn(arg1: string | Record<string, unknown>, params?: LogParams): void;
  error(arg1: string | Record<string, unknown>, params?: LogParams): void;
  step(n: string, m?: Record<string, unknown>): void;
  file(r: string): void;
  data(l: string, v: unknown): void;
  preview(l: string, v: unknown): void;
  prompt(m: string, c: string): void;
  saveDebugPayload(
    s: string,
    m: string,
    p: string,
    r?: string,
  ): string | undefined;
  groupStart(event: string): void;
  groupEnd(event: string, durationMs: number): void;
}

/**
 * Tek bir event adından, event sonekine bakarak durumu türetir.
 * @param event Event adı (örn. "matrix_save_start").
 * @returns START | SUCCESS | FAILED | "" (durum belirsiz).
 */
function deriveStatus(event: string): string {
  if (event.endsWith("_start")) return "START";
  if (event.endsWith("_success")) return "SUCCESS";
  if (
    event.endsWith("_failed") ||
    event.endsWith("_filtered") ||
    event.endsWith("_empty")
  )
    return "FAILED";
  return "";
}

const isDev = () => process.env.NODE_ENV === "development";

const C_RESET = "\x1b[0m";
const C_GREEN = "\x1b[32m";
const C_RED = "\x1b[31m";
const C_YELLOW = "\x1b[33m";

/** Dev modda yazılan toplam satır sayısı — START öncesi boşluk kontrolü için */
let devLogCount = 0;

/**
 * Status'e karşılık gelen ikonu döndürür.
 * @param s START | SUCCESS | FAILED | RETRY
 * @returns Tek karakterlik ikon.
 */
function statusIcon(s: string): string {
  return s === "START"
    ? "⏳"
    : s === "SUCCESS"
      ? "✓"
      : s === "FAILED"
        ? "✖"
        : s === "RETRY"
          ? "↻"
          : "•";
}

/**
 * Status için ANSI renk kodu döndürür.
 * @param s START | SUCCESS | FAILED
 * @returns ANSI escape kodu (boş dönebilir).
 */
function statusColor(s: string): string {
  if (s === "SUCCESS") return C_GREEN;
  if (s === "FAILED") return C_RED;
  if (s === "START" || s === "RETRY") return C_YELLOW;
  return "";
}

/**
 * Milisaniye cinsinden süreyi sıkıştırılmış bir string olarak biçimlendirir:
 *   <1000 ms → "497ms"
 *   ≥1000 ms → "1.5s" / "12.3s" (ondalık değil tam ise "12s")
 * @param ms Süre (ms).
 * @returns Kompakt süre string'i.
 */
function formatDuration(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 1000) return `${Math.round(safe)}ms`;
  const sec = safe / 1000;
  if (Number.isInteger(sec)) return `${sec}s`;
  return `${sec.toFixed(1)}s`;
}

/**
 * Hata değerini kısa ve okunabilir bir mesaj string'ine çevirir.
 * @param error Yakalanmamış hata, Error örneği veya arbitrary nesne.
 * @returns Hata mesajı.
 */
function extractReason(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export class Logger implements LoggerInstance {
  public readonly flowId: string;
  public lastTokens?: TokenUsage;
  public lastPayloadPath?: string;

  /** Per-instance zamanlayıcılar — her Logger kendi başlangıç zamanlarını tutar. */
  private _starts = new Map<string, number>();
  private readonly devMode = isDev();

  /**
   * Yeni bir Logger örneği oluşturur.
   * @param flowId Akış (flow) tanımlayıcısı — tüm log satırlarına eklenir.
   */
  constructor(flowId: string) {
    this.flowId = flowId;
  }

  /**
   * info seviyesinde log üretir.
   * @param arg1 Event adı (string) veya direkt payload (object).
   * @param p Opsiyonel log parametreleri.
   */
  info(arg1: string | Record<string, unknown>, p?: LogParams): void {
    this.write("info", arg1, p);
  }

  /**
   * warn seviyesinde log üretir.
   * @param arg1 Event adı (string) veya direkt payload (object).
   * @param p Opsiyonel log parametreleri.
   */
  warn(arg1: string | Record<string, unknown>, p?: LogParams): void {
    this.write("warn", arg1, p);
  }

  /**
   * error seviyesinde log üretir.
   * @param arg1 Event adı (string) veya direkt payload (object).
   * @param p Opsiyonel log parametreleri.
   */
  error(arg1: string | Record<string, unknown>, p?: LogParams): void {
    this.write("error", arg1, p);
  }

  /**
   * Yardımcı adım metodu — sessiz (no-op).
   */
  step(n: string, m?: Record<string, unknown>): void {
    void n;
    void m;
    /* no-op — alt kırılım çıktısı üretmez */
  }

  /**
   * Yardımcı dosya yolu metodu — sessiz (no-op).
   */
  file(r: string): void {
    void r;
    /* no-op */
  }

  /**
   * Yardımcı veri metodu — sessiz (no-op).
   */
  data(l: string, v: unknown): void {
    void l;
    void v;
    /* no-op */
  }

  /**
   * Yardımcı önizleme metodu — sessiz (no-op).
   */
  preview(l: string, v: unknown): void {
    void l;
    void v;
    /* no-op */
  }

  /**
   * Yardımcı prompt metodu — sessiz (no-op).
   */
  prompt(m: string, c: string): void {
    void m;
    void c;
    /* no-op */
  }

  /**
   * Yardımcı debug-payload kaydı — sessiz (no-op).
   * Her zaman undefined döndürür — payload ID artık üretilmez.
   */
  saveDebugPayload(
    s: string,
    m: string,
    p: string,
    r?: string,
  ): string | undefined {
    void s;
    void m;
    void p;
    void r;
    return undefined;
  }

  /**
   * Görsel grup başı — no-op (lineer modda gruplar render edilmez).
   */
  groupStart(event: string): void {
    void event;
    /* no-op */
  }

  /**
   * Görsel grubu sonu — no-op.
   */
  groupEnd(event: string, durationMs: number): void {
    void event;
    void durationMs;
    /* no-op */
  }

  /**
   * Saat:dakika:saniye olarak geçerli zaman damgasını döndürür.
   * @returns "[HH:MM:SS]" formatında string.
   */
  private timestamp(): string {
    const d = new Date();
    return `[${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}]`;
  }

  /**
   * Tek satır log üretir. START/SUCCESS/FAILED eventleri için özel
   * işlem yapılır; diğer eventler minimal düz bir satır olarak basılır.
   *
   * Üretim modunda tek bir JSON satırı yazılır.
   *
   * @param level info | warn | error
   * @param arg1 Event adı (string) veya direkt payload (object).
   * @param p Opsiyonel log parametreleri.
   */
  private write(
    level: "info" | "warn" | "error",
    arg1: string | Record<string, unknown>,
    p?: LogParams,
  ): void {
    if (this.devMode) {
      const event =
        typeof arg1 === "object" && arg1 !== null
          ? (((arg1 as Record<string, unknown>).step as string) ?? "unknown")
          : (arg1 as string);

      const status = deriveStatus(event);

      // ── START: timer başlat + minimal tek satır START yaz ──
      if (status === "START") {
        const baseEvent = event.replace(/_(start)$/, "");
        this._starts.set(baseEvent, performance.now());
        const timeTag = this.timestamp();
        const icon = statusIcon("START");
        const color = statusColor("START");
        const annotation = p?.data?.summary ? ` ${p.data.summary}` : "";
        if (devLogCount > 0) console.log("");
        devLogCount++;
        console.log(
          `${timeTag} START ${color}${icon}${C_RESET} ${baseEvent}${annotation}`,
        );
        return;
      }

      // ── SUCCESS / FAILED: _starts'tan elapsed oku, tek satır yaz ──
      if (status === "SUCCESS" || status === "FAILED") {
        const baseEvent = event.replace(
          /_(success|failed|filtered|empty)$/,
          "",
        );
        const startTime = this._starts.get(baseEvent);
        const durStr =
          startTime != null
            ? ` (${formatDuration(performance.now() - startTime)})`
            : "";
        if (startTime != null) this._starts.delete(baseEvent);

        const icon = statusIcon(status);
        const color = statusColor(status);
        const timeTag = this.timestamp();

        console.log(
          `${timeTag} ${status} ${color}${icon}${C_RESET} ${baseEvent}${durStr}`,
        );

        if (p?.error != null) {
          console.log(`  ↳ reason: ${extractReason(p.error)}`);
        }
        devLogCount++;
        return;
      }

      // ── Status-süz event: minimal tek satır ──
      const timeTag = this.timestamp();
      const levelLabel =
        level === "info" ? "INFO" : level === "warn" ? "WARN" : "ERROR";
      console.log(`${timeTag} ${levelLabel} ${event}`);
      devLogCount++;
      return;
    }

    // ── Production: JSON tek satır ──
    if (typeof arg1 === "object" && arg1 !== null) {
      const entry: Record<string, unknown> = { flowId: this.flowId, ...arg1 };
      console[level](
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level,
          ...entry,
        }),
      );
      return;
    }

    const event = arg1 as string;
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      event,
      flowId: this.flowId,
      service: p?.service ?? "flow",
      status: p?.status ?? deriveStatus(event),
    };
    if (p?.step) entry.step = p.step;
    if (p?.durationMs !== undefined)
      entry.durationMs = Math.round(p.durationMs);
    if (p?.data) entry.data = p.data;
    if (p?.tokens) {
      entry.tokens = p.tokens;
      this.lastTokens = p.tokens;
    }
    if (p?.error) entry.error = String(p.error);
    console[level](JSON.stringify(entry));
  }
}

/**
 * Yeni bir akış (flow) için benzersiz bir tanımlayıcı üretir.
 * Format: `fl_<timestamp36>_<random>`.
 * @returns Akış ID string'i.
 */
export function createFlowId(): string {
  return `fl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}
