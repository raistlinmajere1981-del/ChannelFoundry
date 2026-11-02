"use strict";
// One-time admin creation via the already-authorized, project-local FTPS deployment.
// No public first-user signup and no server-side hardcoded setup password.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const dns = require("node:dns");
try { dns.setDefaultResultOrder("ipv4first"); } catch {}
function appFetch(url, options) {
  try {
    const { net } = require("electron");
    if (net && typeof net.fetch === "function") return net.fetch(url, options);
  } catch {}
  return fetch(url, options);
}
const channelProjects = require("./channel-projects.cjs");
const webConnection = require("./web-connection.cjs");

function deploymentFile() {
  const project = channelProjects.activeProject();
  if (!project?.id) throw new Error("Aktif kanal projesi bulunamadı.");
  return path.join(os.homedir(), ".config", "channel-foundry", `${project.id}-natro.env`);
}
function deploymentConfig() {
  const file = deploymentFile();
  if (!fs.existsSync(file)) throw new Error("Bu proje için kayıtlı FTPS deploy bağlantısı yok.");
  const result = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*(CF_NATRO_FTP_(?:HOST|USER|PASSWORD|DIR))=(.*)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  if (!/^[a-zA-Z0-9.-]+$/.test(result.CF_NATRO_FTP_HOST || "")
      || !result.CF_NATRO_FTP_USER || !result.CF_NATRO_FTP_PASSWORD
      || !result.CF_NATRO_FTP_DIR || result.CF_NATRO_FTP_DIR.includes("..")
      || [result.CF_NATRO_FTP_USER, result.CF_NATRO_FTP_PASSWORD, result.CF_NATRO_FTP_DIR].some(v => /[\r\n\0]/.test(v))) {
    throw new Error("Kayıtlı FTPS deploy bilgileri eksik veya geçersiz.");
  }
  return result;
}
function quoted(value) {
  return '"' + String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}
async function transferTicket(config, localFile, remoteFile, remove = false) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cf-first-admin-ftps-"));
  const commandFile = path.join(directory, "transfer.lftp");
  try {
    const instructions = [
      "set cmd:fail-exit true",
      "set net:max-retries 1",
      "set net:timeout 12",
      "set ftp:ssl-force true",
      "set ftp:ssl-protect-data true",
      "set ssl:verify-certificate true",
      `open -u ${quoted(config.CF_NATRO_FTP_USER)},${quoted(config.CF_NATRO_FTP_PASSWORD)} ftp://${config.CF_NATRO_FTP_HOST}`,
      remove ? `rm ${quoted(remoteFile)}` : `put ${quoted(localFile)} -o ${quoted(remoteFile)}`,
      "bye",
    ];
    fs.writeFileSync(commandFile, instructions.join("\n") + "\n", {mode: 0o600});
    await new Promise((resolve, reject) => {
      const child = spawn("lftp", ["-f", commandFile], {stdio: "ignore"});
      const timeout = setTimeout(() => child.kill("SIGKILL"), 30000);
      child.on("error", () => { clearTimeout(timeout); reject(new Error("FTPS istemcisi başlatılamadı.")); });
      child.on("exit", (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve();
        else reject(new Error("Sunucunun özel yönetici kurulum alanına FTPS erişimi başarısız."));
      });
    });
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
}
function setupEndpoint() {
  const base = webConnection.webUrl();
  if (!base.startsWith("https://")) throw new Error("İlk yönetici kurulumu HTTPS gerektirir.");
  return new URL("api/studio/setup.php", base + "/").toString();
}
async function serverRequest(method, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await appFetch(setupEndpoint(), {
      method, cache: "no-store", signal: controller.signal,
      headers: {"Accept":"application/json", ...(body ? {"Content-Type":"application/json"} : {})},
      ...(body ? {body:JSON.stringify(body)} : {}),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      if (response.status === 404) throw new Error("Web sunucusunun Studio kurulum API'si güncel değil. Önce siteyi deploy et.");
      throw new Error(result?.message || `Yönetici kurulumu sunucuda ${response.status} yanıtı verdi.`);
    }
    return result;
  } finally {
    clearTimeout(timer);
  }
}
async function status() {
  const state = await serverRequest("GET");
  let deploymentReady = false;
  try { deploymentConfig(); deploymentReady = true; } catch {}
  return {setupRequired: Boolean(state.setupRequired), deploymentReady};
}
async function create(input, saveCredentials) {
  const username = String(input?.username || "").trim();
  const password = String(input?.password || "");
  if (!/^[\p{L}\p{N}._-]{3,32}$/u.test(username) || password.length < 8 || password.length > 200) {
    throw new Error("Yönetici adı 3–32 karakter, parola en az 8 karakter olmalı.");
  }
  if (typeof saveCredentials !== "function") throw new Error("Yönetici bağlantısı hizmeti bulunamadı.");
  const current = await status();
  if (!current.setupRequired) throw new Error("Yönetici hesabı zaten oluşturulmuş. Mevcut hesapla bağlan.");
  const config = deploymentConfig();
  const ticketId = crypto.randomBytes(16).toString("hex");
  const ticket = crypto.randomBytes(32).toString("hex");
  const remoteFile = `channel-foundry-private/studio-setup-${ticketId}.token`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cf-first-admin-ticket-"));
  const localFile = path.join(dir, "proof.token");
  try {
    fs.writeFileSync(localFile, ticket + "\n", {mode:0o600});
    await transferTicket(config, localFile, remoteFile);
    const result = await serverRequest("POST", {ticketId, ticket, username, displayName:username, password});
    if (!result.created || result.admin?.username !== username) throw new Error("Sunucu yönetici kaydını doğrulamadı.");
    const connected = await saveCredentials({username,password});
    return {...connected, created:true};
  } finally {
    try { await transferTicket(config, localFile, remoteFile, true); } catch {}
    fs.rmSync(dir, {recursive:true, force:true});
  }
}
module.exports = {status, create};
