
const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const servers = new Map();

const SERVER_TIMEOUT = 60000;

function getClientIP(req) {
    let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    ip = ip.split(",")[0].trim();

    if (ip.startsWith("::ffff:")) {
        ip = ip.substring(7);
    }

    return ip;
}

function cleanServers() {
    const now = Date.now();

    for (const [id, server] of servers.entries()) {
        if (now - server.lastHeartbeat > SERVER_TIMEOUT) {
            servers.delete(id);
        }
    }
}

function publicServerData(server) {
    return {
        id: server.id,
        name: server.name,
        ip: server.ip,
        port: server.port,
        players: server.players,
        maxPlayers: server.maxPlayers
    };
}

app.get("/", (req, res) => {
    res.json({
        name: "SandboxHUB Master Server",
        status: "online",
        version: "1.0.0"
    });
});

app.get("/api/servers", (req, res) => {
    cleanServers();

    const list = [];

    for (const server of servers.values()) {
        list.push(publicServerData(server));
    }

    res.json({
        ok: true,
        servers: list
    });
});

app.post("/api/servers", (req, res) => {
    const name = String(req.body.name || "SandboxHUB Server").trim();
    const port = Number(req.body.port || 2456);
    const maxPlayers = Number(req.body.maxPlayers || 8);
    const players = Number(req.body.players || 1);

    if (
        name.length < 1 ||
        name.length > 32 ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535 ||
        !Number.isInteger(maxPlayers) ||
        maxPlayers < 1 ||
        maxPlayers > 32 ||
        !Number.isInteger(players) ||
        players < 1 ||
        players > maxPlayers
    ) {
        return res.status(400).json({
            ok: false,
            error: "Invalid server information"
        });
    }

    const id = crypto.randomUUID();
    const secret = crypto.randomBytes(24).toString("hex");

    const server = {
        id,
        secret,
        name,
        ip: getClientIP(req),
        port,
        players,
        maxPlayers,
        lastHeartbeat: Date.now()
    };

    servers.set(id, server);

    res.json({
        ok: true,
        id,
        secret,
        server: publicServerData(server)
    });
});

app.post("/api/servers/:id/heartbeat", (req, res) => {
    cleanServers();

    const server = servers.get(req.params.id);

    if (!server || req.body.secret !== server.secret) {
        return res.status(404).json({
            ok: false,
            error: "Server not found"
        });
    }

    const players = Number(req.body.players);

    if (
        !Number.isInteger(players) ||
        players < 1 ||
        players > server.maxPlayers
    ) {
        return res.status(400).json({
            ok: false,
            error: "Invalid player count"
        });
    }

    server.players = players;
    server.lastHeartbeat = Date.now();

    res.json({ ok: true });
});

app.delete("/api/servers/:id", (req, res) => {
    const server = servers.get(req.params.id);

    if (!server || req.body.secret !== server.secret) {
        return res.status(404).json({
            ok: false,
            error: "Server not found"
        });
    }

    servers.delete(req.params.id);

    res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log("SandboxHUB Master Server running on port " + PORT);
});
