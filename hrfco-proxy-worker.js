/*
 * 한강홍수통제소(HRFCO) 수위 프록시 — Cloudflare Worker
 * ------------------------------------------------------------------
 * 목적:
 *   1) CORS 문제 해결 (브라우저에서 정부 API 직접 호출이 막히는 것을 우회)
 *   2) 인증키를 서버(Worker)에 숨겨서 방문자에게 노출되지 않게 함
 *   3) 60초 캐시로 다수 사용자가 들어와도 HRFCO 호출 폭주를 막음
 *
 * 사용법:
 *   1. Cloudflare 가입 → Workers & Pages → Create Worker
 *   2. 이 코드를 붙여넣고 배포(Deploy)
 *   3. Settings → Variables and Secrets 에서
 *        이름: HRFCO_KEY   값: 발급받은 한강홍수통제소 인증키   (Secret 으로 저장)
 *   4. 배포된 주소(예: https://hrfco.본인계정.workers.dev) 를 복사
 *   5. 웹앱 HTML 의 CONFIG.ENDPOINT_TEMPLATE 에 아래처럼 입력:
 *        ENDPOINT_TEMPLATE: "https://hrfco.본인계정.workers.dev/{obscd}"
 *
 *   확인: 브라우저에서 https://hrfco.본인계정.workers.dev/1018680 열어
 *        잠수교 수위 JSON 이 나오면 정상.
 */

export default {
  async fetch(request, env) {
    // 프리플라이트(OPTIONS) 처리
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors() });
    }

    const url = new URL(request.url);
    // 경로 마지막 조각을 관측소 코드로 사용:  /1018680  또는  /wl/1019630
    const code = url.pathname.split("/").filter(Boolean).pop();

    if (!code || !/^\d+$/.test(code)) {
      return json({ error: "관측소 코드를 경로 끝에 숫자로 넣어 주세요. 예: /1018680" }, 400);
    }
    if (!env.HRFCO_KEY) {
      return json({ error: "HRFCO_KEY 환경변수가 설정되지 않았습니다." }, 500);
    }

    const target =
      `https://api.hrfco.go.kr/${env.HRFCO_KEY}/waterlevel/list/10M/${code}.json`;

    try {
      // 같은 코드 요청은 60초간 Cloudflare 엣지 캐시 사용 (HRFCO 부하 최소화)
      const upstream = await fetch(target, { cf: { cacheTtl: 60, cacheEverything: true } });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: cors("application/json; charset=utf-8"),
      });
    } catch (e) {
      return json({ error: "upstream 호출 실패: " + String(e) }, 502);
    }
  },
};

function cors(contentType) {
  return {
    "Content-Type": contentType || "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=60",
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: cors() });
}
