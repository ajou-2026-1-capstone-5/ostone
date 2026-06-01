# Demo Chat Throughput Check

이 문서는 시연 전 사용자 채팅 자동 응답 경로가 어느 정도의 동시 세션을 감당하는지 확인하기 위한 최소 점검 절차다.

## 기본 처리 한도

LLM 자동 응답은 `llmAutoResponseTaskExecutor`에서 실행된다. 기본값은 다음과 같다.

| 설정 | 기본값 |
| --- | --- |
| core worker | 4 |
| max worker | 8 |
| queue capacity | 16 |
| keep-alive | 60s |

따라서 기본 설정에서는 자동 응답 8개가 동시에 LLM 호출을 수행하고, 추가 16개 요청은 큐에서 대기한다. worker와 큐가 모두 찬 경우에는 `CallerRunsPolicy`가 적용되어 무제한 스레드 생성 대신 이벤트 발행 경로에 backpressure가 걸린다.

## 리허설 시나리오

1. 로컬 또는 시연 환경에서 backend와 frontend를 실행한다.
2. 동일 workspace의 데모 채팅 URL을 여러 브라우저 또는 기기에서 연다.
3. 5, 10, 20, 30개 동시 세션 순서로 각 세션에서 같은 길이의 문의 메시지를 1개씩 전송한다.
4. 각 단계에서 아래 값을 기록한다.

| 항목 | 기록 방법 | 권장 기준 |
| --- | --- | --- |
| 동시 채팅 세션 수 | 리허설 단계별 목표값 | 실제 시연 예상 인원의 1.5배 이상 |
| 평균 응답 시간 | 사용자 메시지 전송부터 assistant 메시지 도착까지 | 8초 이하 |
| 최대 응답 시간 | 단계별 가장 느린 assistant 메시지 | 20초 이하 |
| 실패율 | fallback/error 메시지 수 ÷ 전체 전송 수 | 5% 이하 |
| executor active | Actuator metric | max worker 근처에 오래 머물면 병목 후보 |
| executor queue size | Actuator metric | 큐가 지속 증가하면 병목 후보 |

## Metric 확인

Actuator metrics endpoint가 열려 있는 환경에서 아래 지표를 확인한다.

```bash
curl -s http://localhost:8080/actuator/metrics/app.ai.chat.auto.response.executor.active
curl -s http://localhost:8080/actuator/metrics/app.ai.chat.auto.response.executor.queue.size
curl -s http://localhost:8080/actuator/metrics/app.ai.chat.auto.response.executor.queue.remaining
```

로컬 기본 설정은 `application.yml`의 `management.endpoints.web.exposure.include`에 `metrics`가 포함되어 있어 위 지표를 조회할 수 있다.

## 병목 판단과 후속 이슈

아래 조건 중 하나라도 반복되면 executor 값만 늘리기보다 별도 이슈로 원인을 분리한다.

| 신호 | 후속 후보 |
| --- | --- |
| queue size가 1분 이상 계속 증가 | 큐 제한/입력 제한 또는 대기 안내 UX |
| fallback/error가 provider throttle과 함께 증가 | LLM provider rate limit 조정 또는 모델 fallback |
| 특정 세션에서 연속 메시지 순서가 밀림 | 세션별 자동 응답 동시성 제어 |
| DB connection 대기가 함께 증가 | Hikari pool과 transaction 범위 점검 |
