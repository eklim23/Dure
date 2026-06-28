const app = document.querySelector("#app");
const agentList = document.querySelector("#agent-list");
const agentNodes = document.querySelector("#agent-nodes");
const conversationList = document.querySelector("#conversation-list");
const modeTitle = document.querySelector("#mode-title");
const stageTitle = document.querySelector("#stage-title");
const coreMode = document.querySelector("#core-mode");
const conversationTitle = document.querySelector("#conversation-title");
const snapshotFile = document.querySelector("#snapshot-file");
const snapshotFields = {
  run: document.querySelector("#snapshot-run"),
  status: document.querySelector("#snapshot-status"),
  proposal: document.querySelector("#snapshot-proposal"),
  decisions: document.querySelector("#snapshot-decisions"),
  project: document.querySelector("#snapshot-project"),
  scripts: document.querySelector("#snapshot-scripts")
};

const details = {
  name: document.querySelector("#agent-name"),
  role: document.querySelector("#agent-role"),
  status: document.querySelector("#agent-status"),
  focus: document.querySelector("#agent-focus"),
  assignment: document.querySelector("#agent-assignment"),
  stance: document.querySelector("#agent-stance"),
  needs: document.querySelector("#agent-needs"),
  risks: document.querySelector("#agent-risks")
};

const modeContent = {
  development: {
    title: "Development Mode",
    stage: "Stage 16 UI Prototype",
    conversation: "PM approval and UI council notes",
    core: "Development Mode"
  },
  "bug-bounty": {
    title: "Bug Bounty / Security Mode",
    stage: "Scope-safe UI Preview",
    conversation: "Security-mode council notes",
    core: "Bug Bounty Mode"
  }
};

const agents = [
  {
    id: "pm",
    name: "PMAgent",
    role: "Product manager",
    status: "Approving prototype scope",
    focus: "Keep the UI static, safe, and useful.",
    shape: "circle",
    state: "coordinating",
    color: "#d9a441",
    size: 64,
    x: "50%",
    y: "18%",
    assignment:
      "Lock the acceptance criteria: visible agents, readable discussion, green development mode, red security mode, and no production-like actions.",
    stance:
      "The first UI should make Dure's coordination model obvious without pretending it is a live operations console.",
    needs: [
      "Clear static/read-only labeling",
      "Clickable agents with useful details",
      "No claims of live scanning, applying, or execution"
    ],
    risks: [
      "Users may confuse a mock transcript with live agent execution",
      "Security visuals must not imply unauthorized testing capability"
    ]
  },
  {
    id: "designer-a",
    name: "UIDesignerA",
    role: "Spatial systems designer",
    status: "Mapping agent activity",
    focus: "Make coordination visible at a glance.",
    shape: "square",
    state: "designing",
    color: "#62c9a2",
    size: 56,
    x: "24%",
    y: "34%",
    assignment:
      "Create the operational field: Dure in the center, agent dots around it, and motion that reads as work rather than decoration.",
    stance:
      "Dure should feel like a calm command room: compact, alive, and anchored in the user's current mode.",
    needs: [
      "A central coordination core",
      "Mode lighting that changes the whole environment",
      "Motion that remains readable with reduced-motion support"
    ],
    risks: [
      "Too much animation can hide the information hierarchy",
      "A visual-only state system would be inaccessible"
    ]
  },
  {
    id: "designer-b",
    name: "UIDesignerB",
    role: "Conversation experience designer",
    status: "Curating discussion flow",
    focus: "Show what agents are thinking without faking autonomy.",
    shape: "capsule",
    state: "designing",
    color: "#5f9ce6",
    size: 54,
    x: "76%",
    y: "34%",
    assignment:
      "Turn the internal council into a readable, selected-agent transcript with speaker identity, type, and rationale.",
    stance:
      "The UI should show curated discussion notes, not pretend that hidden agents are continuously chatting in real time.",
    needs: [
      "A transcript area tied to the selected agent",
      "Speaker labels and decision types",
      "Explicit simulated transcript copy"
    ],
    risks: [
      "A fake live chat could reduce trust",
      "Long text blocks can make the console feel slow"
    ]
  },
  {
    id: "designer-c",
    name: "UIDesignerC",
    role: "Visual systems designer",
    status: "Defining shapes and contrast",
    focus: "Different dots must look different even without color.",
    shape: "diamond",
    state: "designing",
    color: "#a78bfa",
    size: 52,
    x: "35%",
    y: "70%",
    assignment:
      "Give every agent a distinct silhouette, readable label, and color while preserving contrast across green and red modes.",
    stance:
      "Dure can look special through motion, spacing, and identity rules instead of decorative clutter.",
    needs: [
      "Shape-coded agent roles",
      "Readable labels on desktop and mobile",
      "Mode color as environment, not the only state"
    ],
    risks: [
      "Color-only state would fail accessibility expectations",
      "Tiny labels can clip on mobile"
    ]
  },
  {
    id: "developer",
    name: "DeveloperAgent",
    role: "Implementation owner",
    status: "Building static prototype",
    focus: "Ship a no-dependency UI that can be opened directly.",
    shape: "hex",
    state: "coordinating",
    color: "#78e6b0",
    size: 58,
    x: "66%",
    y: "66%",
    assignment:
      "Implement HTML, CSS, and JavaScript with no backend, no package dependencies, and tests that guard against accidental network behavior.",
    stance:
      "A static prototype is the right first step because it proves the product language without expanding runtime risk.",
    needs: [
      "Simple files under apps/ui",
      "Tests for required UI anchors and no network calls",
      "Documentation that says this is not production"
    ],
    risks: [
      "Adding a framework too early would increase maintenance load",
      "Prototype code should not touch run records yet"
    ]
  },
  {
    id: "moochacker",
    name: "MoochackerAgent",
    role: "Bug bounty safety reviewer",
    status: "Checking security-mode boundaries",
    focus: "Keep red mode scope-safe and passive.",
    shape: "triangle",
    state: "guarding",
    color: "#ff8a78",
    size: 58,
    x: "20%",
    y: "58%",
    assignment:
      "Make sure Bug Bounty Mode communicates scope, authorization, evidence, and stop conditions without implying live testing.",
    stance:
      "Red mode should feel serious and defensive: it is for authorized planning, not target interaction in this prototype.",
    needs: [
      "Visible read-only status",
      "No scan, attack, exploit, or target-access controls",
      "Clear scope-safe security language"
    ],
    risks: [
      "Aggressive wording could imply unauthorized offensive activity",
      "A red theme must still feel controlled, not alarmist"
    ]
  },
  {
    id: "reviewer",
    name: "ReviewerAgent",
    role: "Quality reviewer",
    status: "Reviewing acceptance criteria",
    focus: "Check usability, safety, and maintainability.",
    shape: "diamond",
    state: "reviewing",
    color: "#db6b73",
    size: 50,
    x: "82%",
    y: "58%",
    assignment:
      "Review the UI against PM criteria: no destructive actions, no clipped text, mode clarity, and agent detail discoverability.",
    stance:
      "The prototype is acceptable only if it is clearly safe, responsive, and honest about what is simulated.",
    needs: [
      "Smoke tests for static safety",
      "Responsive layout checks in CSS",
      "Obvious selected-agent states"
    ],
    risks: [
      "Mode buttons must not look like they trigger real workflows",
      "Long agent names need stable layout constraints"
    ]
  }
];

const conversations = [
  {
    mode: "all",
    agentId: "pm",
    kind: "PM Decision",
    title: "Scope approved",
    body:
      "Approved as a Stage 16 static prototype. It may visualize agents, mode lighting, and curated discussion, but it must not execute, persist, scan, approve, apply, or call a backend."
  },
  {
    mode: "all",
    agentId: "designer-a",
    kind: "Design Proposal",
    title: "Operational field",
    body:
      "Place Dure at the center and let each agent move around it with a different silhouette. Motion should read as coordination, not as decoration."
  },
  {
    mode: "all",
    agentId: "designer-b",
    kind: "UX Proposal",
    title: "Readable council notes",
    body:
      "When an agent is selected, show a curated transcript and inspector details. Label the transcript as simulated so the user understands it is a preview."
  },
  {
    mode: "all",
    agentId: "designer-c",
    kind: "Visual System",
    title: "Shape-coded agents",
    body:
      "Use circles, capsules, diamonds, squares, triangles, and hexagons so agent identity does not depend on color alone."
  },
  {
    mode: "development",
    agentId: "developer",
    kind: "Build Note",
    title: "Green development state",
    body:
      "Development Mode uses green operational lighting and focuses the console on planning, patch preview, review, and verification boundaries."
  },
  {
    mode: "bug-bounty",
    agentId: "moochacker",
    kind: "Safety Note",
    title: "Red security state",
    body:
      "Bug Bounty Mode uses red security lighting but remains passive. The prototype shows authorization, scope, and evidence concerns without target interaction."
  },
  {
    mode: "all",
    agentId: "reviewer",
    kind: "Review Note",
    title: "Honest controls",
    body:
      "Buttons in this prototype only change local display state. They are not connected to real run records, external tools, scans, or patch application."
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

function renderListItems(container, items) {
  container.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    })
  );
}

function renderAgents() {
  agentList.replaceChildren(
    ...agents.map((agent) => {
      const button = document.createElement("button");
      const glyph = document.createElement("span");
      const textWrap = document.createElement("span");
      const name = document.createElement("strong");
      const role = document.createElement("span");

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
      textWrap.append(name, role);
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
      button.setAttribute("aria-label", `Select ${agent.name}, ${agent.role}`);
      const label = document.createElement("span");
      label.textContent = agent.name.slice(0, 2);
      button.append(label);
      return button;
    })
  );
}

function renderInspector() {
  const agent = agentById(selectedAgentId);
  setText(details.name, agent.name);
  setText(details.role, agent.role);
  setText(details.status, agent.status);
  setText(details.focus, agent.focus);
  setText(details.assignment, agent.assignment);
  setText(details.stance, agent.stance);
  renderListItems(details.needs, agent.needs);
  renderListItems(details.risks, agent.risks);
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
      article.className = "conversation-entry";
      const speaker = document.createElement("div");
      const speakerName = document.createElement("strong");
      const speakerRole = document.createElement("span");
      const body = document.createElement("div");
      const kind = document.createElement("span");
      const title = document.createElement("h3");
      const text = document.createElement("p");

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
  renderConversation();
}

function selectAgent(agentId) {
  selectedAgentId = agentId;
  renderAgents();
  renderInspector();
  renderConversation();
}

function applyConsoleSnapshot(snapshot) {
  const runMode = normalizeSnapshotMode(snapshot.run.selectedMode);
  snapshotConversationEntries = snapshot.decisions.slice(-6).reverse().map((entry) => ({
    mode: "all",
    agentId: decisionAgent(entry.type),
    kind: "Decision Log",
    title: entry.type.replace(/_/g, " "),
    body: `${entry.timestamp}: ${entry.message}`
  }));

  setText(snapshotFields.run, snapshot.run.id);
  setText(snapshotFields.status, snapshot.run.status);
  setText(snapshotFields.proposal, `${snapshot.run.proposalKind} / ${snapshot.proposal.riskLevel}`);
  setText(snapshotFields.decisions, String(snapshot.decisions.length));
  setText(snapshotFields.project, summarizeSnapshotProject(snapshot));
  setText(snapshotFields.scripts, summarizeSnapshotScripts(snapshot));
  updateMode(runMode);
  selectAgent(snapshot.run.selectedMode === "bug_bounty" ? "moochacker" : "pm");
}

function summarizeSnapshotProject(snapshot) {
  if (!snapshot.projectState) {
    return "not recorded";
  }
  return `${snapshot.projectState.packageManager} / stage ${snapshot.projectState.currentMvpStage.id}`;
}

function summarizeSnapshotScripts(snapshot) {
  if (!snapshot.projectState) {
    return "not recorded";
  }
  return snapshot.projectState.configuredScripts.length > 0
    ? snapshot.projectState.configuredScripts.join(", ")
    : "none";
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
      throw new Error("Unsupported Dure console data file.");
    }
    applyConsoleSnapshot(snapshot);
  } catch (error) {
    setText(snapshotFields.status, error instanceof Error ? error.message : "Unable to import snapshot.");
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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    selectAgent("pm");
  }
});

snapshotFile.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) {
    void importSnapshotFile(file);
  }
});

renderAgents();
renderInspector();
renderConversation();
