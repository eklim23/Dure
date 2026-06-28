# Roadmap

Dure의 로드맵은 “작게 만들고, 검증하고, 안전하게 확장한다”는 원칙을 따릅니다. 각 단계는 독립적으로 테스트 가능한 산출물을 가져야 합니다.

## v0.1: 안전한 CLI 오케스트레이터 기반

v0.1의 목표는 외부 API 키 없이 실행되는 deterministic MVP입니다.

완료 또는 v0.1 범위:

- Assistant Core
- Intent Router
- deterministic task mode
- unified proposal model
- Development Mode MVP flow
- Bug Bounty Mode scope/evidence/report proposal flow
- Single Writer, Multi Reviewer patch policy
- verification gate와 safety gate
- skill registry stub
- persistent decision log와 memory
- assistant-first CLI
- persistent run preview
- patch proposal approval gate
- risk confirmation, policy checklist, expiration metadata
- safe workspace preflight와 controlled apply
- rollback metadata 생성
- allow-listed package script 기반 applied workspace verification
- structured verification gate와 output artifact summary
- bug bounty scope intake persistence
- passive target map persistence
- endpoint, auth, role, file-flow, scope-boundary assessment
- evidence ledger persistence와 redaction
- report draft Markdown export
- mode capability allowlist 기반 safety policy engine
- active-testing stop condition
- passive target-map capability separation
- bug bounty run gate
- grouped help, command-specific help, suggested command 중심 CLI UX
- run listing, mode-neutral show, redacted Markdown export
- CI, issue/PR template, license, demo transcript, release checklist, architecture diagram
- read-only Dure Console static UI prototype
- redacted console-data JSON export와 UI import
- Development Mode project state detection
- package manager, language, framework, script, MVP stage estimate
- Development patch preview metadata
- file-level change plan, risk assessment, unified diff

v0.1에서 의도적으로 하지 않는 것:

- real LLM provider 필수화
- web dashboard
- arbitrary shell execution
- 자동 패키지 설치
- 외부 bug bounty target 접근, 스캔, exploit, report submission
- untrusted skill 자동 실행

## v0.2: 실제 사용성 강화

v0.2는 v0.1의 안전 모델을 유지하면서 반복 사용성을 높입니다.

- optional LLM provider interface wiring
- provider별 설정과 deterministic mock fallback
- 더 깊은 project file indexing
- framework-specific detector
- evidence ledger edit/update command
- report draft edit/update command
- export format과 destination 설정
- patch preview UX 개선
- approval 이후 controlled workspace content comparison
- security checklist engine
- configurable policy defaults
- verification summary 개선
- Dure Console run comparison
- Dure Console filtering과 artifact navigation

## v0.3: 승인형 실행과 복구력

v0.3은 실제 개발 워크플로우와 연결되는 부분을 더 단단하게 만듭니다.

- controlled workspace editing 고도화
- rollback command
- Stage 7 rollback metadata 기반 복구
- local tool adapter
- explicit approval 기반 minimal-impact bug bounty verification helper
- explicit approval 기반 dependency audit integration
- multi-run memory
- rollback summary
- policy decision diff

## v0.4+: 협업과 확장 생태계

v0.4 이후는 Dure가 팀 단위로 쓰일 수 있는 기반을 다룹니다.

- web UI
- team collaboration
- plugin marketplace
- signed skills
- sandboxed tool execution
- optional productivity/documentation integration
- organization policy profile
- shared audit log export
