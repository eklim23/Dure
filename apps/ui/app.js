const app = document.querySelector("#app");
const agentList = document.querySelector("#agent-list");
const agentNodes = document.querySelector("#agent-nodes");
const dialogueList = document.querySelector("#dialogue-list");
const conversationList = document.querySelector("#conversation-list");
const modeTitle = document.querySelector("#mode-title");
const stageTitle = document.querySelector("#stage-title");
const coreMode = document.querySelector("#core-mode");
const conversationTitle = document.querySelector("#conversation-title");
const conversationTarget = document.querySelector("#conversation-target");
const talkRoute = document.querySelector("#talk-route");
const snapshotFile = document.querySelector("#snapshot-file");
const snapshotFields = {
  run: document.querySelector("#snapshot-run"),
  status: document.querySelector("#snapshot-status"),
  proposal: document.querySelector("#snapshot-proposal"),
  decisions: document.querySelector("#snapshot-decisions"),
  project: document.querySelector("#snapshot-project"),
  scripts: document.querySelector("#snapshot-scripts"),
  patchRisk: document.querySelector("#snapshot-patch-risk"),
  patchFiles: document.querySelector("#snapshot-patch-files")
};

const details = {
  name: document.querySelector("#agent-name"),
  role: document.querySelector("#agent-role"),
  status: document.querySelector("#agent-status"),
  focus: document.querySelector("#agent-focus")
};

const settingFields = {
  mark: document.querySelector("#setting-agent-mark"),
  name: document.querySelector("#setting-agent-name"),
  role: document.querySelector("#setting-agent-role"),
  autospeak: document.querySelector("#setting-autospeak"),
  participation: document.querySelector("#setting-participation"),
  participationValue: document.querySelector("#setting-participation-value"),
  tone: document.querySelector("#setting-tone"),
  authority: document.querySelector("#setting-authority")
};

const modeContent = {
  development: {
    title: "개발 모드",
    stage: "UI Prototype",
    conversation: "개발 에이전트 논의",
    core: "개발 모드",
    target: "현재 대화 상대: Dure 조율자"
  },
  "bug-bounty": {
    title: "버그바운티 모드",
    stage: "Scope-safe UI Preview",
    conversation: "보안 에이전트 논의",
    core: "버그바운티 모드",
    target: "현재 대화 상대: Dure 조율자"
  }
};

const agents = [
  {
    id: "pm",
    name: "PMAgent",
    role: "제품 관리자",
    status: "범위 승인 중",
    focus: "사용자 목표를 MVP 단위로 줄이고 다음 결정을 잠급니다.",
    shape: "circle",
    state: "coordinating",
    color: "#d9a441",
    size: 62,
    x: "50%",
    y: "16%",
    defaults: { autospeak: true, participation: 80, tone: "balanced", authority: "approve" }
  },
  {
    id: "designer-a",
    name: "UIDesignerA",
    role: "공간 UI 디자이너",
    status: "작업판 구조 조정",
    focus: "에이전트가 일하는 흐름을 한눈에 보이게 만듭니다.",
    shape: "square",
    state: "designing",
    color: "#62c9a2",
    size: 54,
    x: "24%",
    y: "34%",
    defaults: { autospeak: true, participation: 65, tone: "friendly", authority: "advise" }
  },
  {
    id: "designer-b",
    name: "UIDesignerB",
    role: "대화 UX 디자이너",
    status: "대화 상대 표시 개선",
    focus: "사용자가 Dure와 대화 중인지, 특정 에이전트와 협의 중인지 분명히 보여줍니다.",
    shape: "capsule",
    state: "designing",
    color: "#5f9ce6",
    size: 52,
    x: "76%",
    y: "34%",
    defaults: { autospeak: true, participation: 70, tone: "friendly", authority: "review" }
  },
  {
    id: "designer-c",
    name: "UIDesignerC",
    role: "비주얼 시스템 디자이너",
    status: "도트 형태와 대비 검토",
    focus: "색만이 아니라 형태와 위치로 에이전트를 구분합니다.",
    shape: "diamond",
    state: "designing",
    color: "#a78bfa",
    size: 50,
    x: "36%",
    y: "72%",
    defaults: { autospeak: false, participation: 55, tone: "balanced", authority: "advise" }
  },
  {
    id: "developer",
    name: "DeveloperAgent",
    role: "구현 담당",
    status: "패치 제안 준비",
    focus: "작고 검증 가능한 개발 단계를 패치 미리보기로 정리합니다.",
    shape: "hex",
    state: "coordinating",
    color: "#78e6b0",
    size: 56,
    x: "66%",
    y: "68%",
    defaults: { autospeak: true, participation: 75, tone: "balanced", authority: "review" }
  },
  {
    id: "moochacker",
    name: "MoochackerAgent",
    role: "모의해킹 안전 리뷰어",
    status: "허가 범위 확인",
    focus: "버그바운티 흐름이 허가된 범위와 수동 기록 안에 머물도록 봅니다.",
    shape: "triangle",
    state: "guarding",
    color: "#ff8a78",
    size: 56,
    x: "20%",
    y: "58%",
    defaults: { autospeak: true, participation: 85, tone: "security", authority: "block" }
  },
  {
    id: "reviewer",
    name: "ReviewerAgent",
    role: "품질 리뷰어",
    status: "수용 기준 검토",
    focus: "설정, 대화 표시, 안전 문구, 반응형 레이아웃을 검토합니다.",
    shape: "diamond",
    state: "reviewing",
    color: "#db6b73",
    size: 50,
    x: "82%",
    y: "58%",
    defaults: { autospeak: true, participation: 70, tone: "strict", authority: "review" }
  }
];

const agentSettings = Object.fromEntries(
  agents.map((agent) => [agent.id, { ...agent.defaults }])
);

const conversations = [
  {
    mode: "all",
    agentId: "pm",
    kind: "PM 결정",
    title: "대화 주체 고정",
    body:
      "사용자는 항상 Dure와 대화합니다. Dure가 선택된 에이전트에게 내용을 전달하고, 필요한 검토 결과를 다시 사용자에게 정리합니다."
  },
  {
    mode: "all",
    agentId: "designer-b",
    kind: "UX 제안",
    title: "현재 대화 상대 표시",
    body:
      "상단 제목과 대화 경로에 현재 사용자가 말하는 대상, 선택된 에이전트, 회의 전달 경로를 함께 보여줍니다."
  },
  {
    mode: "all",
    agentId: "designer-a",
    kind: "UI 제안",
    title: "도트는 보조 정보",
    body:
      "움직이는 도트는 에이전트 활동을 보여주는 보조 화면으로 낮추고, 실제 작업은 대화와 설정 패널에서 보이게 합니다."
  },
  {
    mode: "all",
    agentId: "designer-c",
    kind: "비주얼 기준",
    title: "한국어 중심 인터페이스",
    body:
      "레이블, 상태, 안내 문구를 한국어로 정리하고 에이전트 이름은 고유 식별자로 유지합니다."
  },
  {
    mode: "development",
    agentId: "developer",
    kind: "개발 메모",
    title: "패치 제안 중심",
    body:
      "개발 모드에서는 Dure가 요구사항을 받고 Builder/Reviewer 흐름으로 작고 안전한 패치 제안을 준비합니다."
  },
  {
    mode: "bug-bounty",
    agentId: "moochacker",
    kind: "보안 메모",
    title: "허가 범위 우선",
    body:
      "버그바운티 모드에서는 실제 대상 접근 없이 scope, evidence, report draft를 수동 기록 중심으로 다룹니다."
  },
  {
    mode: "all",
    agentId: "reviewer",
    kind: "리뷰",
    title: "정적 화면 경계",
    body:
      "이 화면의 설정은 로컬 미리보기 상태입니다. 실행, 승인, 적용, 스캔, 외부 요청은 수행하지 않습니다."
  }
];

let selectedAgentId = "pm";
let currentMode = "development";
let snapshotConversationEntries = [];

function agentById(id) {
  return agents.find((agent) => agent.id === id) ?? agents[0];
}

function setText(node, value) {
  node.textContent = value;
}

function toneLabel(value) {
  return {
    balanced: "균형",
    strict: "엄격",
    friendly: "친절",
    security: "보안 중심"
  }[value];
}

function authorityLabel(value) {
  return {
    advise: "조언",
    review: "검토",
    block: "차단 요청",
    approve: "PM 승인"
  }[value];
}

function renderAgents() {
  agentList.replaceChildren(
    ...agents.map((agent) => {
      const settings = agentSettings[agent.id];
      const button = document.createElement("button");
      const glyph = document.createElement("span");
      const textWrap = document.createElement("span");
      const name = document.createElement("strong");
      const role = document.createElement("span");
      const meta = document.createElement("small");

      button.type = "button";
      button.className = "agent-row";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(agent.id === selectedAgentId));
      button.dataset.agentId = agent.id;
      button.style.setProperty("--agent-color", agent.color);
      glyph.className = `agent-glyph shape-${agent.shape}`;
      glyph.setAttribute("aria-hidden", "true");
      name.textContent = agent.name;
      role.textContent = agent.role;
      meta.textContent = `${settings.participation}% · ${authorityLabel(settings.authority)}`;
      textWrap.append(name, role, meta);
      button.append(glyph, textWrap);
      return button;
    })
  );

  agentNodes.replaceChildren(
    ...agents.map((agent) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `agent-node shape-${agent.shape} state-${agent.state}`;
      button.classList.toggle("selected", agent.id === selectedAgentId);
      button.dataset.agentId = agent.id;
      button.dataset.label = agent.name;
      button.style.setProperty("--agent-color", agent.color);
      button.style.setProperty("--size", `${agent.size}px`);
      button.style.setProperty("--x", agent.x);
      button.style.setProperty("--y", agent.y);
      button.setAttribute("aria-label", `${agent.name} 선택, ${agent.role}`);
      const label = document.createElement("span");
      label.textContent = agent.name.slice(0, 2);
      button.append(label);
      return button;
    })
  );
}

function renderSettings() {
  const agent = agentById(selectedAgentId);
  const settings = agentSettings[selectedAgentId];
  settingFields.mark.className = `agent-glyph shape-${agent.shape}`;
  settingFields.mark.style.setProperty("--agent-color", agent.color);
  setText(settingFields.name, agent.name);
  setText(settingFields.role, agent.role);
  settingFields.autospeak.checked = settings.autospeak;
  settingFields.participation.value = String(settings.participation);
  setText(settingFields.participationValue, `${settings.participation}%`);
  settingFields.tone.value = settings.tone;
  settingFields.authority.value = settings.authority;
}

function renderInspector() {
  const agent = agentById(selectedAgentId);
  const settings = agentSettings[selectedAgentId];
  setText(details.name, agent.name);
  setText(details.role, agent.role);
  setText(details.status, agent.status);
  setText(
    details.focus,
    `${agent.focus} 설정: ${settings.autospeak ? "자동 발언 켜짐" : "자동 발언 꺼짐"}, ${settings.participation}% 참여, ${toneLabel(settings.tone)} 톤, ${authorityLabel(settings.authority)} 권한.`
  );
  setText(conversationTarget, "현재 대화 상대: Dure 조율자");
  setText(talkRoute, `나 → Dure → ${agent.name}`);
}

function renderDialogue() {
  const agent = agentById(selectedAgentId);
  const settings = agentSettings[selectedAgentId];
  const rows = [
    {
      speaker: "나",
      route: "사용자 → Dure",
      body: "자연어로 목표를 말하면 Dure가 먼저 의도를 정리합니다."
    },
    {
      speaker: "Dure",
      route: `Dure → ${agent.name}`,
      body: `${agent.name}에게 ${authorityLabel(settings.authority)} 관점으로 검토를 요청합니다.`
    },
    {
      speaker: agent.name,
      route: `${agent.role} → Dure`,
      body: `${toneLabel(settings.tone)} 톤으로 응답하고, 참여도 ${settings.participation}%로 회의에 반영됩니다.`
    }
  ];

  dialogueList.replaceChildren(
    ...rows.map((row) => {
      const article = document.createElement("article");
      const speaker = document.createElement("strong");
      const route = document.createElement("span");
      const body = document.createElement("p");
      article.className = "dialogue-row";
      speaker.textContent = row.speaker;
      route.textContent = row.route;
      body.textContent = row.body;
      article.append(speaker, route, body);
      return article;
    })
  );
}

function renderConversation() {
  const visible = [...snapshotConversationEntries, ...conversations].filter(
    (entry) =>
      (entry.mode === "all" || entry.mode === currentMode) &&
      (entry.agentId === selectedAgentId || entry.agentId === "pm")
  );

  conversationList.replaceChildren(
    ...visible.map((entry) => {
      const agent = agentById(entry.agentId);
      const article = document.createElement("article");
      const speaker = document.createElement("div");
      const speakerName = document.createElement("strong");
      const speakerRole = document.createElement("span");
      const body = document.createElement("div");
      const kind = document.createElement("span");
      const title = document.createElement("h3");
      const text = document.createElement("p");

      article.className = "conversation-entry";
      speaker.className = "speaker";
      body.className = "entry-body";
      kind.className = "entry-kind";
      speakerName.textContent = agent.name;
      speakerRole.textContent = agent.role;
      kind.textContent = entry.kind;
      title.textContent = entry.title;
      text.textContent = entry.body;

      speaker.append(speakerName, speakerRole);
      body.append(kind, title, text);
      article.append(speaker, body);
      return article;
    })
  );
}

function updateMode(mode) {
  currentMode = mode;
  app.dataset.mode = mode;
  document.querySelectorAll("[data-mode-choice]").forEach((button) => {
    const isActive = button.dataset.modeChoice === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  const content = modeContent[mode];
  setText(modeTitle, content.title);
  setText(stageTitle, content.stage);
  setText(coreMode, content.core);
  setText(conversationTitle, content.conversation);
  setText(conversationTarget, content.target);
  renderConversation();
}

function selectAgent(agentId) {
  selectedAgentId = agentId;
  renderAgents();
  renderSettings();
  renderInspector();
  renderDialogue();
  renderConversation();
}

function applyConsoleSnapshot(snapshot) {
  const runMode = normalizeSnapshotMode(snapshot.run.selectedMode);
  snapshotConversationEntries = [
    ...patchPreviewEntries(snapshot),
    ...snapshot.decisions.slice(-6).reverse().map((entry) => ({
      mode: "all",
      agentId: decisionAgent(entry.type),
      kind: "Decision Log",
      title: entry.type.replace(/_/g, " "),
      body: `${entry.timestamp}: ${entry.message}`
    }))
  ];

  setText(snapshotFields.run, snapshot.run.id);
  setText(snapshotFields.status, snapshot.run.status);
  setText(snapshotFields.proposal, `${snapshot.run.proposalKind} / ${snapshot.proposal.riskLevel}`);
  setText(snapshotFields.decisions, String(snapshot.decisions.length));
  setText(snapshotFields.project, summarizeSnapshotProject(snapshot));
  setText(snapshotFields.scripts, summarizeSnapshotScripts(snapshot));
  setText(snapshotFields.patchRisk, summarizeSnapshotPatchRisk(snapshot));
  setText(snapshotFields.patchFiles, summarizeSnapshotPatchFiles(snapshot));
  updateMode(runMode);
  selectAgent(snapshot.run.selectedMode === "bug_bounty" ? "moochacker" : "developer");
}

function patchPreviewEntries(snapshot) {
  const preview = snapshot.development?.patchPreview;
  if (!preview) {
    return [];
  }
  return [
    {
      mode: "development",
      agentId: "developer",
      kind: "Patch Preview",
      title: `위험도 ${preview.riskAssessment.overallRisk}`,
      body: `${preview.summary} 대상 파일: ${preview.changePlan.map((change) => `${change.operation} ${change.path}`).join(", ")}.`
    }
  ];
}

function summarizeSnapshotProject(snapshot) {
  if (!snapshot.projectState) {
    return "기록 없음";
  }
  return `${snapshot.projectState.packageManager} / stage ${snapshot.projectState.currentMvpStage.id}`;
}

function summarizeSnapshotScripts(snapshot) {
  if (!snapshot.projectState) {
    return "기록 없음";
  }
  return snapshot.projectState.configuredScripts.length > 0
    ? snapshot.projectState.configuredScripts.join(", ")
    : "없음";
}

function summarizeSnapshotPatchRisk(snapshot) {
  const preview = snapshot.development?.patchPreview;
  if (!preview) {
    return "기록 없음";
  }
  return preview.riskAssessment.separateApprovalRequired
    ? `${preview.riskAssessment.overallRisk} / 별도 승인`
    : preview.riskAssessment.overallRisk;
}

function summarizeSnapshotPatchFiles(snapshot) {
  const preview = snapshot.development?.patchPreview;
  return preview ? String(preview.changePlan.length) : "0";
}

function normalizeSnapshotMode(mode) {
  return mode === "bug_bounty" ? "bug-bounty" : "development";
}

function decisionAgent(type) {
  if (type.includes("bug_bounty") || type.includes("safety")) {
    return "moochacker";
  }
  if (type.includes("verification") || type.includes("review")) {
    return "reviewer";
  }
  if (type.includes("proposal") || type.includes("patch")) {
    return "developer";
  }
  return "pm";
}

function isConsoleSnapshot(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.version === "0.1.0" &&
      value.source?.kind === "dure-console-data" &&
      value.source?.readOnly === true &&
      value.run?.id &&
      value.proposal?.kind &&
      Array.isArray(value.decisions)
  );
}

async function importSnapshotFile(file) {
  try {
    const source = await file.text();
    const snapshot = JSON.parse(source);
    if (!isConsoleSnapshot(snapshot)) {
      throw new Error("지원하지 않는 Dure console data 파일입니다.");
    }
    applyConsoleSnapshot(snapshot);
  } catch (error) {
    setText(snapshotFields.status, error instanceof Error ? error.message : "불러오지 못했습니다.");
  } finally {
    snapshotFile.value = "";
  }
}

document.addEventListener("click", (event) => {
  const modeButton = event.target.closest("[data-mode-choice]");
  if (modeButton) {
    updateMode(modeButton.dataset.modeChoice);
    return;
  }

  const agentButton = event.target.closest("[data-agent-id]");
  if (agentButton) {
    selectAgent(agentButton.dataset.agentId);
  }
});

document.addEventListener("change", (event) => {
  if (!Object.values(settingFields).includes(event.target)) {
    return;
  }

  const settings = agentSettings[selectedAgentId];
  settings.autospeak = settingFields.autospeak.checked;
  settings.participation = Number(settingFields.participation.value);
  settings.tone = settingFields.tone.value;
  settings.authority = settingFields.authority.value;
  selectAgent(selectedAgentId);
});

document.addEventListener("input", (event) => {
  if (event.target !== settingFields.participation) {
    return;
  }

  agentSettings[selectedAgentId].participation = Number(settingFields.participation.value);
  setText(settingFields.participationValue, `${settingFields.participation.value}%`);
  renderAgents();
  renderInspector();
  renderDialogue();
});

snapshotFile.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) {
    void importSnapshotFile(file);
  }
});

renderAgents();
renderSettings();
renderInspector();
renderDialogue();
renderConversation();
