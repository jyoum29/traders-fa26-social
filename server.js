const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { randomUUID } = require("crypto");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const statePath = path.join(dataDir, "state.json");
const defaultState = {
  eventName: "Traders Olympics",
  gameNames: ["ZetaMac Relay", "2 Sum Line by Line"],
  gameOpen: [false, false],
  gameStarts: [null, null],
  teams: [],
};

function loadState() {
  try {
    const saved = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const gameStarts = Array.isArray(saved.gameStarts) ? saved.gameStarts.slice(0, 2) : [null, null];
    return {
      ...structuredClone(defaultState),
      ...saved,
      gameNames: [...defaultState.gameNames],
      gameOpen: gameStarts.map(Boolean),
      gameStarts,
      teams: (saved.teams || []).map((team) => ({
        ...team,
        scores: [...(team.scores || []), 0, 0].slice(0, 2),
        twoSum: {
          solved: false,
          elapsedSeconds: null,
          solvedAt: null,
          linesWritten: 0,
          submissions: 0,
          ...(team.twoSum || {}),
        },
      })),
    };
  } catch {
    return structuredClone(defaultState);
  }
}

let state = loadState();
let saveTimer;
queueSave();

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  }, 100);
}

function broadcastState() {
  io.emit("state", state);
  queueSave();
}

function cleanName(value, maxLength = 32) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function getTeam(id) {
  return state.teams.find((team) => team.id === id);
}

function makeScores() {
  return [0, 0];
}

app.use("/pyodide", express.static(path.join(__dirname, "node_modules", "pyodide")));
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_request, response) => response.json({ ok: true }));

io.on("connection", (socket) => {
  socket.emit("state", state);

  socket.on("team:add", (name, acknowledge) => {
    const normalized = cleanName(name);
    if (!normalized) return acknowledge?.({ ok: false, error: "Enter a team name." });
    if (state.teams.some((team) => team.name.toLowerCase() === normalized.toLowerCase())) {
      return acknowledge?.({ ok: false, error: "That team already exists." });
    }

    const palette = ["#ef5da8", "#7c5cff", "#00b894", "#ff9f43", "#35a7ff", "#f15b40"];
    const team = {
      id: randomUUID(),
      name: normalized,
      color: palette[state.teams.length % palette.length],
      scores: makeScores(),
      twoSum: {
        solved: false,
        elapsedSeconds: null,
        solvedAt: null,
        linesWritten: 0,
        submissions: 0,
      },
    };
    state.teams.push(team);
    broadcastState();
    acknowledge?.({ ok: true, team });
  });

  socket.on("team:remove", (teamId) => {
    state.teams = state.teams.filter((team) => team.id !== teamId);
    broadcastState();
  });

  socket.on("team:rename", ({ teamId, name }) => {
    const team = getTeam(teamId);
    const normalized = cleanName(name);
    if (!team || !normalized) return;
    team.name = normalized;
    broadcastState();
  });

  socket.on("event:rename", (name) => {
    const normalized = cleanName(name, 48);
    if (!normalized) return;
    state.eventName = normalized;
    broadcastState();
  });

  socket.on("game:start", (index) => {
    if (!Number.isInteger(index) || index < 0 || index > 1) return;
    if (state.gameStarts[index]) return;
    state.gameOpen[index] = true;
    state.gameStarts[index] = Date.now();
    state.teams.forEach((team) => {
      team.scores[index] = 0;
      if (index === 1) {
        team.twoSum = {
          solved: false,
          elapsedSeconds: null,
          solvedAt: null,
          linesWritten: 0,
          submissions: 0,
        };
      }
    });
    broadcastState();
  });

  socket.on("zeta:add", ({ teamId }) => {
    const team = getTeam(teamId);
    if (!team || !state.gameOpen[0]) return;
    team.scores[0] += 1;
    broadcastState();
  });

  socket.on("twosum:progress", ({ teamId, linesWritten }) => {
    const team = getTeam(teamId);
    if (!team || !state.gameOpen[1]) return;
    team.twoSum.linesWritten = Math.max(0, Math.round(Number(linesWritten) || 0));
    broadcastState();
  });

  socket.on("twosum:submit", ({ teamId, linesWritten }) => {
    const team = getTeam(teamId);
    if (!team || !state.gameOpen[1]) return;
    team.twoSum.linesWritten = Math.max(0, Math.round(Number(linesWritten) || 0));
    team.twoSum.submissions += 1;
    broadcastState();
  });

  socket.on("twosum:solved", ({ teamId }) => {
    const team = getTeam(teamId);
    if (!team || !state.gameOpen[1] || team.twoSum.solved) return;
    team.twoSum.solved = true;
    team.twoSum.elapsedSeconds = Math.max(
      0,
      Math.round((Date.now() - state.gameStarts[1]) / 1000),
    );
    team.twoSum.solvedAt = new Date().toISOString();
    team.scores[1] = 100;
    broadcastState();
  });

  socket.on("scores:reset", () => {
    state.gameOpen = [false, false];
    state.gameStarts = [null, null];
    state.teams.forEach((team) => {
      team.scores = makeScores();
      team.twoSum = {
        solved: false,
        elapsedSeconds: null,
        solvedAt: null,
        linesWritten: 0,
        submissions: 0,
      };
    });
    broadcastState();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => `http://${entry.address}:${PORT}`);
  console.log(`Traders Olympics is running at http://localhost:${PORT}`);
  addresses.forEach((address) => console.log(`LAN: ${address}`));
});
