# Examples

이 디렉터리는 Dure의 모드별 동작을 확인하기 위한 작은 예제를 모읍니다.

## 현재 예제

- [todo-app](./todo-app/README.md): Development Mode가 자연어 요청을 작은 patch proposal로 줄이고 persistent run artifact를 남기는지 확인합니다.

## 예제 원칙

- 외부 API 키 없이 실행되어야 합니다.
- 실제 네트워크 대상, 민감한 bug bounty 데이터, 비밀 값을 포함하지 않습니다.
- 자동 파일 수정, 스캔, exploit, report submission을 전제로 하지 않습니다.
- 하나의 예제는 하나의 검증 가능한 흐름만 보여줍니다.

## 향후 예제 후보

- `bug-bounty-passive-scope`: 승인된 범위를 수동 기록하고 target map/evidence/report draft를 만드는 예제
- `development-patch-preview`: 작은 CLI skeleton proposal과 approval/apply 흐름을 보여주는 예제
- `console-data-import`: redacted run artifact를 Dure Console prototype에서 읽는 예제
