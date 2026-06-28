# Dure Console Prototype

`apps/ui`는 Dure 에이전트 흐름을 보여주는 정적 읽기 전용 UI prototype입니다.

브라우저에서 `index.html`을 열거나 로컬 정적 서버로 실행할 수 있습니다. 이 화면은 backend, network call, persistence, target access, patch apply 동작을 수행하지 않습니다.

## 보여주는 것

- 사용자는 Dure와 대화하고, Dure가 선택된 에이전트에게 전달하는 구조
- 가운데 `Dure에게 말하기` 채팅 입력
- 오른쪽 `에이전트 회의 보기` 회의록
- 에이전트별 이름, 역할, 자동 발언, 참여도, 응답 톤, 권한 설정
- 에이전트 색상과 생김새 설정
- Development Mode의 초록 작업 상태
- Bug Bounty Mode의 빨간 보안 상태
- 정돈된 배지 형태의 움직이는 agent dot
- 선택한 에이전트 기준의 논의 transcript
- redacted `dure console-data` JSON snapshot import
- 실행 기록, 프로젝트 상태, patch preview risk 요약

## Run Snapshot 확인

CLI에서 읽기 전용 UI snapshot을 생성합니다.

```bash
corepack pnpm cli -- console-data <run-id> --output .dure/runs/<run-id>/console-data.json
```

그다음 UI의 `JSON 불러오기`에서 해당 파일을 선택합니다.

## 하지 않는 것

- 작업 실행
- LLM provider 호출
- run record 읽기/쓰기
- target scan 또는 HTTP request
- patch approve/apply/verify
- imported diff text를 실행 가능한 변경으로 처리
