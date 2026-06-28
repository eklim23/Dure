# Todo App Example

이 예제는 Development Mode 동작을 확인하기 위한 가장 작은 기준 prompt입니다. 실제 todo app 구현체라기보다, Dure가 “작은 MVP 단계로 제안하고 기록하는지”를 검증하는 용도입니다.

## 실행

```bash
corepack pnpm cli -- --mode development "Create a minimal todo CLI app"
```

v0.1에서 Dure는 deterministic mock agent를 사용하고 `PatchProposal` summary를 생성합니다. 사용자가 명시적으로 approve/apply하지 않는 한 이 예제 디렉터리를 자동으로 수정하지 않습니다.

## 기대 흐름

- Intent Router가 Development Mode를 선택합니다.
- Agent Council이 가장 작은 안전한 MVP 단계를 제안합니다.
- BuilderRuntime이 structured patch proposal을 생성합니다.
- Safety Policy와 Verification 결과가 기록됩니다.
- 실행 기록은 `.dure/runs/<run-id>/`에 저장됩니다.
- run은 `dure runs`, `dure show <run-id>`, `dure export <run-id>`로 확인할 수 있습니다.

## 확인 명령

```bash
corepack pnpm cli -- runs --limit 5
corepack pnpm cli -- show <run-id>
corepack pnpm cli -- preview <run-id>
corepack pnpm cli -- export <run-id>
```

## 이 예제가 확인하는 것

- 자연어 요청이 slash command 없이 처리되는가
- Dure가 곧바로 파일을 수정하지 않고 patch preview를 먼저 만드는가
- proposal, safety decision, verification result, decision log가 persistent artifact로 남는가
- 다음 추천 행동이 approval/apply 흐름과 연결되는가
