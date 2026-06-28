# Security

Dure는 자율 코딩 에이전트와 보안 작업 보조 도구가 잘못된 방향으로 확장되는 것을 막기 위해 보수적인 제어 모델을 사용합니다.

## 보안 모델

- 자연어 입력은 typed internal state로 변환됩니다.
- 생성 작업은 `PatchProposal`로 표현됩니다.
- 패치 제안은 Builder 계층만 만들 수 있습니다.
- 리뷰 에이전트는 패치를 작성하지 않고 검토, 거절, 변경 요청만 수행합니다.
- 제안은 verification gate를 통과해야 accepted 상태가 될 수 있습니다.
- v0.1은 approval gate와 controlled apply 이후에만 프로젝트 명령 실행을 허용합니다.
- 적용된 워크스페이스 검증은 `package.json`의 allow-listed script인 `test`, `lint`, `typecheck`로 제한됩니다.
- 임의 셸 명령, 패키지 설치, 네트워크 감사, git 명령, pre/post lifecycle hook 실행은 v0.1 verification path에서 허용하지 않습니다.
- safety policy는 mode-specific capability allowlist를 사용하고 외부 도구 실행을 기본 차단합니다.
- skill은 manifest preview, 권한 선언, trust metadata를 먼저 확인하며 v0.1에서는 untrusted skill을 자동 실행하지 않습니다.

## Bug Bounty Mode 안전 기준

Bug Bounty Mode는 승인된 범위 안에서 기록, 정리, 보고서 초안을 돕는 모드입니다. v0.1은 실제 대상에 접근하지 않습니다.

- 대상 맵은 사용자가 제공한 수동 기록입니다.
- Dure는 v0.1에서 호스트 탐색, 크롤링, 스캔, 요청 전송, exploit, finding 검증, 보고서 제출을 하지 않습니다.
- automated target mapping은 placeholder이며 외부 어댑터가 연결되어 있지 않습니다.
- target-map safety gate는 out-of-scope reference가 있으면 일반 evidence/report 작성을 차단합니다.
- evidence ledger는 사용자 입력 기반 기록이며 저장 전에 secret-like 값과 개인 정보 패턴을 redaction합니다.
- report draft는 저장된 redacted evidence만 사용합니다.
- DoS, brute force, rate-limit bypass, persistence, destructive testing, out-of-scope testing, unauthorized access 요청은 active-testing stop condition으로 차단됩니다.

## Redaction

Dure는 저장/출력 전에 다음과 같은 값을 가능한 범위에서 제거하거나 마스킹합니다.

- `Authorization` header
- cookie/session/token/API key/password/CSRF 값
- bearer token
- email-like personal data
- secret-like 긴 문자열

Redaction은 보조 안전장치이며 완전한 비밀 탐지를 보장하지 않습니다. 실제 비밀 값은 입력하지 않는 것이 원칙입니다.

## Responsible Disclosure

취약점 또는 민감한 보안 이슈는 공개 issue 대신 GitHub Security Advisory로 제보해 주세요.

https://github.com/eklim23/Dure/security/advisories/new

공개 issue에는 실제 비밀 값, 접근 토큰, 인증 쿠키, 개인 정보를 포함하지 마세요.

## 제보 시 포함하면 좋은 정보

- 영향받는 버전 또는 commit
- 재현 단계
- 기대 동작
- 실제 동작
- 보안 영향
- 알고 있는 완화 방법

## 금지되는 사용

Dure v0.1을 다음 목적으로 사용하지 마세요.

- 허가되지 않은 대상 스캔 또는 공격
- brute force, DoS, rate-limit bypass
- out-of-scope 시스템 접근
- 실제 서비스에 대한 자동화된 active testing
- 검토되지 않은 bug bounty report 제출
- 비밀 값 또는 개인정보가 포함된 로그 공개
