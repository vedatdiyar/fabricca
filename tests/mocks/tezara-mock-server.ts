import http from "http";
import { URL } from "url";

const RATE_LIMIT_WINDOW_MS = 300;
const MOCK_PORT = 8080;

let lastRequestTime = 0;
let requestCount = 0;

function generateSearchHtml(query: string, page: number): string {
  const items = Array.from({ length: 10 }, (_, i) => {
    const n = (page - 1) * 10 + i + 1;
    return `
<li id="thesis-${n}">
  <a href="/theses/${n}">TEZ-${n}</a>
  <a href="/theses/${n}">Araştırma Başlığı ${n}: ${query} Üzerine Bir İnceleme</a>
  <span class="icon-pen-tool"></span> Yazar ${n}
  <a href="/universities/universite-${n}">Test Üniversitesi</a>
  <span class="icon-calendar"></span> ${2020 + (n % 5)}
  <span class="icon-graduation-cap"></span> ${n % 2 === 0 ? "Doktora" : "Yüksek Lisans"}
  <span class="icon-building"></span> ${n % 3 === 0 ? "Bilgisayar Mühendisliği" : n % 3 === 1 ? "İşletme" : "Elektrik Elektronik Mühendisliği"}
</li>`;
  });
  return `<!DOCTYPE html><html><body><ul>${items.join("\n")}</ul></body></html>`;
}

function generateDetailHtml(id: number): string {
  return `<!DOCTYPE html><html><body>
<main>
  <h1>Araştırma Başlığı ${id}</h1>
  <p>Yazar: Yazar ${id}</p>
  <p>Özet Bu çalışma, ${id} numaralı tez kapsamında detaylı bir analiz sunmaktadır. Araştırma kapsamında elde edilen bulgular literatürdeki önemli boşlukları doldurmaktadır.</p>
  <p>Özet (Çeviri) This study provides a detailed analysis within the scope of thesis number ${id}.</p>
  <a href="https://tez.yok.gov.tr/UlusalTezMerkezi/TezGoster?tezNo=${id}">YÖK Tez Merkezi</a>
</main>
</body></html>`;
}

function generate429Body(retryAfterMs: number): string {
  return JSON.stringify({
    error: "Too Many Requests",
    retryAfter: Math.ceil(retryAfterMs / 1000),
  });
}

export function startMockServer(
  port: number = MOCK_PORT,
): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer(
      (req: http.IncomingMessage, res: http.ServerResponse) => {
        const now = Date.now();
        const elapsed = now - lastRequestTime;
        requestCount++;

        if (lastRequestTime !== 0 && elapsed < RATE_LIMIT_WINDOW_MS) {
          const retryAfterMs = RATE_LIMIT_WINDOW_MS - elapsed;
          res.writeHead(429, {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
            "X-RateLimit-Reset": String(retryAfterMs),
          });
          res.end(generate429Body(retryAfterMs));
          return;
        }

        lastRequestTime = now;

        if (!req.url) {
          res.writeHead(404);
          res.end("Not Found");
          return;
        }

        const parsedUrl = new URL(req.url, `http://localhost:${port}`);
        const pathname = parsedUrl.pathname;

        if (pathname === "/search") {
          const query = parsedUrl.searchParams.get("q") || "test";
          const page = parseInt(parsedUrl.searchParams.get("page") || "1", 10);
          const html = generateSearchHtml(query, page);
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
        } else if (pathname.startsWith("/theses/")) {
          const idStr = pathname.split("/")[2];
          const id = parseInt(idStr, 10);
          if (isNaN(id)) {
            res.writeHead(404);
            res.end("Not Found");
            return;
          }
          const html = generateDetailHtml(id);
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
        } else {
          res.writeHead(404);
          res.end("Not Found");
        }
      },
    );

    server.listen(port, () => {
      resolve({ server, port });
    });
  });
}

if (process.argv[1]?.includes("tezara-mock-server")) {
  startMockServer().then(({ port }) => {
    console.log(
      `[mock] TEZARA mock server running on http://localhost:${port}`,
    );
    console.log(
      `[mock] Rate limit: ${RATE_LIMIT_WINDOW_MS}ms between requests`,
    );
  });
}
