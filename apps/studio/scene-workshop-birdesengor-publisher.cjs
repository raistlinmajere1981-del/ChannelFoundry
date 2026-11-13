"use strict";
const path=require("node:path");
const os=require("node:os");
const {execFile}=require("node:child_process");
const {promisify}=require("node:util");
const execFileAsync=promisify(execFile);
function createRunner(webRoot) {
  async function run(executable, args, extraEnv = {}, timeoutMs = 240_000) {
    try {
      await execFileAsync(executable, args, {
        cwd: webRoot, timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, ...extraEnv },
      });
    } catch (error) {
      const detail = String(error?.stderr || error?.message || "Komut başarısız.").slice(0, 650);
      throw new Error("BirDeSenGör yayın kontrolü başarısız: " + detail);
    }
  }
  // The already-installed, machine-private wrapper owns FTPS credentials and
  // executes the same reviewed build, verification and managed-assets policy.
  // Never pass secrets through Studio IPC, a separate config file or Git.
  const wrapper = path.join(os.homedir(), ".local", "bin", "birdesengor-natro");
  return {
    build: () => run("npm", ["run", "build"]),
    plan: () => run("npm", ["run", "deploy:natro", "--", "--plan"]),
    dryRun: () => run(wrapper, ["clean-dry-run"]),
    deploy: () => run(wrapper, ["clean-deploy"], {}, 600_000),
    verifyLive: () => run("npm", ["run", "verify:live"], {}, 60_000),
  };
}

module.exports={createRunner};
