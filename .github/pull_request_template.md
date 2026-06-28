## Summary

- 무엇을 바꿨나요?
- 이 변경이 지금 단계에서 가장 작은 유용한 변경인 이유는 무엇인가요?
- 관련 issue, decision log, design note가 있다면 연결해 주세요.

## Scope

- [ ] CLI / 사용자 출력
- [ ] Development Mode
- [ ] Bug Bounty Mode
- [ ] Safety Policy / Approval Gate
- [ ] Memory / Decision Log
- [ ] Docs / Examples
- [ ] UI Prototype

## Safety

- [ ] 승인 없는 셸 실행을 추가하지 않았습니다.
- [ ] approval gate 없이 외부 네트워크/API 동작을 추가하지 않았습니다.
- [ ] patch/apply 흐름은 Single Writer, Multi Reviewer 원칙을 유지합니다.
- [ ] Bug Bounty Mode는 명시적 허가와 범위 없이는 passive workflow로 유지됩니다.
- [ ] secret, token, cookie, private report, live target data를 포함하지 않았습니다.
- [ ] `.dure/runs`, `dist`, 로컬 export 파일이 커밋되지 않았습니다.

## Verification

- [ ] `corepack pnpm test`
- [ ] CLI 출력 또는 사용자 흐름이 바뀌었다면 README/docs를 업데이트했습니다.
- [ ] run artifact, decision log, redaction, approval/apply 동작이 바뀌었다면 테스트를 추가했습니다.
- [ ] Bug Bounty Mode 변경은 scope boundary와 stop condition을 검토했습니다.

## Notes

리뷰어가 집중해서 봐야 할 부분, 의도적으로 제외한 범위, 다음 작업을 적어 주세요.
