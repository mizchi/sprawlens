const elements = {
  workspace: byId("workspace"),
  completedPanel: byId("completed-panel"),
  passBadge: byId("pass-badge"),
  progressLabel: byId("progress-label"),
  classificationLabel: byId("classification-label"),
  progressBar: byId("progress-bar"),
  completeButton: byId("complete-button"),
  previousButton: byId("previous-button"),
  nextButton: byId("next-button"),
  caseSelect: byId("case-select"),
  saveStatus: byId("save-status"),
  packetAlias: byId("packet-alias"),
  packet: byId("packet"),
  decisionList: byId("decision-list"),
  caseState: byId("case-state"),
  notes: byId("notes"),
  saveButton: byId("save-button"),
  reviewButton: byId("review-button"),
  startDialog: byId("start-dialog"),
  startForm: byId("start-form"),
  annotatorId: byId("annotator-id"),
  predictionsAttestation: byId("predictions-attestation"),
  otherPassAttestation: byId("other-pass-attestation"),
  startError: byId("start-error"),
  toast: byId("toast"),
};

let session;
let currentIndex = 0;
let selectedSymbolIndex = 0;
let dirty = false;
let saving = false;
let packetRequest = 0;
let candidateLineHints = [];
let toastTimer;

await boot();

async function boot() {
  bindEvents();
  try {
    session = await fetchJson("/api/session");
    renderSession();
    if (!session.sheet.annotation.startedOn) {
      elements.startDialog.showModal();
      elements.annotatorId.focus();
    }
  } catch (error) {
    showToast(messageOf(error));
    setSaveStatus("Load failed", "dirty");
  }
}

function bindEvents() {
  elements.startDialog.addEventListener("cancel", (event) => event.preventDefault());
  elements.startForm.addEventListener("submit", startSession);
  elements.previousButton.addEventListener("click", () => void goToCase(currentIndex - 1));
  elements.nextButton.addEventListener("click", () => void goToCase(currentIndex + 1));
  elements.caseSelect.addEventListener("change", () => {
    const index = session.sheet.cases.findIndex((item) => item.alias === elements.caseSelect.value);
    void goToCase(index);
  });
  elements.notes.addEventListener("input", () => {
    const item = currentCase();
    item.notes = elements.notes.value;
    item.reviewed = false;
    markDirty();
    renderHeader();
    renderCaseState();
  });
  elements.saveButton.addEventListener("click", () => void saveCurrentCase(false));
  elements.reviewButton.addEventListener("click", () => void reviewAndContinue());
  elements.completeButton.addEventListener("click", () => void completePass());
  document.addEventListener("keydown", handleKeyboard);
  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
  });
}

async function startSession(event) {
  event.preventDefault();
  elements.startError.textContent = "";
  const submit = elements.startForm.querySelector("button[type='submit']");
  submit.disabled = true;
  try {
    session = await fetchJson("/api/start", {
      method: "POST",
      body: {
        revision: session.revision,
        annotatorId: elements.annotatorId.value,
        predictionsNotInspected: elements.predictionsAttestation.checked,
        otherPassNotInspected: elements.otherPassAttestation.checked,
      },
    });
    elements.startDialog.close();
    setSaveStatus("Started", "saved");
    renderSession();
  } catch (error) {
    elements.startError.textContent = messageOf(error);
  } finally {
    submit.disabled = false;
  }
}

function renderSession() {
  const completed = Boolean(session.sheet.annotation.completedOn);
  elements.passBadge.textContent = "Pass " + session.sheet.passId;
  elements.workspace.hidden = completed;
  elements.completedPanel.hidden = !completed;
  elements.completeButton.disabled = true;
  renderHeader();
  renderCaseSelect();
  if (completed) {
    setSaveStatus("Completed", "saved");
    return;
  }
  currentIndex = clamp(currentIndex, 0, session.sheet.cases.length - 1);
  renderCurrentCase();
}

function renderHeader() {
  const progress = localProgress();
  const percentage = progress.cases === 0 ? 0 : (progress.reviewedCases / progress.cases) * 100;
  elements.progressLabel.textContent =
    progress.reviewedCases + " / " + progress.cases + " cases reviewed";
  elements.classificationLabel.textContent =
    progress.classifiedSymbols + " / " + progress.symbols + " highlighted";
  elements.progressBar.style.width = percentage + "%";
  elements.completeButton.disabled =
    saving || dirty || progress.reviewedCases !== progress.cases || progress.complete;
}

function renderCaseSelect() {
  const selectedAlias = session.sheet.cases[currentIndex]?.alias;
  elements.caseSelect.replaceChildren(
    ...session.sheet.cases.map((item, index) => {
      const option = document.createElement("option");
      option.value = item.alias;
      option.textContent = (item.reviewed ? "✓ " : "○ ") + item.alias + " · " + (index + 1);
      option.selected = item.alias === selectedAlias;
      return option;
    }),
  );
}

function renderCurrentCase() {
  const item = currentCase();
  selectedSymbolIndex = clamp(selectedSymbolIndex, 0, Math.max(0, item.decisions.length - 1));
  elements.caseSelect.value = item.alias;
  elements.packetAlias.textContent = item.alias;
  elements.notes.value = item.notes;
  elements.previousButton.disabled = saving || currentIndex === 0;
  elements.nextButton.disabled = saving || currentIndex === session.sheet.cases.length - 1;
  renderCaseState();
  renderDecisionList();
  void loadPacket(item.alias);
}

function renderCaseState() {
  const reviewed = currentCase().reviewed;
  elements.caseState.textContent = reviewed ? "Reviewed" : "Needs review";
  elements.caseState.classList.toggle("reviewed", reviewed);
}

function renderDecisionList() {
  const item = currentCase();
  elements.decisionList.replaceChildren(
    ...item.decisions.map((entry, index) => {
      const row = document.createElement("div");
      row.className = "decision-row" + (index === selectedSymbolIndex ? " selected" : "");
      row.dataset.index = String(index);
      row.addEventListener("click", () => selectSymbol(index));

      const identity = document.createElement("div");
      const name = document.createElement("div");
      name.className = "symbol-name";
      name.textContent = symbolLabel(entry.symbol);
      name.title = name.textContent;
      const meta = document.createElement("div");
      meta.className = "symbol-meta";
      const occurrence =
        entry.symbol.occurrence === undefined ? "" : " · occurrence " + entry.symbol.occurrence;
      const lines = candidateLineHints[index] ? " · lines " + candidateLineHints[index] : "";
      meta.textContent = entry.symbol.kind + occurrence + lines;
      identity.append(name, meta);

      const options = document.createElement("div");
      options.className = "decision-options";
      options.setAttribute("role", "group");
      options.setAttribute("aria-label", "Decision for " + name.textContent);
      for (const [decision, label, key] of [
        ["none", "None", "N"],
        ["modified", "Modified", "M"],
        ["added", "Added", "A"],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "decision-option" + (entry.decision === decision ? " active" : "");
        button.dataset.decision = decision;
        button.textContent = label;
        button.title = key + " — mark " + label.toLowerCase();
        button.setAttribute("aria-pressed", String(entry.decision === decision));
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          setDecision(index, decision);
        });
        options.append(button);
      }
      row.append(identity, options);
      return row;
    }),
  );
}

async function loadPacket(alias) {
  const request = ++packetRequest;
  elements.packet.replaceChildren(lineElement("Loading packet…"));
  try {
    const response = await fetch("/api/packets/" + encodeURIComponent(alias));
    if (!response.ok) throw new Error(await responseError(response));
    const packet = await response.text();
    if (request !== packetRequest || currentCase().alias !== alias) return;
    candidateLineHints = parseCandidateLineHints(packet);
    renderPacket(packet);
    renderDecisionList();
  } catch (error) {
    if (request !== packetRequest) return;
    elements.packet.replaceChildren(lineElement("Packet error: " + messageOf(error), "deletion"));
  }
}

function renderPacket(packet) {
  const candidateMarker = "## After-revision symbol candidates";
  const evidence = packet.includes(candidateMarker)
    ? packet.slice(0, packet.indexOf(candidateMarker))
    : packet;
  const lines = evidence.trimEnd().split("\n");
  let inDiff = false;
  elements.packet.replaceChildren(
    ...lines.map((line) => {
      if (line === "```diff") inDiff = true;
      if (line === "```" && inDiff) inDiff = false;
      let className = "";
      if (!inDiff && line.startsWith("#")) className = "heading";
      else if (inDiff && line.startsWith("+")) className = "addition";
      else if (inDiff && line.startsWith("-")) className = "deletion";
      else if (inDiff && line.startsWith("@@")) className = "hunk";
      return lineElement(line, className);
    }),
  );
}

function parseCandidateLineHints(packet) {
  const marker = "## After-revision symbol candidates";
  if (!packet.includes(marker)) return [];
  return packet
    .slice(packet.indexOf(marker) + marker.length)
    .split("\n")
    .filter((line) => line.startsWith("- [ ]"))
    .map((line) => line.match(/\(lines ([^)]+)\)$/)?.[1] || "");
}

function setDecision(index, decision) {
  if (saving || session.sheet.annotation.completedOn) return;
  const item = currentCase();
  if (item.decisions[index].decision === decision) {
    selectSymbol(index);
    return;
  }
  item.decisions[index].decision = decision;
  item.reviewed = false;
  selectedSymbolIndex = index;
  markDirty();
  renderHeader();
  renderCaseState();
  renderDecisionList();
}

function selectSymbol(index) {
  selectedSymbolIndex = clamp(index, 0, currentCase().decisions.length - 1);
  renderDecisionList();
  document.querySelector(".decision-row.selected")?.scrollIntoView({ block: "nearest" });
}

async function saveCurrentCase(markReviewed) {
  if (saving) return false;
  const item = currentCase();
  saving = true;
  setSaveStatus("Saving…", "");
  setControlsDisabled(true);
  try {
    const updated = await fetchJson("/api/cases/" + encodeURIComponent(item.alias), {
      method: "PUT",
      body: {
        revision: session.revision,
        decisions: item.decisions.map(({ decision }) => decision),
        notes: item.notes,
        reviewed: markReviewed ? true : item.reviewed,
      },
    });
    const alias = item.alias;
    session = updated;
    currentIndex = session.sheet.cases.findIndex((candidate) => candidate.alias === alias);
    dirty = false;
    setSaveStatus(markReviewed ? "Reviewed" : "Saved", "saved");
    renderHeader();
    renderCaseSelect();
    renderCaseState();
    renderDecisionList();
    return true;
  } catch (error) {
    setSaveStatus("Save failed", "dirty");
    showToast(messageOf(error));
    return false;
  } finally {
    saving = false;
    setControlsDisabled(false);
    renderHeader();
  }
}

async function reviewAndContinue() {
  if (!(await saveCurrentCase(true))) return;
  const next = nextUnreviewedIndex(currentIndex);
  if (next !== -1) await goToCase(next);
}

async function goToCase(index) {
  if (saving || index < 0 || index >= session.sheet.cases.length || index === currentIndex) return;
  if (dirty && !(await saveCurrentCase(false))) return;
  currentIndex = index;
  selectedSymbolIndex = 0;
  candidateLineHints = [];
  renderCaseSelect();
  renderCurrentCase();
}

async function completePass() {
  if (saving) return;
  if (dirty && !(await saveCurrentCase(false))) return;
  const progress = localProgress();
  if (progress.reviewedCases !== progress.cases) {
    showToast("Every case must be reviewed before completion.");
    return;
  }
  if (!window.confirm("Complete this pass? The working sheet becomes read-only before locking.")) {
    return;
  }
  saving = true;
  setControlsDisabled(true);
  try {
    session = await fetchJson("/api/complete", {
      method: "POST",
      body: { revision: session.revision },
    });
    dirty = false;
    renderSession();
  } catch (error) {
    showToast(messageOf(error));
  } finally {
    saving = false;
    setControlsDisabled(false);
  }
}

function handleKeyboard(event) {
  if (!session || elements.startDialog.open) return;
  const commandSave = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
  if (commandSave) {
    event.preventDefault();
    void saveCurrentCase(false);
    return;
  }
  if (isTextInput(event.target)) return;
  if (event.shiftKey && event.key === "Enter") {
    event.preventDefault();
    void reviewAndContinue();
    return;
  }
  if (event.altKey && event.key === "ArrowLeft") {
    event.preventDefault();
    void goToCase(currentIndex - 1);
    return;
  }
  if (event.altKey && event.key === "ArrowRight") {
    event.preventDefault();
    void goToCase(currentIndex + 1);
    return;
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    selectSymbol(selectedSymbolIndex + (event.key === "ArrowUp" ? -1 : 1));
    return;
  }
  const decision = { n: "none", m: "modified", a: "added" }[event.key.toLowerCase()];
  if (decision) {
    event.preventDefault();
    setDecision(selectedSymbolIndex, decision);
  }
}

function localProgress() {
  const cases = session.sheet.cases;
  return {
    cases: cases.length,
    reviewedCases: cases.filter(({ reviewed }) => reviewed).length,
    symbols: cases.reduce((sum, item) => sum + item.decisions.length, 0),
    classifiedSymbols: cases.reduce(
      (sum, item) => sum + item.decisions.filter(({ decision }) => decision !== "none").length,
      0,
    ),
    complete: Boolean(session.sheet.annotation.completedOn),
  };
}

function nextUnreviewedIndex(fromIndex) {
  for (let offset = 1; offset <= session.sheet.cases.length; offset += 1) {
    const index = (fromIndex + offset) % session.sheet.cases.length;
    if (!session.sheet.cases[index].reviewed) return index;
  }
  return -1;
}

function currentCase() {
  return session.sheet.cases[currentIndex];
}

function symbolLabel(symbol) {
  const parent = symbol.parent ? symbol.parent.name + "." : "";
  return parent + symbol.name;
}

function markDirty() {
  dirty = true;
  setSaveStatus("Unsaved", "dirty");
  elements.completeButton.disabled = true;
}

function setControlsDisabled(disabled) {
  elements.saveButton.disabled = disabled;
  elements.reviewButton.disabled = disabled;
  elements.caseSelect.disabled = disabled;
  elements.notes.disabled = disabled;
  elements.previousButton.disabled = disabled || currentIndex === 0;
  elements.nextButton.disabled = disabled || currentIndex === session.sheet.cases.length - 1;
  for (const button of elements.decisionList.querySelectorAll("button")) button.disabled = disabled;
}

function setSaveStatus(label, className) {
  elements.saveStatus.textContent = label;
  elements.saveStatus.className = "save-status" + (className ? " " + className : "");
}

function lineElement(text, className = "") {
  const line = document.createElement("div");
  line.className = "packet-line" + (className ? " " + className : "");
  line.textContent = text || " ";
  return line;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json();
}

async function responseError(response) {
  try {
    const body = await response.json();
    return body.error || "Request failed with status " + response.status;
  } catch {
    return "Request failed with status " + response.status;
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 6000);
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function isTextInput(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error("Missing UI element: " + id);
  return element;
}
