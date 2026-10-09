const socket = io();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

let eventState = {
  eventName: "Traders Olympics",
  gameNames: [],
  gameOpen: [false, false],
  gameStarts: [null, null],
  teams: [],
};
let leaderboardView = "overall";
let currentMode = localStorage.getItem("traders-mode") || "player";
let toastTimer;

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function totalScore(team) {
  return team.scores.reduce((sum, score) => sum + Number(score || 0), 0);
}

function twoSumElapsed(team) {
  if (team?.twoSum?.solved && team.twoSum.elapsedSeconds !== null) return team.twoSum.elapsedSeconds;
  const startedAt = Number(eventState.gameStarts?.[1]);
  return startedAt ? Math.max(0, (Date.now() - startedAt) / 1000) : null;
}

function selectedTeam(select) {
  return eventState.teams.find((team) => team.id === select.value);
}

function teamLabel(team) {
  const members = (team.members || []).map(escapeHtml).join(" · ");
  return `<span class="team-label"><span>${escapeHtml(team.name)}</span>${members ? `<small>${members}</small>` : ""}</span>`;
}

function setSelectTeams(select, placeholder) {
  const previous = select.value;
  select.innerHTML =
    `<option value="">${placeholder}</option>` +
    eventState.teams
      .map((team) => `<option value="${team.id}">${escapeHtml(team.name)}</option>`)
      .join("");
  if (eventState.teams.some((team) => team.id === previous)) select.value = previous;
}

function renderLeaderboard() {
  $("#team-count").textContent = eventState.teams.length;
  $("#leaderboard-empty").classList.toggle("hidden", eventState.teams.length > 0);
  $("#leaderboard-tabs").innerHTML = ["Overall", ...eventState.gameNames]
    .map((name, index) => {
      const value = index === 0 ? "overall" : String(index - 1);
      return `<button class="leaderboard-tab ${leaderboardView === value ? "active" : ""}" data-board="${value}" role="tab">${escapeHtml(name)}</button>`;
    })
    .join("");

  const showOverall = leaderboardView === "overall";
  $("#leaderboard-table-wrap").classList.toggle("hidden", eventState.teams.length === 0 || !showOverall);
  $("#game-leaderboard").classList.toggle("hidden", eventState.teams.length === 0 || showOverall);

  const gameNames = eventState.gameNames;
  $("#leaderboard-head").innerHTML = `<tr>
    <th>Rank</th>
    <th>Team</th>
    ${gameNames.map((name) => `<th>${escapeHtml(name)}</th>`).join("")}
    <th>Total</th>
  </tr>`;

  const sorted = [...eventState.teams].sort(
    (a, b) => totalScore(b) - totalScore(a) || b.scores[0] - a.scores[0] || a.name.localeCompare(b.name),
  );
  $("#leaderboard-body").innerHTML = sorted
    .map(
      (team, index) => `<tr>
        <td class="rank">${String(index + 1).padStart(2, "0")}</td>
        <td class="team-cell"><i class="team-swatch" style="background:${team.color}"></i>${teamLabel(team)}</td>
        ${team.scores.map((score) => `<td class="game-score">${score}</td>`).join("")}
        <td class="total-score">${totalScore(team)}</td>
      </tr>`,
    )
    .join("");

  if (!showOverall) {
    const gameIndex = Number(leaderboardView);
    const gameTeams = [...eventState.teams].sort(
      (a, b) =>
        b.scores[gameIndex] - a.scores[gameIndex] ||
        (gameIndex === 1 ? (b.twoSum?.linesWritten || 0) - (a.twoSum?.linesWritten || 0) : 0) ||
        a.name.localeCompare(b.name),
    );
    const maxValue = Math.max(
      1,
      ...gameTeams.map((team) =>
        gameIndex === 1 ? Number(team.twoSum?.linesWritten || 0) : Number(team.scores[gameIndex] || 0),
      ),
    );
    $("#game-leaderboard").innerHTML = `
      <div class="game-board-header">
        <div>
          <p class="eyebrow">EVENT ${String(gameIndex + 1).padStart(2, "0")}</p>
          <h3>${escapeHtml(gameNames[gameIndex])}</h3>
        </div>
        <span>${gameIndex === 0 ? "● LIVE SCORING" : "EVENT STANDINGS"}</span>
      </div>
      <div class="bar-board">
        ${gameTeams
          .map((team, index) => {
            const score = Number(team.scores[gameIndex] || 0);
            const progressValue = gameIndex === 1 ? Number(team.twoSum?.linesWritten || 0) : score;
            const width = progressValue === 0 ? 0 : Math.max(3, (progressValue / maxValue) * 100);
            const elapsed = twoSumElapsed(team);
            return `<div class="bar-row ${gameIndex === 1 ? "twosum-row" : ""} ${gameIndex === 1 && team.twoSum?.solved ? "solved" : ""}">
              <span class="bar-rank">${String(index + 1).padStart(2, "0")}</span>
              <span class="bar-team"><i class="team-swatch" style="background:${team.color}"></i>${teamLabel(team)}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${team.color}"></div></div>
              <strong class="bar-score">${score}</strong>
              ${
                gameIndex === 1
                  ? `<div class="relay-metrics">
                      <span>TIME <strong>${elapsed === null ? "--:--" : formatTime(elapsed)}</strong></span>
                      <span>LINES <strong>${team.twoSum?.linesWritten || 0}</strong></span>
                      <span>SUBMISSIONS <strong>${team.twoSum?.submissions || 0}</strong></span>
                      <span>STATUS <strong>${team.twoSum?.solved ? "SOLVED" : "WORKING"}</strong></span>
                    </div>`
                  : ""
              }
            </div>`;
          })
          .join("")}
      </div>`;
  }
}

function renderGameAccess() {
  const openStates = Array.isArray(eventState.gameOpen) ? eventState.gameOpen : [false, false];
  [
    { key: "zeta", index: 0, startLabel: "Start ZetaMac" },
    { key: "twosum", index: 1, startLabel: "Start 2 Sum" },
  ].forEach(({ key, index, startLabel }) => {
    const open = Boolean(openStates[index]);
    $(`#${key}-access-dot`).classList.toggle("open", open);
    $(`#${key}-access-state`).textContent = open ? "Event open" : "Waiting to start";
    $(`#${key}-access-copy`).textContent = open
      ? `Official timer started at ${new Date(eventState.gameStarts[index]).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
      : "Choose your team now. A developer starts every timer together.";
    $(`#${key}-locked`).classList.toggle("hidden", open);
    if (key === "zeta") $("#zeta-stage").classList.toggle("hidden", !open);
    if (key === "twosum") $("#twosum-content").classList.toggle("hidden", !open);

    const button = $(`[data-game-toggle="${index}"]`);
    button.textContent = open ? "Game started" : startLabel;
    button.disabled = open;
    button.classList.toggle("hidden", currentMode !== "developer");
  });
}

function renderSetup() {
  $("#event-name-input").value = eventState.eventName;
  $("#team-list").innerHTML =
    eventState.teams
      .map(
        (team) => `<div class="team-row">
          <i style="background:${team.color}"></i>
          ${teamLabel(team)}
          <div class="team-row-actions">
            <button class="edit-members" data-edit-members="${team.id}">Edit people</button>
            <button data-remove-team="${team.id}">Remove</button>
          </div>
        </div>`,
      )
      .join("") || '<div class="test-placeholder">No teams have been added.</div>';
}

function renderState() {
  $("#brand-name").textContent = eventState.eventName;
  document.title = eventState.eventName;
  renderLeaderboard();
  renderSetup();
  renderGameAccess();
  setSelectTeams($("#zeta-team"), "Select a team");
  setSelectTeams($("#twosum-team"), "Select a team");
  startZetaFromOfficialClock();

  if (zeta.phase === "playing" || zeta.phase === "handoff") {
    const team = eventState.teams.find((item) => item.id === zeta.teamId);
    if (team) $("#zeta-score").textContent = team.scores[0];
  }
}

socket.on("state", (state) => {
  const previousTwoSumStart = eventState.gameStarts?.[1];
  eventState = state;
  renderState();
  if (previousTwoSumStart !== eventState.gameStarts?.[1]) {
    startCodeClock();
    renderEditor();
  }
});
socket.on("connect", () => {
  $("#connection-state").textContent = "· connected";
  $("#connection-state").classList.add("connected");
});
socket.on("disconnect", () => {
  $("#connection-state").textContent = "· reconnecting";
  $("#connection-state").classList.remove("connected");
});

function openTab(name) {
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.tab === name));
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === `${name}-view`));
  history.replaceState(null, "", `#${name}`);
  window.scrollTo({ top: 0, behavior: "instant" });
}

$$(".nav-item").forEach((button) => button.addEventListener("click", () => openTab(button.dataset.tab)));

$("#leaderboard-tabs").addEventListener("click", (event) => {
  const view = event.target.dataset.board;
  if (view === undefined) return;
  leaderboardView = view;
  renderLeaderboard();
});

$$("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    $$("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
    const developer = button.dataset.mode === "developer";
    currentMode = button.dataset.mode;
    $$(".developer-only").forEach((item) => item.classList.toggle("hidden", !developer));
    localStorage.setItem("traders-mode", button.dataset.mode);
    renderGameAccess();
    if (!developer && $("#setup-view").classList.contains("active")) openTab("leaderboard");
  });
});

if (localStorage.getItem("traders-mode") === "developer") {
  $('[data-mode="developer"]').click();
}

const initialTab = location.hash.slice(1);
if (["leaderboard", "zeta", "twosum", "setup"].includes(initialTab)) {
  if (initialTab !== "setup" || localStorage.getItem("traders-mode") === "developer") openTab(initialTab);
}

$$("[data-game-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    if (currentMode !== "developer") return;
    const index = Number(button.dataset.gameToggle);
    if (eventState.gameOpen?.[index]) return;
    if (confirm("Start this game now? Every team's timer will begin immediately.")) {
      socket.emit("game:start", index);
    }
  });
});

$("#add-team-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("#team-name-input");
  const membersInput = $("#team-members-input");
  socket.emit("team:add", { name: input.value, members: membersInput.value }, (result) => {
    if (!result.ok) return showToast(result.error);
    input.value = "";
    membersInput.value = "";
    showToast(`${result.team.name} joined the Olympics.`);
  });
});

$("#team-list").addEventListener("click", (event) => {
  const editTeamId = event.target.dataset.editMembers;
  if (editTeamId) {
    const team = eventState.teams.find((item) => item.id === editTeamId);
    if (!team) return;
    const members = prompt(
      `People on ${team.name} (comma-separated):`,
      (team.members || []).join(", "),
    );
    if (members !== null) socket.emit("team:members", { teamId: editTeamId, members });
    return;
  }

  const teamId = event.target.dataset.removeTeam;
  if (!teamId) return;
  const team = eventState.teams.find((item) => item.id === teamId);
  if (team && confirm(`Remove ${team.name} and all of its scores?`)) socket.emit("team:remove", teamId);
});

$("#event-name-form").addEventListener("submit", (event) => {
  event.preventDefault();
  socket.emit("event:rename", $("#event-name-input").value);
  showToast("Event name saved.");
});

$("#reset-scores").addEventListener("click", () => {
  if (confirm("Reset both games, all timers, progress, and scores?")) {
    socket.emit("scores:reset");
    showToast("Games and scores reset.");
  }
});

// ZetaMac relay
const zeta = {
  phase: "idle",
  teamId: null,
  legs: 4,
  runner: 1,
  relayScore: 0,
  answer: 0,
  endAt: 0,
  timerId: null,
  globalStart: null,
};

function setZetaPanel(panel) {
  ["idle", "playing", "handoff", "finished"].forEach((name) => {
    $(`#zeta-${name}`).classList.toggle("hidden", name !== panel);
  });
}

function nextQuestion() {
  const type = Math.floor(Math.random() * 4);
  let left;
  let right;
  let symbol;
  if (type === 0) {
    left = 2 + Math.floor(Math.random() * 99);
    right = 2 + Math.floor(Math.random() * 99);
    zeta.answer = left + right;
    symbol = "+";
  } else if (type === 1) {
    zeta.answer = 2 + Math.floor(Math.random() * 99);
    right = 2 + Math.floor(Math.random() * 99);
    left = zeta.answer + right;
    symbol = "−";
  } else if (type === 2) {
    left = 2 + Math.floor(Math.random() * 11);
    right = 2 + Math.floor(Math.random() * 99);
    zeta.answer = left * right;
    symbol = "×";
  } else {
    right = 2 + Math.floor(Math.random() * 11);
    zeta.answer = 2 + Math.floor(Math.random() * 99);
    left = right * zeta.answer;
    symbol = "÷";
  }
  $("#zeta-problem").textContent = `${left} ${symbol} ${right}`;
  $("#zeta-answer").value = "";
}

function startZetaLeg(duration = 60_000) {
  zeta.phase = "playing";
  zeta.endAt = performance.now() + duration;
  setZetaPanel("playing");
  $("#zeta-runner").textContent = `RUNNER ${zeta.runner} OF ${zeta.legs}`;
  nextQuestion();
  $("#zeta-answer").disabled = false;
  $("#zeta-answer").focus();
  clearInterval(zeta.timerId);
  zeta.timerId = setInterval(tickZeta, 50);
  tickZeta();
}

function startHandoff(duration = 5_000) {
  zeta.phase = "handoff";
  zeta.endAt = performance.now() + duration;
  setZetaPanel("handoff");
  $("#handoff-next").textContent = `Runner ${zeta.runner + 1} is up next.`;
  clearInterval(zeta.timerId);
  zeta.timerId = setInterval(tickZeta, 50);
  tickZeta();
}

function finishZeta() {
  zeta.phase = "finished";
  clearInterval(zeta.timerId);
  setZetaPanel("finished");
  $("#zeta-final-score").textContent = zeta.relayScore;
}

function tickZeta() {
  const remaining = Math.max(0, zeta.endAt - performance.now());
  if (zeta.phase === "playing") {
    $("#zeta-timer").textContent = (remaining / 1000).toFixed(1);
    $("#zeta-timer-bar").style.transform = `scaleX(${remaining / 60_000})`;
    if (remaining <= 0) {
      $("#zeta-answer").disabled = true;
      if (zeta.runner >= zeta.legs) finishZeta();
      else startHandoff();
    }
  } else if (zeta.phase === "handoff") {
    $("#handoff-count").textContent = Math.max(1, Math.ceil(remaining / 1000));
    if (remaining <= 0) {
      zeta.runner += 1;
      startZetaLeg();
    }
  }
}

function startZetaFromOfficialClock() {
  const startedAt = Number(eventState.gameStarts?.[0]);
  if (!eventState.gameOpen?.[0] || !startedAt) {
    if (zeta.globalStart) {
      clearInterval(zeta.timerId);
      zeta.globalStart = null;
      zeta.phase = "idle";
      $("#zeta-team").disabled = false;
      $("#zeta-legs").disabled = false;
      setZetaPanel("idle");
    }
    return;
  }

  const team = selectedTeam($("#zeta-team"));
  if (!team) {
    setZetaPanel("idle");
    return;
  }
  if (zeta.globalStart === startedAt && zeta.teamId === team.id && zeta.phase !== "idle") return;

  zeta.teamId = team.id;
  zeta.legs = Number($("#zeta-legs").value);
  zeta.globalStart = startedAt;
  zeta.relayScore = team.scores[0];
  $("#zeta-score").textContent = team.scores[0];
  $("#zeta-team").disabled = true;
  $("#zeta-legs").disabled = true;

  const elapsed = Math.max(0, Date.now() - startedAt);
  const cycle = 65_000;
  zeta.runner = Math.floor(elapsed / cycle) + 1;
  if (zeta.runner > zeta.legs) {
    finishZeta();
    return;
  }
  const withinCycle = elapsed % cycle;
  if (withinCycle < 60_000) startZetaLeg(60_000 - withinCycle);
  else startHandoff(cycle - withinCycle);
}

$("#zeta-team").addEventListener("change", startZetaFromOfficialClock);
$("#zeta-legs").addEventListener("change", startZetaFromOfficialClock);

$("#zeta-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (zeta.phase !== "playing") return;
  const input = $("#zeta-answer");
  if (Number(input.value.trim()) === zeta.answer) {
    zeta.relayScore += 1;
    socket.emit("zeta:add", { teamId: zeta.teamId });
    nextQuestion();
  } else {
    input.select();
    input.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-7px)" },
        { transform: "translateX(7px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 180 },
    );
  }
});

// Two Sum line-by-line editor
const TWO_SUM_SIGNATURE = "def two_sum(nums, target):";
const codeState = {
  teamId: "",
  lines: [TWO_SUM_SIGNATURE, ""],
  activeLine: 1,
  runner: 1,
  locked: false,
  clockId: null,
  progressTimer: null,
  worker: null,
};

function draftKey(teamId) {
  return `traders-twosum-${teamId}`;
}

function saveDraft() {
  if (!codeState.teamId) return;
  localStorage.setItem(
    draftKey(codeState.teamId),
    JSON.stringify({
      lines: codeState.lines,
      activeLine: codeState.activeLine,
      runner: codeState.runner,
    }),
  );
}

function countWrittenLines() {
  return codeState.lines.slice(1).filter((line) => line.trim().length > 0).length;
}

function isTwoSumActive() {
  return Boolean(eventState.gameOpen?.[1] && eventState.gameStarts?.[1]);
}

function loadDraft(teamId) {
  let draft;
  try {
    draft = JSON.parse(localStorage.getItem(draftKey(teamId)));
  } catch {
    draft = null;
  }
  codeState.teamId = teamId;
  const savedLines = draft?.lines?.length ? [...draft.lines] : [TWO_SUM_SIGNATURE, ""];
  if (savedLines[0]?.trim().startsWith("def ")) savedLines[0] = TWO_SUM_SIGNATURE;
  else savedLines.unshift(TWO_SUM_SIGNATURE);
  if (savedLines.length === 1) savedLines.push("");
  codeState.lines = savedLines;
  codeState.activeLine = Math.max(1, Math.min(draft?.activeLine || 1, codeState.lines.length - 1));
  codeState.runner = draft?.runner || 1;
  startCodeClock();
  renderEditor();
}

function highlightPython(line) {
  const safe = escapeHtml(line);
  if (safe.trimStart().startsWith("#")) return `<span class="py-comment">${safe}</span>`;
  return safe
    .replace(/\b(def|return|for|in|if|else|elif|while|range|enumerate|True|False|None)\b/g, '<span class="py-keyword">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="py-number">$1</span>')
    .replace(/(?<=def\s)([A-Za-z_]\w*)/g, '<span class="py-function">$1</span>');
}

function renderEditor() {
  const body = $("#editor-body");
  body.innerHTML = codeState.lines
    .map(
      (line, index) => `<div class="code-line ${index === codeState.activeLine ? "active" : ""}">
        <span class="line-number">${index + 1}</span>
        ${
          index === codeState.activeLine
            ? `<input class="line-input" value="${escapeHtml(line)}" aria-label="Python line ${index + 1}" ${codeState.locked || !codeState.teamId || !isTwoSumActive() ? "disabled" : ""} />`
            : `<span class="line-content">${highlightPython(line) || " "}</span>`
        }
      </div>`,
    )
    .join("");

  $("#editor-status").textContent = codeState.teamId
    ? `Runner ${codeState.runner} · Line ${codeState.activeLine + 1}`
    : "Select a team";
  $("#line-enter").disabled = codeState.locked || !codeState.teamId || !isTwoSumActive();
  $("#line-up").disabled =
    codeState.locked || !codeState.teamId || !isTwoSumActive() || codeState.activeLine <= 1;
  $("#run-tests").disabled = codeState.locked || !codeState.teamId || !isTwoSumActive();

  const input = $(".line-input");
  if (input && !input.disabled) {
    input.addEventListener("input", () => {
      const cleaned = input.value.replace(/[\r\n]+/g, " ");
      if (cleaned !== input.value) input.value = cleaned;
      codeState.lines[codeState.activeLine] = cleaned;
      saveDraft();
      clearTimeout(codeState.progressTimer);
      codeState.progressTimer = setTimeout(() => {
        socket.emit("twosum:progress", {
          teamId: codeState.teamId,
          linesWritten: countWrittenLines(),
        });
      }, 180);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        showToast(event.key === "Enter" ? "Use the Enter button to swap runners." : "Use the relay controls.");
      } else if (event.key === "Tab") {
        event.preventDefault();
        const start = input.selectionStart;
        input.value = `${input.value.slice(0, start)}    ${input.value.slice(input.selectionEnd)}`;
        input.setSelectionRange(start + 4, start + 4);
        input.dispatchEvent(new Event("input"));
      }
    });
    input.addEventListener("paste", (event) => {
      event.preventDefault();
      const text = event.clipboardData.getData("text").replace(/[\r\n]+/g, " ");
      document.execCommand("insertText", false, text);
    });
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
  requestAnimationFrame(() => {
    const active = $(".code-line.active");
    active?.scrollIntoView({ block: "nearest" });
  });
}

function startCodeClock() {
  clearInterval(codeState.clockId);
  const update = () => {
    const team = eventState.teams.find((item) => item.id === codeState.teamId);
    const elapsed = twoSumElapsed(team);
    $("#code-clock").textContent = elapsed === null ? "00:00" : formatTime(elapsed);
  };
  update();
  codeState.clockId = setInterval(update, 1000);
}

function swapRunner(direction) {
  if (codeState.locked || !codeState.teamId) return;
  if (direction === "down") {
    if (codeState.activeLine === codeState.lines.length - 1) codeState.lines.push("");
    codeState.activeLine += 1;
  } else if (codeState.activeLine > 1) {
    codeState.activeLine -= 1;
  }
  codeState.runner += 1;
  codeState.locked = true;
  saveDraft();
  socket.emit("twosum:progress", {
    teamId: codeState.teamId,
    linesWritten: countWrittenLines(),
  });
  renderEditor();
  $("#swap-overlay").classList.remove("hidden");

  let count = 3;
  $("#swap-count").textContent = count;
  const countdown = setInterval(() => {
    count -= 1;
    if (count > 0) {
      $("#swap-count").textContent = count;
    } else {
      clearInterval(countdown);
      codeState.locked = false;
      $("#swap-overlay").classList.add("hidden");
      renderEditor();
    }
  }, 1000);
}

$("#line-enter").addEventListener("click", () => swapRunner("down"));
$("#line-up").addEventListener("click", () => swapRunner("up"));

$("#twosum-team").addEventListener("change", (event) => {
  if (codeState.teamId && !codeState.locked) saveDraft();
  loadDraft(event.target.value);
  const team = selectedTeam(event.target);
  if (team?.twoSum?.solved) showToast(`${team.name} has already completed Two Sum.`);
});

$("#twosum-reset").addEventListener("click", () => {
  if (!codeState.teamId) return showToast("Select a team first.");
  if (!confirm("Clear this team's saved code? The official timer will keep running.")) return;
  localStorage.removeItem(draftKey(codeState.teamId));
  codeState.lines = [TWO_SUM_SIGNATURE, ""];
  codeState.activeLine = 1;
  codeState.runner = 1;
  socket.emit("twosum:progress", { teamId: codeState.teamId, linesWritten: 0 });
  startCodeClock();
  renderEditor();
  $("#test-summary").textContent = "Not run";
  $("#test-results").innerHTML = '<div class="test-placeholder">Run your code when you think it’s ready.</div>';
});

function showTestResults(result) {
  const container = $("#test-results");
  if (!result.ok) {
    $("#test-summary").textContent = "Error";
    const conciseError = result.error
      .split("\n")
      .filter((line) => !line.includes('File "<string>"'))
      .join("\n")
      .trim();
    container.innerHTML = `<div class="test-error">${escapeHtml(conciseError)}</div>`;
    return;
  }

  const passed = result.results.filter((test) => test.passed).length;
  $("#test-summary").textContent = `${passed} / ${result.results.length} passed`;
  container.innerHTML = result.results
    .map(
      (test, index) => `<div class="test-case ${test.passed ? "pass" : "fail"}">
        <strong><span>CASE ${index + 1}${index >= 4 ? " · HIDDEN" : ""}</span><span>${test.passed ? "PASS ✓" : "FAIL ×"}</span></strong>
        ${
          index >= 4
            ? "<code>Inputs and output are hidden.</code>"
            : `<code>nums=${escapeHtml(JSON.stringify(test.nums))}<br />target=${test.target}<br />output=${escapeHtml(JSON.stringify(test.output))}</code>`
        }
        <div class="test-console">
          <span>PRINT OUTPUT</span>
          <pre>${test.stdout ? escapeHtml(test.stdout) : "(no output)"}</pre>
        </div>
      </div>`,
    )
    .join("");

  if (passed === result.results.length) {
    socket.emit("twosum:solved", { teamId: codeState.teamId });
    showToast("All tests passed — 100 points!");
  }
}

$("#run-tests").addEventListener("click", () => {
  if (!isTwoSumActive()) return showToast("Waiting for the developer to start the game.");
  const code = codeState.lines.join("\n").trimEnd();
  if (!code.trim()) return showToast("Write some Python first.");
  socket.emit("twosum:submit", {
    teamId: codeState.teamId,
    linesWritten: countWrittenLines(),
  });

  $("#run-tests").disabled = true;
  $("#test-summary").textContent = "Starting Python…";
  $("#test-results").innerHTML =
    '<div class="test-placeholder">The first run may take a few seconds while Python starts.</div>';

  codeState.worker?.terminate();
  codeState.worker = new Worker("/python-worker.js");
  const timeout = setTimeout(() => {
    codeState.worker.terminate();
    $("#run-tests").disabled = false;
    showTestResults({ ok: false, error: "Execution timed out after 30 seconds." });
  }, 30_000);

  codeState.worker.onmessage = ({ data }) => {
    clearTimeout(timeout);
    $("#run-tests").disabled = false;
    showTestResults(data);
  };
  codeState.worker.postMessage({ code });
});

setInterval(() => {
  if ($("#leaderboard-view").classList.contains("active") && leaderboardView === "1") {
    renderLeaderboard();
  }
}, 1000);

startCodeClock();
renderEditor();
