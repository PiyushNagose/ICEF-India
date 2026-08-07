const { spawn } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const services = [
  {
    name: "IDENTITY",
    script: "apps/identity-service/server.js",
    env: { IDENTITY_SERVICE_PORT: process.env.IDENTITY_SERVICE_PORT || "5001" },
  },
  {
    name: "RECRUITMENT",
    script: "apps/recruitment-service/server.js",
    env: {
      RECRUITMENT_SERVICE_PORT: process.env.RECRUITMENT_SERVICE_PORT || "5002",
    },
  },
  {
    name: "COMMUNICATION",
    script: "apps/communication-payment-service/server.js",
    env: {
      COMMUNICATION_SERVICE_PORT:
        process.env.COMMUNICATION_SERVICE_PORT || "5003",
    },
  },
  {
    name: "GATEWAY",
    script: "apps/api-gateway/server.js",
    env: {
      API_GATEWAY_PORT: process.env.PORT || process.env.API_GATEWAY_PORT || "5000",
    },
  },
];

const children = [];
let shuttingDown = false;

const stopAll = (signal = "SIGTERM") => {
  if (shuttingDown) return;
  shuttingDown = true;

  children.forEach((child) => {
    if (!child.killed) child.kill(signal);
  });

  setTimeout(() => process.exit(1), 10000).unref();
};

services.forEach((service) => {
  const child = spawn(process.execPath, [path.join(rootDir, service.script)], {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "production",
      ...service.env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  children.push(child);

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${service.name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${service.name}] ${chunk}`);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;

    console.error(
      `[${service.name}] exited unexpectedly with code ${code ?? "null"} signal ${signal ?? "null"}`,
    );
    stopAll();
  });
});

process.on("SIGTERM", () => stopAll("SIGTERM"));
process.on("SIGINT", () => stopAll("SIGINT"));
