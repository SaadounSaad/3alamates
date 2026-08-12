import https from "https";

const HABOUS_ENDPOINT = "https://www.habous.gov.ma/prieres/horaire-api.php";
const DEFAULT_CITY_ID = "1";
const REQUEST_TIMEOUT_MS = 8000;

const insecureHabousAgent = new https.Agent({
  rejectUnauthorized: false,
});

const PRAYER_LABELS = {
  fajr: "\u0627\u0644\u0641\u062c\u0631",
  sunrise: "\u0627\u0644\u0634\u0631\u0648\u0642",
  dhuhr: "\u0627\u0644\u0638\u0647\u0631",
  asr: "\u0627\u0644\u0639\u0635\u0631",
  maghrib: "\u0627\u0644\u0645\u063a\u0631\u0628",
  isha: "\u0627\u0644\u0639\u0634\u0627\u0621",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    setHeaders(response, {
      ...CORS_HEADERS,
      "Access-Control-Max-Age": "86400",
    });
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET, OPTIONS" });
    return;
  }

  try {
    const cityId = getCityId(request.url);
    const habousUrl = `${HABOUS_ENDPOINT}?ville=${cityId}`;
    const html = await fetchHabousHtml(habousUrl);
    const payload = parseHabousHtml(html, cityId);

    sendJson(response, 200, {
      ...payload,
      source: habousUrl,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = message === "Invalid city id" ? 400 : 502;

    sendJson(response, statusCode, {
      error: "Unable to retrieve official prayer times from Habous",
      detail: message,
    });
  }
}

function getCityId(requestUrl) {
  const url = new URL(requestUrl ?? "/", "https://3alamates.local");
  const cityId = url.searchParams.get("ville") ?? DEFAULT_CITY_ID;

  if (!/^\d{1,3}$/.test(cityId)) {
    throw new Error("Invalid city id");
  }

  return cityId;
}

function fetchHabousHtml(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        agent: insecureHabousAgent,
        headers: {
          Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
          "User-Agent": "3alamates-prayer-times/1.0",
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks = [];

        res.setEncoding("utf8");
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = chunks.join("");

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Habous returned HTTP ${res.statusCode ?? "unknown"}`));
            return;
          }

          resolve(body);
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error(`Habous request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    request.on("error", reject);
  });
}

function parseHabousHtml(html, cityId) {
  const prayers = Object.fromEntries(
    Object.entries(PRAYER_LABELS).map(([key, label]) => [key, extractPrayerTime(html, label)]),
  );

  const selectedCity = html.match(/<option\b[^>]*selected=selected[^>]*>([^<]+)<\/option>/i);
  const dateBlock = html.match(/<h2\b[^>]*font-size:0\.8em[^>]*>([\s\S]*?)<\/h2>/i);
  const dateLines = dateBlock ? normalizeDateLines(dateBlock[1]) : [];

  return {
    city: {
      id: cityId,
      name: selectedCity ? normalizeText(selectedCity[1]) : null,
    },
    date: {
      hijri: dateLines[0] ?? null,
      gregorian: dateLines[1] ?? null,
    },
    prayers,
  };
}

function extractPrayerTime(html, label) {
  const pattern = new RegExp(`${escapeRegExp(label)}\\s*:?\\s*<\\/td>\\s*<td\\b[^>]*>\\s*([0-2]?\\d:[0-5]\\d)`, "u");
  const match = html.match(pattern);

  if (!match) {
    throw new Error(`Unable to parse "${label}" from Habous response`);
  }

  return match[1].trim();
}

function normalizeText(value) {
  return value
    .replace(/<br\s*\/?>/gi, "<br>")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDateLines(value) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  setHeaders(response, {
    ...CORS_HEADERS,
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });

  response.status(statusCode).send(JSON.stringify(payload));
}

function setHeaders(response, headers) {
  Object.entries(headers).forEach(([name, value]) => response.setHeader(name, value));
}
