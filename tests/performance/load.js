import http from "k6/http";
import { check, sleep } from "k6";

const baseUrl = __ENV.BASE_URL || "http://localhost:3001";

export const options = {
  scenarios: {
    carga_normal: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "2m", target: 20 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
    checks: ["rate>0.99"],
  },
};

export default function cargaNormal() {
  const response = http.get(`${baseUrl}/api/torneos`);

  check(response, {
    "responde 200": (res) => res.status === 200,
    "devuelve JSON": (res) => (res.headers["Content-Type"] || "").includes("application/json"),
  });

  sleep(1);
}
