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
const meetingStatus = document.querySelector("#meeting-status");
const meetingRoute = document.querySelector("#meeting-route");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
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
  displayName: document.querySelector("#setting-display-name"),
  editableRole: document.querySelector("#setting-role"),
  autospeak: document.querySelector("#setting-autospeak"),
  participation: document.querySelector("#setting-participation"),
  participationValue: document.querySelector("#setting-participation-value"),
  tone: document.querySelector("#setting-tone"),
  authority: document.querySelector("#setting-authority"),
  avatar: document.querySelector("#setting-avatar"),
  colorSwatches: document.querySelector("#color-swatches")
};

const modeContent = {
  development: {
    title: "개발 모드",
    council: "개발 에이전트 회의",
    core: "개발 모드",
    meeting: "패치 제안 검토 중"
  },
  "bug-bounty": {
    title: "버그바운티 모드",
    council: "보안 에이전트 회의",
    core: "버그바운티 모드",
    meeting: "허가 범위 검토 중"
  }
};

const colorPalette = ["#d9a441", "#62c9a2", "#5f9ce6", "#a78bfa", "#78e6b0", "#ff8a78", "#db6b73"];

const agents = [
  {
    id: "pm",
    name: "PMAgent",
    role: "제품 관리자",
    status: "범위 승인 중",
    focus: "사용자 목표를 MVP 단위로 줄이고 다음 결정을 잠급니다.",
    state: "coordinating",
    size: 62,
    x: "50%",
    y: "16%",
    defaults: {
      autospeak: true,
      participation: 80,
      tone: "balanced",
      authority: "approve",
      avatar: "circle",
      color: "#d9a441"
    }
  },
  {
    id: "designer-a",
    name: "UIDesignerA",
    role: "공간 UI 디자이너",
    status: "작업판 구조 조정",
    focus: "에이전트가 일하는 흐름을 한눈에 보이게 만듭니다.",
    state: "designing",
    size: 54,
    x: "24%",
    y: "34%",
    defaults: {
      autospeak: true,
      participation: 65,
      tone: "friendly",
      authority: "advise",
      avatar: "square",
      color: "#62c9a2"
    }
  },
  {
    id: "designer-b",
    name: "UIDesignerB",
    role: "대화 UX 디자이너",
    status: "대화 위치 설계",
    focus: "사용자가 어디에 말하고, 회의는 어디서 보는지 분명하게 보여줍니다.",
    state: "designing",
    size: 52,
    x: "76%",
    y: "34%",
    defaults: {
      autospeak: true,
      participation: 70,
      tone: "friendly",
      authority: "review",
      avatar: "capsule",
      color: "#5f9ce6"
    }
  },
  {
    id: "designer-c",
    name: "UIDesignerC",
    role: "비주얼 시스템 디자이너",
    status: "에이전트 외형 정리",
    focus: "색만이 아니라 형태와 이름표로 에이전트를 구분합니다.",
    state: "designing",
    size: 50,
    x: "36%",
    y: "72%",
    defaults: {
      autospeak: false,
      participation: 55,
      tone: "balanced",
      authority: "advise",
      avatar: "diamond",
      color: "#a78bfa"
    }
  },
  {
    id: "developer",
    name: "DeveloperAgent",
    role: "구현 담당",
    status: "패치 제안 준비",
    focus: "작고 검증 가능한 개발 단계를 패치 미리보기로 정리합니다.",
    state: "coordinating",
    size: 56,
    x: "66%",
    y: "68%",
    defaults: {
      autospeak: true,
      participation: 75,
      tone: "balanced",
      authority: "review",
      avatar: "hex",
      color: "#78e6b0"
    }
  },
  {
    id: "moochacker",
    name: "MoochackerAgent",
    role: "모의해킹 안전 리뷰어",
    status: "허가 범위 확인",
    focus: "버그바운티 흐름이 허가된 범위와 수동 기록 안에 머물도록 봅니다.",
    state: "guarding",
    size: 56,
    x: "20%",
    y: "58%",
    defaults: {
      autospeak: true,
      participation: 85,
      tone: "security",
      authority: "block",
      avatar: "hex",
      color: "#ff8a78"
    }
  },
  {
    id: "reviewer",
    name: "ReviewerAgent",
    role: "품질 리뷰어",
    status: "수용 기준 검토",
    focus: "설정, 채팅, 회의 표시, 안전 문구, 반응형 레이아웃을 검토합니다.",
    state: "reviewing",
    size: 50,
    x: "82%",
    y: "58%",
    defaults: {
      autospeak: true,
      participation: 70,
      tone: "strict",
      authority: "review",
      avatar: "diamond",
      color: "#db6b73"
    }
  }
];

const agentSettings = Object.fromEntries(
  agents.map((agent) => [
    agent.id,
    {
      displayName: agent.name,
      role: agent.role,
      ...agent.defaults
    }
  ])
);

const conversations = [
  {
    mode: "all",
    agentId: "pm",
    kind: "PM 결정",
    title: "대화 주체 고정",
    body:
      "사용자는 Dure에게 말합니다. Dure가 선택된 에이전트에게 전달하고, 회의 결과를 다시 사용자에게 정리합니다."
  },
  {
    mode: "all",
    agentId: "designer-b",
    kind: "UX 제안",
    title: "채팅과 회의 분리",
    body:
      "가운데는 Dure와의 채팅, 오른쪽은 에이전트 회의록으로 고정해 사용자가 길을 잃지 않게 합니다."
  },
  {
    mode: "all",
    agentId: "designer-c",
    kind: "비주얼 기준",
    title: "에이전트 외형 설정",
    body:
      "각 에이전트는 이름, 역할, 색, 형태를 바꿀 수 있습니다. 도트는 더 정돈된 배지 형태로 표시합니다."
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
      "이 화면의 채팅과 설정은 로컬 미리보기 상태입니다. 실행, 승인, 적용, 스캔, 외부 요청은 수행하지 않습니다."
  }
];

let selectedAgentId = "pm";
let currentMode = "development";
let snapshotConversationEntries = [];
let localChatEntries = [];
let localCouncilEntries = [];

function agentById(id) {
  return agents.find((agent) => agent.id === id) ?? agents[0];
}

function agentView(id) {
  const agent = agentById(id);
  const settings = agentSettings[agent.id];
  return {
    ...agent,
    displayName: settings.displayName,
    role: settings.role,
    color: settings.color,
    avatar: settings.avatar,
    settings
  };
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

function initials(name) {
  const compact = name.replace(/\s+/g, "");
  const upper = compact.match(/[A-Z]/g)?.join("") ?? compact;
  return (upper || "D").slice(0, 2).toUpperCase();
}

function avatarClass(avatar) {
  return `avatar-${avatar}`;
}

function renderColorSwatches() {
  const view = agentView(selectedAgentId);
  settingFields.colorSwatches.replaceChildren(
    ...colorPalette.map((color) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "color-swatch";
      button.classList.toggle("selected", color === view.color);
      button.dataset.color = color;
      button.style.setProperty("--swatch-color", color);
      button.setAttribute("aria-label", `${color} 색상 선택`);
      return button;
    })
  );
}

function renderAgents() {
  agentList.replaceChildren(
    ...agents.map((agent) => {
      const view = agentView(agent.id);
      const button = document.createElement("button");
      const glyph = document.createElement("span");
      const glyphText = document.createElement("span");
      const textWrap = document.createElement("span");
      const name = document.createElement("strong");
      const role = document.createElement("span");
      const meta = document.createElement("small");

      button.type = "button";
      button.className = "agent-row";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(agent.id === selectedAgentId));
      button.dataset.agentId = agent.id;
      button.style.setProperty("--agent-color", view.color);
      glyph.className = `agent-glyph ${avatarClass(view.avatar)}`;
      glyph.setAttribute("aria-hidden", "true");
      glyphText.textContent = initials(view.displayName);
      glyph.append(glyphText);
      name.textContent = view.displayName;
      role.textContent = view.role;
      meta.textContent = `${view.settings.participation}% · ${authorityLabel(view.settings.authority)}`;
      textWrap.append(name, role, meta);
      button.append(glyph, textWrap);
      return button;
    })
  );

  agentNodes.replaceChildren(
    ...agents.map((agent) => {
      const view = agentView(agent.id);
      const button = document.createElement("button");
      const label = document.createElement("span");
      button.type = "button";
      button.className = `agent-node ${avatarClass(view.avatar)} state-${agent.state}`;
      button.classList.toggle("selected", agent.id === selectedAgentId);
      button.dataset.agentId = agent.id;
      button.dataset.label = view.displayName;
      button.style.setProperty("--agent-color", view.color);
      button.style.setProperty("--size", `${agent.size}px`);
      button.style.setProperty("--x", agent.x);
      button.style.setProperty("--y", agent.y);
      button.setAttribute("aria-label", `${view.displayName} 선택, ${view.role}`);
      label.textContent = initials(view.displayName);
      button.append(label);
      return button;
    })
  );
}

function renderSettings() {
  const view = agentView(selectedAgentId);
  const settings = view.settings;
  settingFields.mark.className = `agent-glyph ${avatarClass(view.avatar)}`;
  settingFields.mark.style.setProperty("--agent-color", view.color);
  settingFields.mark.replaceChildren(document.createTextNode(initials(view.displayName)));
  setText(settingFields.name, view.displayName);
  setText(settingFields.role, view.role);
  settingFields.displayName.value = view.displayName;
  settingFields.editableRole.value = view.role;
  settingFields.autospeak.checked = settings.autospeak;
  settingFields.participation.value = String(settings.participation);
  setText(settingFields.participationValue, `${settings.participation}%`);
  settingFields.tone.value = settings.tone;
  settingFields.authority.value = settings.authority;
  settingFields.avatar.value = settings.avatar;
  renderColorSwatches();
}

function renderInspector() {
  const view = agentView(selectedAgentId);
  const settings = view.settings;
  setText(details.name, view.displayName);
  setText(details.role, view.role);
  setText(details.status, view.status);
  setText(
    details.focus,
    `${view.focus} 설정: ${settings.autospeak ? "자동 발언 켜짐" : "자동 발언 꺼짐"}, ${settings.participation}% 참여, ${toneLabel(settings.tone)} 톤, ${authorityLabel(settings.authority)} 권한.`
  );
  setText(conversationTarget, "채팅 위치: Dure에게 말하기");
  setText(talkRoute, `나 → Dure → ${view.displayName}`);
  setText(meetingStatus, `${view.displayName} ${authorityLabel(settings.authority)} 중`);
  setText(meetingRoute, `Dure가 ${view.displayName}에게 ${authorityLabel(settings.authority)} 관점으로 전달`);
}

function renderDialogue() {
  const view = agentView(selectedAgentId);
  const settings = view.settings;
  const seedRows = [
    {
      speaker: "나",
      route: "나 → Dure",
      body: "가운데 입력창에 말하면 Dure가 먼저 의도를 정리합니다."
    },
    {
      speaker: "Dure",
      route: `Dure → ${view.displayName}`,
      body: `${view.displayName}에게 ${authorityLabel(settings.authority)} 관점으로 검토를 요청합니다.`
    },
    {
      speaker: view.displayName,
      route: `${view.role} → Dure`,
      body: `${toneLabel(settings.tone)} 톤으로 응답하고, 참여도 ${settings.participation}%로 회의에 반영됩니다.`
    }
  ];
  const visibleRows = [...seedRows, ...localChatEntries.slice(-6)];

  dialogueList.replaceChildren(
    ...visibleRows.map((row) => {
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
  const visible = [...localCouncilEntries, ...snapshotConversationEntries, ...conversations].filter(
    (entry) =>
      (entry.mode === "all" || entry.mode === currentMode) &&
      (entry.agentId === selectedAgentId || entry.agentId === "pm")
  );

  conversationList.replaceChildren(
    ...visible.map((entry) => {
      const view = agentView(entry.agentId);
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
      speakerName.textContent = view.displayName;
      speakerRole.textContent = view.role;
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

function renderAll() {
  renderAgents();
  renderSettings();
  renderInspector();
  renderDialogue();
  renderConversation();
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
  setText(modeTitle, "Dure 조율자");
  setText(stageTitle, content.title);
  setText(coreMode, content.core);
  setText(conversationTitle, content.council);
  setText(meetingStatus, content.meeting);
  renderAll();
}

function selectAgent(agentId) {
  selectedAgentId = agentId;
  renderAll();
}

function updateSelectedSettings() {
  const settings = agentSettings[selectedAgentId];
  const fallback = agentById(selectedAgentId);
  settings.displayName = settingFields.displayName.value.trim() || fallback.name;
  settings.role = settingFields.editableRole.value.trim() || fallback.role;
  settings.autospeak = settingFields.autospeak.checked;
  settings.participation = Number(settingFields.participation.value);
  settings.tone = settingFields.tone.value;
  settings.authority = settingFields.authority.value;
  settings.avatar = settingFields.avatar.value;
  renderAll();
}

function handleChatSubmit(event) {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) {
    return;
  }

  const view = agentView(selectedAgentId);
  const settings = view.settings;
  localChatEntries = [
    ...localChatEntries,
    { speaker: "나", route: "나 → Dure", body: text },
    {
      speaker: "Dure",
      route: `Dure → ${view.displayName}`,
      body: `요청을 ${view.displayName}에게 전달했습니다. ${authorityLabel(settings.authority)} 기준으로 회의에 올립니다.`
    },
    {
      speaker: view.displayName,
      route: `${view.role} → Dure`,
      body: `${toneLabel(settings.tone)} 톤으로 답변합니다. 현재 설정은 ${settings.participation}% 참여, ${settings.autospeak ? "자동 발언 켜짐" : "자동 발언 꺼짐"}입니다.`
    }
  ];
  localCouncilEntries = [
    {
      mode: currentMode,
      agentId: selectedAgentId,
      kind: "사용자 요청 검토",
      title: "방금 입력한 메시지",
      body: `${view.displayName}이 Dure로부터 전달받은 요청을 검토 중입니다: ${text}`
    },
    ...localCouncilEntries
  ].slice(0, 8);
  chatInput.value = "";
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
    return;
  }

  const colorButton = event.target.closest("[data-color]");
  if (colorButton) {
    agentSettings[selectedAgentId].color = colorButton.dataset.color;
    renderAll();
  }
});

document.addEventListener("change", (event) => {
  if (!Object.values(settingFields).includes(event.target)) {
    return;
  }
  updateSelectedSettings();
});

document.addEventListener("input", (event) => {
  if (![settingFields.displayName, settingFields.editableRole, settingFields.participation].includes(event.target)) {
    return;
  }

  const settings = agentSettings[selectedAgentId];
  const fallback = agentById(selectedAgentId);
  settings.displayName = settingFields.displayName.value.trim() || fallback.name;
  settings.role = settingFields.editableRole.value.trim() || fallback.role;
  settings.participation = Number(settingFields.participation.value);
  setText(settingFields.participationValue, `${settings.participation}%`);
  renderAgents();
  renderInspector();
  renderDialogue();
  renderConversation();
}
);

chatForm.addEventListener("submit", handleChatSubmit);

snapshotFile.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) {
    void importSnapshotFile(file);
  }
});

renderAll();
