# Dure

[![CI](https://github.com/eklim23/Dure/actions/workflows/ci.yml/badge.svg)](https://github.com/eklim23/Dure/actions/workflows/ci.yml)

Dure는 개발 작업과 허가된 버그바운티 작업을 안전하게 다루기 위한 개인 AI 어시스턴트이자 멀티 에이전트 오케스트레이터입니다.

일반적인 코딩 챗봇처럼 곧바로 많은 코드를 생성하는 것이 목표가 아닙니다. Dure는 자연어 요청을 이해하고, 의도를 추론하고, 적절한 모드를 선택하고, 필요한 에이전트 팀을 구성한 뒤, 통제된 제안과 검증 가능한 기록을 남기는 것을 우선합니다.

Dure의 핵심 방향은 두 가지 1차 모드입니다.

- Development Mode
- Bug Bounty Mode

문서 작성, 보안 리뷰, 운영 계획, 생산성 보조 같은 기능은 보조 모드로 둘 수 있지만, 제품의 중심은 개발과 허가된 보안 리뷰입니다.

## 동기

Dure는 OpenClo 계열의 문제의식에서 영감을 받았습니다. 자연어로 의도를 말하면 시스템이 내부 목표 상태를 추론하고, 여러 역할의 에이전트가 논의하고, 최소 실행 가능한 단계를 먼저 안정화하는 흐름이 중요하다고 봅니다.

다만 Dure의 초점은 더 좁고 보수적입니다. 개발 모드와 버그바운티 모드를 중심으로, 자동 실행보다 기록 가능성, 롤백 가능성, 승인 게이트, 보안 정책, 감사 가능한 결정 로그를 우선합니다.

## v0.1 범위

- 자연어 요청을 받는 Assistant Core
- 작업 모드를 자동 선택하는 Intent Router
- 구조화된 제안을 만드는 deterministic task modes
- MVP 우선 개발 흐름, 정적 프로젝트 상태 감지, patch preview를 포함한 Development Mode
- authorization, scope, passive target mapping, evidence, report gate를 포함한 Bug Bounty Mode
- Documentation, Security, Operations, Productivity, Assistant 보조 모드
- Development patch에 대한 Single Writer, Multi Reviewer 정책
- verification gate와 safety policy gate
- decision log / memory
- skill registry stub
- 읽기 전용 Dure Console 정적 UI prototype
- 외부 LLM API key 없이 실행 가능
- 실제 이메일, 캘린더, 서버, shell, cloud, network integration 없음

## 핵심 모드

- Development Mode: 코드 계획, 정적 프로젝트 상태 감지, MVP 우선 구현, patch proposal, patch preview, 테스트, 리뷰
- Bug Bounty Mode: 허가된 웹 보안 리뷰 계획, scope control, MoochackerAgent safety assessment, passive target mapping, evidence ledger, report draft

## 보조 모드

- Assistant Mode: 일반 답변, 계획, 요약, 가벼운 도움
- Documentation Mode: README, report, spec, architecture 문서, summary
- Security Mode: security review, threat modeling, dependency risk, secret scan placeholder
- Operations Mode: server/project status review, deployment planning, log review placeholder
- Personal Productivity Mode: schedule/email/task planning placeholder

## 설치

요구 사항:

- Node.js 22+
- Corepack을 통한 pnpm 9+

```bash
cd C:\Users\eklim\EKLIM\Works\Dure
corepack enable
corepack pnpm install
corepack pnpm build
```

## 실행

Assistant-first 실행:

```bash
corepack pnpm cli -- "Create a simple login-enabled bulletin board"
```

CLI 도움말:

```bash
corepack pnpm cli -- help
corepack pnpm cli -- help target-map
corepack pnpm cli -- preview --help
```

모드를 명시적으로 지정:

```bash
corepack pnpm cli -- --mode development "Create a simple login-enabled bulletin board"
corepack pnpm cli -- --mode bug-bounty "Prepare an authorized bug bounty scope and evidence plan"
```

명시적 assistant command:

```bash
corepack pnpm cli -- ask "Draft a README for this project"
```

기존 개발형 command 호환:

```bash
corepack pnpm cli -- run "Create a simple login-enabled bulletin board"
```

저장된 run 확인:

```bash
corepack pnpm cli -- runs --limit 10
corepack pnpm cli -- show <run-id>
corepack pnpm cli -- export <run-id>
corepack pnpm cli -- console-data <run-id> --output .dure/runs/<run-id>/console-data.json
```

`runs`는 최근 `.dure/runs` 기록을 보여줍니다. `show`는 모드와 상관없이 run 요약과 다음 추천 명령을 출력합니다. `export`는 redaction이 적용된 Markdown audit summary를 `.dure/runs/<run-id>/export.md`에 저장합니다. `console-data`는 정적 UI prototype에서 가져올 수 있는 읽기 전용 JSON snapshot을 생성합니다.

Development run은 `.dure/runs/<run-id>/project-state.json`도 저장합니다. 이 파일에는 파일 인덱스 요약, package manager evidence, 감지된 언어와 framework, 설정된 `test`/`lint`/`typecheck`/`build` script, 현재 MVP stage 추정치가 들어갑니다. 프로젝트 상태 감지 과정에서는 script를 실행하지 않습니다.

## Development Workflow

저장된 development patch proposal 미리 보기:

```bash
corepack pnpm cli -- preview <run-id>
```

`preview`는 읽기 전용입니다. `.dure/runs/<run-id>/`를 읽어 patch summary, risk assessment, file-level change plan, proposed unified diff, verification summary를 출력하며 approve, apply, execute를 하지 않습니다.

patch proposal 승인 또는 거절:

```bash
corepack pnpm cli -- approve <run-id> --confirm-risk medium --reason "Reviewed the patch proposal"
corepack pnpm cli -- reject <run-id> --reason "Needs a narrower scope"
```

승인은 `.dure/runs/<run-id>/approval.json`을 기록하고, policy checklist, risk confirmation, approval expiration, metadata status, `decision-log.jsonl` entry를 저장합니다. medium/high risk patch나 separate approval 조건은 `--confirm-risk <level>`이 필요합니다. approval은 파일을 적용하거나 명령을 실행하거나 commit/push/test를 실행하지 않습니다.

승인된 patch를 controlled workspace에 적용:

```bash
corepack pnpm cli -- apply <run-id>
corepack pnpm cli -- apply <run-id> --workspace C:\path\to\controlled-workspace
```

`--workspace`가 없으면 `.dure/workspaces/<run-id>`에 적용합니다. apply는 approved, unexpired, verified patch proposal만 허용합니다. local preflight를 실행하고 create/modify만 허용하며 delete, unsafe path, unsafe workspace root, symlink path를 차단합니다. `apply.json`과 `rollback.json`을 기록하지만 verification이나 git command는 실행하지 않습니다.

적용된 workspace 검증:

```bash
corepack pnpm cli -- verify <run-id>
corepack pnpm cli -- verify <run-id> --script test --timeout-ms 30000
```

verification은 `package.json`의 allow-listed script만 실행합니다: `test`, `lint`, `typecheck`. `apply.json`에 기록된 동일 workspace를 대상으로 해야 하며, v0.1에서는 pre/post lifecycle hook을 차단합니다. secret-like output을 redaction하고 `workspace-verification.json`과 `verification-output/`을 기록하며 run status를 `verified` 또는 `failed`로 업데이트합니다.

## Bug Bounty Workflow

Bug Bounty Mode는 허가된 범위 안에서만 동작해야 합니다. v0.1은 target에 요청을 보내지 않고, scanner를 실행하지 않으며, finding을 검증하거나 제출하지 않습니다. 모든 데이터는 사용자가 제공한 scope, target map, evidence note, report draft에서 옵니다.

scope intake 기록:

```bash
corepack pnpm cli -- scope <run-id> --target "api.example.com" --in-scope "api.example.com,/v1/*" --out-of-scope "admin.example.com" --allowed "read-only authorization checks" --forbidden "DoS,brute force" --rate-limit "10 requests per minute" --roles "user,admin-test" --data "redact tokens and personal data" --authorization-note "Program scope supplied by user"
```

scope intake는 `.dure/runs/<run-id>/scope.json`을 기록합니다. MoochackerAgent의 passive scope assessment, intake checklist, target boundary classification, secret-like scope field redaction을 저장하며 target에 접속하지 않습니다.

passive target map 기록 또는 조회:

```bash
corepack pnpm cli -- target-map <run-id>
corepack pnpm cli -- target-map <run-id> --host "api.example.com" --app "Public API" --api-base "https://api.example.com/v1" --auth-state "authenticated" --role-access "user|authenticated|GET /v1/orders/{id}|GET /admin|Owned test user only" --endpoint "GET|api.example.com|/v1/orders/{id}|authenticated|user|false|none|id|||Read order detail" --artifact "user supplied OpenAPI excerpt"
```

target map은 충분한 scope intake가 있어야 기록할 수 있으며 `.dure/runs/<run-id>/target-map.json`에 저장됩니다. host, app, API base, auth state, role access, endpoint, state-changing action, file upload/download flow, redirect, third-party integration, source artifact, out-of-scope reference, redaction metadata, next recommended action을 기록합니다. Dure는 target map을 사용자 제공 artifact에서만 만들고 요청을 보내지 않습니다.

Safety policy는 passive target-map recording과 automated target mapping을 분리합니다. passive target-map 기록은 허용되지만, automated target mapping은 external placeholder로 남아 있으며 v0.1에서 차단됩니다.

evidence lead 기록 또는 조회:

```bash
corepack pnpm cli -- evidence <run-id>
corepack pnpm cli -- evidence <run-id> --status testing --asset "api.example.com" --endpoint "/v1/orders/{id}" --method GET --role "user" --hypothesis "Possible object-level authorization issue" --impact "Potential cross-account order detail exposure" --confidence medium --scope-note "api.example.com and /v1/* are in scope" --next-action "Confirm safely with owned test accounts"
```

evidence entry는 `.dure/runs/<run-id>/evidence-ledger.jsonl`에 append-only로 저장됩니다. lead id, hypothesis, status, request/response placeholder, impact, confidence, scope note, next action을 기록합니다. 저장 전 redaction을 적용하며 HTTP request, scanner, target access, finding validation을 실행하지 않습니다. 기록된 target map에 out-of-scope reference가 있으면 Dure는 일반 evidence 기록을 차단하고 `blocked` audit note만 허용합니다.

report draft 생성 또는 조회:

```bash
corepack pnpm cli -- report <run-id>
corepack pnpm cli -- report <run-id> --lead <lead-id> --severity medium --title "Confirmed cross-account order detail exposure"
```

report draft는 기존 evidence ledger entry에서만 생성됩니다. Dure는 `.dure/runs/<run-id>/reports/<report-id>.json`과 `.md`를 기록하고, severity를 보수적으로 보정하며, unconfirmed lead에 대한 high/critical severity를 차단합니다. target-map safety gate가 unsafe이면 report 생성을 차단합니다. Dure는 finding을 검증하거나 제출하거나 target에 연락하지 않습니다.

## UI Prototype

Dure에는 정적 읽기 전용 console prototype도 포함되어 있습니다.

```text
apps/ui/index.html
```

브라우저에서 이 파일을 직접 열면 Stage 16 UI concept을 볼 수 있습니다. clickable agent dots, curated council discussion, Development Mode의 초록빛, Bug Bounty / Security Mode의 붉은빛을 시각화합니다.

저장된 run을 prototype에서 확인하려면 console snapshot을 생성한 뒤 Run Snapshot panel에서 JSON을 import합니다.

```bash
corepack pnpm cli -- console-data <run-id> --output .dure/runs/<run-id>/console-data.json
```

import한 development snapshot은 project state, patch preview risk, file count도 보여줄 수 있습니다. prototype은 local-only입니다. backend를 호출하지 않고, run record를 직접 읽지 않고, tool을 실행하지 않으며, target scan, patch approval, apply, verify를 수행하지 않습니다.

## 출력 예시

기본 실행:

```text
Dure v0.1

Original Request:
  - Create a simple login-enabled bulletin board

Selected Mode:
  - development
  - confidence: 0.95
  - intent: Plan and propose the smallest safe development step.

Assistant Core Summary:
  - requires approval: yes
  - external tools required: no
  - capabilities: read_project_files, propose_file_changes, run_tests_placeholder

Proposal Summary:
  - patch-... (patch)
  - Controlled proposal for Stage 1: create executable skeleton.

Suggested Commands:
  - dure preview <run-id>
  - dure show <run-id>
```

patch preview:

```text
Dure Preview

Run:
  - id: run-20260627-000003Z-abc123
  - mode: development
  - run status: proposed
  - proposal: patch-...

Patch:
  - status: accepted
  - risk: high
  - approval required: yes

Patch Risk:
  - overall risk: high
  - separate approval required: yes

File-Level Change Plan:
  - package.json: modify, medium risk

Unified Diff:
  diff --git a/package.json b/package.json

Suggested Commands:
  - dure approve run-20260627-000003Z-abc123 --confirm-risk high --reason "Reviewed preview output"
```

approval:

```text
Dure Approval

Run:
  - id: run-20260627-000003Z-abc123
  - previous status: proposed
  - new status: approved
  - proposal: patch-...

Approval Policy:
  - risk: medium
  - confirmation required: yes
  - confirmed risk: medium

Suggested Commands:
  - dure apply run-20260627-000003Z-abc123
```

bug bounty scope:

```text
Dure Bug Bounty Scope

Scope:
  - status: sufficient
  - safety: safe
  - in scope: api.example.com, /v1/*
  - forbidden: DoS, brute force

Intake Assessment:
  - missing fields: none
  - blocked reasons: none
  - redacted fields: none

Boundaries:
  - in_scope: host api.example.com -> api.example.com
```

bug bounty evidence:

```text
Dure Evidence

Run:
  - id: run-20260627-000003Z-abc123
  - lead: lead-20260627-000004Z-def456

Lead:
  - status: testing
  - confidence: medium
  - asset: api.example.com

Redaction:
  - applied: yes
```

bug bounty report draft:

```text
Dure Report Draft

Run:
  - id: run-20260627-000003Z-abc123
  - report: report-20260627-000005Z-ghi789
  - lead: lead-20260627-000004Z-def456

Finding:
  - title: Confirmed cross-account order detail exposure
  - severity: medium
  - confidence: high
  - asset: api.example.com

Export:
  - markdown: .dure/runs/run-20260627-000003Z-abc123/reports/report-20260627-000005Z-ghi789.md
```

controlled apply:

```text
Dure Apply

Run:
  - id: run-20260627-000003Z-abc123
  - previous status: approved
  - new status: applied

Preflight:
  - checks passed: 6/6
  - creates: 2
  - modifies: 0
  - backups planned: 0

Changes:
  - create: package.json
  - create: src/index.js
```

workspace verification:

```text
Dure Verification

Run:
  - id: run-20260627-000003Z-abc123
  - previous status: applied
  - new status: verified

Summary:
  - passed commands: 1
  - required gates passed: yes
  - dependency audit: placeholder

Commands:
  - test: passed (exit 0, 320ms)
  - lint: not_configured (exit n/a, 0ms)

Verification Gates:
  - passed: test (required)
  - skipped: dependency_audit (optional)
```

## Workspace 구조

```text
apps/cli                 CLI entry point
apps/ui                  Read-only Dure Console static prototype
packages/core            Shared strict types
packages/assistant-core  Assistant-level request context and run flow
packages/intent-router   Deterministic task mode classification
packages/task-modes      Mode-specific deterministic proposal builders
packages/orchestrator    Development mode intent, MVP ladder, council, verification
packages/council         Deterministic mock reviewer agents
packages/builder-runtime Single-writer patch proposal runtime and preview metadata
packages/verifier        Verification gate interfaces and local scans
packages/safety-policy   Mode capability policy and stop-condition engine
packages/skill-registry  Previewable skill manifest registry
packages/sandbox         Controlled path and workspace helpers
packages/memory          Decision log, run store, and Markdown run export
docs/                    Architecture, threat model, council, skills
skills/                  Example local skill manifests
examples/                Future example projects
```

## 문서

- [Architecture](./docs/architecture.md)
- [Architecture diagram](./docs/architecture-diagram.md)
- [Threat model](./docs/threat-model.md)
- [Agent council](./docs/agent-council.md)
- [Skill format](./docs/skill-format.md)
- [Demo transcript](./docs/demo-transcript.md)
- [Release checklist](./docs/release-checklist.md)
- [Roadmap](./ROADMAP.md)
- [Security](./SECURITY.md)
- [Contributing](./CONTRIBUTING.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)

## v0.1에서 mock 또는 placeholder인 것

- Agent reasoning은 deterministic rule 기반입니다.
- Task mode routing은 keyword/signal 기반입니다.
- Development project state detection은 정적/local 분석입니다. manifest, lockfile, file name, package script를 읽지만 script를 실행하지 않습니다.
- Development patch preview는 proposal-generated입니다. modify/delete diff는 기존 파일 내용을 읽지 않고 placeholder를 사용합니다.
- Safety policy evaluation은 deterministic/local입니다. policy configuration은 아직 user-editable하지 않습니다.
- Run export는 redaction이 적용된 local Markdown summary만 생성합니다. 더 다양한 export format은 아직 없습니다.
- MoochackerAgent는 structured bug bounty safety guidance만 생성합니다. active testing, target access, external request는 실행하지 않습니다.
- Bug bounty evidence record는 사용자 제공 ledger entry입니다. Dure는 finding을 증명, 재현, active test하지 않습니다.
- Bug bounty report draft는 저장된 evidence에서만 생성됩니다. Dure는 finding을 검증, 제출, target contact하지 않습니다.
- Bug bounty scope intake assessment는 passive/local입니다. 사용자 제공 boundary를 분류하지만 related asset을 discover하지 않습니다.
- Approval record는 controlled apply를 위한 durable gate입니다. approval 자체는 파일을 수정하지 않고, stale apply를 막기 위해 expiration을 가집니다.
- Controlled apply는 preflight 후 approved patch content만 controlled workspace에 기록합니다. rollback metadata는 기록하지만 rollback execution은 아직 구현하지 않았습니다.
- Proposal-time test, lint, typecheck check는 placeholder입니다.
- Applied workspace verification은 allow-listed `test`, `lint`, `typecheck` package script만 실행할 수 있으며 structured gate summary와 redacted output artifact metadata를 기록합니다.
- Dependency audit은 placeholder이며 v0.1에서 registry에 접속하지 않습니다.
- Operations와 productivity integration은 declaration만 있습니다.
- Patch proposal은 structured data이며 자동 적용되지 않습니다.
- LLM provider는 interface만 있습니다.
- Skill은 preview할 수 있지만 untrusted skill은 자동 실행하지 않습니다.

## 다음 단계

v0.2 이후 우선순위는 [ROADMAP.md](./ROADMAP.md)를 참고하세요.

## License

Dure는 [MIT License](./LICENSE)로 배포됩니다.
