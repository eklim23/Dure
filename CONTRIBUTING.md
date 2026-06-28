# Contributing

Dure에 기여해 주셔서 감사합니다.

Dure는 빠른 코드 생성보다 안정성, 감사 가능성, 롤백 가능성, 보수적인 자동화를 우선합니다. 큰 리라이트보다 작고 검토 가능한 변경이 더 좋은 기여입니다.

## 기여 원칙

- MVP Ladder를 유지합니다. 한 번에 한 단계, 검증 가능한 산출물을 만듭니다.
- 작은 패치와 되돌릴 수 있는 변경을 선호합니다.
- Single Writer, Multi Reviewer 원칙을 지킵니다.
- 승인 없는 셸 실행, 네트워크 접근, 파일 삭제, 외부 도구 실행을 추가하지 않습니다.
- 기본 테스트와 데모는 외부 LLM API 키 없이 동작해야 합니다.
- 주요 의사결정은 `.dure/runs/<run-id>/decision-log.jsonl`에 남길 수 있어야 합니다.
- Bug Bounty Mode는 명시적 허가, 범위, 승인된 어댑터 계층이 없는 한 수동 기록 중심으로 유지합니다.
- `.dure/runs`, `dist`, 로컬 보고서, 비밀 값은 커밋하지 않습니다.

## 개발 환경

```bash
corepack enable
corepack pnpm install
corepack pnpm build
corepack pnpm test
```

CLI 실행:

```bash
corepack pnpm cli -- run "Create a simple login-enabled bulletin board"
```

모드 지정:

```bash
corepack pnpm cli -- --mode development "Create a tiny CLI app"
corepack pnpm cli -- --mode bug-bounty "Prepare an authorized bug bounty scope"
```

## 패키지 경계

- `packages/core`: 공유 타입, 계약, 공통 모델
- `packages/assistant-core`: 자연어 요청을 Dure 실행 흐름으로 연결하는 코어
- `packages/orchestrator`: 단계 선택, MVP Ladder, 다음 행동 결정
- `packages/council`: 역할 기반 에이전트 협의와 리뷰
- `packages/builder-runtime`: `PatchProposal` 생성과 controlled proposal 모델
- `packages/verifier`: 테스트, 린트, 타입체크, 보안 검증 게이트
- `packages/safety-policy`: 모드별 capability 정책과 차단 조건
- `packages/memory`: persistent run record와 decision log
- `packages/skill-registry`: skill manifest, preview, 신뢰/권한 메타데이터
- `apps/cli`: 사용자와 만나는 CLI 인터페이스

패키지 경계를 넘는 변경은 가능한 한 타입 계약을 먼저 정리한 뒤 구현합니다.

## 작업 전 체크

- 변경 목표가 Dure의 현재 개발 단계와 맞는지 확인합니다.
- 새 기능이 approval/apply/verification 안전 모델을 우회하지 않는지 확인합니다.
- 사용자 입력, 파일 경로, 외부 capability를 다루는 경우 테스트를 추가합니다.
- CLI 출력, run artifact, 보안 정책이 바뀌면 문서를 함께 업데이트합니다.

## PR 체크리스트

PR을 열기 전 다음을 확인해 주세요.

- `corepack pnpm test` 통과
- 동작 변경에 대한 테스트 추가 또는 갱신
- 사용자에게 보이는 CLI 출력 변경 시 README 또는 docs 갱신
- 보안 정책, Bug Bounty Mode, skill 실행 모델 변경 시 SECURITY 갱신
- `.dure/`, `dist/`, secrets, 개인 로컬 파일이 staged 상태가 아님

좋은 PR은 다음을 포함합니다.

- 변경 목표와 사용자 가치
- 변경 범위와 제외한 범위
- 테스트 결과
- 위험한 capability가 있다면 승인/차단 방식

릴리즈 작업은 [docs/release-checklist.md](./docs/release-checklist.md)를 기준으로 진행합니다.
