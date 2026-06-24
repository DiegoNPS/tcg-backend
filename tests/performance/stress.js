import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.BASE_URL || "http://localhost:3001";

export const options = {
  scenarios: {
    estres_progresivo: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "1m", target: 50 },
        { duration: "1m", target: 100 },
        { duration: "30s", target: 150 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000"],
  },
};

export default function estresProgresivo() {
  const list = http.get(`${baseUrl}/api/torneos`);
  const lookups = http.batch([
    ["GET", `${baseUrl}/api/lookups/juegos`],
    ["GET", `${baseUrl}/api/lookups/categorias`],
    ["GET", `${baseUrl}/api/lookups/ciudades`],
  ]);

  check(list, { "listado disponible bajo estrés": (res) => res.status === 200 });
  check(lookups, {
    "catálogos disponibles bajo estrés": (responses) => responses.every((res) => res.status === 200),
  });
  sleep(0.5);
}
