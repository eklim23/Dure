# Release Checklist

Dure release tag를 만들기 전에 이 체크리스트를 사용합니다.

## 범위 확인

- [ ] release goal과 version을 확정했다.
- [ ] unfinished experimental UI 또는 외부 integration이 release 범위에 섞이지 않았다.
- [ ] v0.1 기본 동작은 deterministic이며 외부 API 키 없이 실행된다.
- [ ] Bug Bounty Mode는 explicit authorization과 future adapter layer 없이는 passive workflow로 유지된다.
- [ ] README, ROADMAP, SECURITY가 현재 구현 상태를 과장하지 않는다.

## 검증

- [ ] `corepack pnpm install --frozen-lockfile`
- [ ] `corepack pnpm test`
- [ ] Smoke: `corepack pnpm cli -- help`
- [ ] Smoke: `corepack pnpm cli -- help target-map`
- [ ] Smoke: `corepack pnpm cli -- --mode development "Create a tiny CLI app"`
- [ ] Smoke: `corepack pnpm cli -- --mode bug-bounty "Prepare an authorized bug bounty scope and evidence plan"`
- [ ] Smoke: bug bounty run에 대해 user-supplied passive data만 사용해 `scope`와 `target-map`을 기록했다.
- [ ] Smoke: unsafe target-map reference가 non-blocked `evidence`와 `report` action을 차단한다.
- [ ] Smoke: `corepack pnpm cli -- runs --limit 5`
- [ ] Smoke: `corepack pnpm cli -- export <run-id>`

## 문서

- [ ] README command example이 실제 CLI 동작과 일치한다.
- [ ] ROADMAP이 완료된 작업과 다음 작업을 정확히 구분한다.
- [ ] SECURITY가 현재 safety gate를 반영한다.
- [ ] CONTRIBUTING이 현재 package boundary와 테스트 명령을 반영한다.
- [ ] Demo transcript가 최신 CLI 흐름을 보여준다.
- [ ] Architecture diagram이 package boundary와 맞다.

## 보안 확인

- [ ] `.dure/runs` 또는 generated report가 커밋되지 않았다.
- [ ] secret, token, cookie, session, API key가 staged 상태가 아니다.
- [ ] Bug Bounty Mode 문서가 scanning/exploitation/report submission을 지원한다고 오해될 표현을 포함하지 않는다.
- [ ] skill execution 관련 문서가 untrusted skill 자동 실행을 암시하지 않는다.

## GitHub

- [ ] CI가 `main`에서 통과한다.
- [ ] issue template과 PR template이 정상 렌더링된다.
- [ ] release note에 known mocked behavior를 명시했다.
- [ ] tag format은 `vX.Y.Z`이다.

## v0.1 Known Limits

- web dashboard 없음
- real LLM provider wiring 없음
- arbitrary shell execution 없음
- 자동 패키지 설치 없음
- 외부 bug bounty target 접근, 스캔, exploit, report submission 없음
- rollback command는 아직 없고 rollback metadata만 생성
