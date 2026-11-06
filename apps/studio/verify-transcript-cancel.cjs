const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const manager = require("./ytdlp-manager.cjs");
const service = require("./transcript-youtube.cjs");

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-transcript-cancel-test-"));
  const originalPath = manager.executablePath;
  try {
    const executable = path.join(temp, "fake-yt-dlp");
    fs.writeFileSync(executable, `#!/usr/bin/env node
const fs=require("node:fs");
const args=process.argv.slice(2);
const output=args[args.indexOf("--output")+1];
if(process.env.STUDIO_TEST_HANG==="1"){
  fs.writeFileSync(process.env.STUDIO_TEST_PID, String(process.pid));
  setInterval(()=>{},1000);
}else{
  fs.writeFileSync(output.replace("%(id)s","fakevideo").replace("%(ext)s","tr.vtt"),
    "WEBVTT\\n\\n00:00:00.000 --> 00:00:02.000\\nMerhaba dünya!\\n");
}
`);
    fs.chmodSync(executable, 0o755);
    manager.executablePath = () => executable;
    const outputTemplate = path.join(temp, "%(id)s.%(ext)s");

    // Complete a normal attempt to prove the cancellation hook changes no
    // successful path or the saved-transcript file selection behaviour.
    const success = await service.runSubtitleAttempt(
      temp, outputTemplate, "https://www.youtube.com/watch?v=abcdefghijk", false, ["tr"],
    );
    assert.equal(success.selected, "fakevideo.tr.vtt");
    assert.equal(success.error, null);

    const beforeStart = new AbortController();
    beforeStart.abort();
    await assert.rejects(
      () => service.runSubtitleAttempt(
        temp, outputTemplate, "https://www.youtube.com/watch?v=abcdefghijk", false, ["tr"], beforeStart.signal,
      ),
      (error) => error.code === "CHANNEL_FOUNDRY_ARCHIVE_CANCELLED",
    );

    const pidPath = path.join(temp, "child.pid");
    process.env.STUDIO_TEST_HANG = "1";
    process.env.STUDIO_TEST_PID = pidPath;
    const active = new AbortController();
    const started = Date.now();
    const running = service.runSubtitleAttempt(
      temp, outputTemplate, "https://www.youtube.com/watch?v=abcdefghijk", true, ["tr"], active.signal,
    );
    for (let i=0; i<100 && !fs.existsSync(pidPath); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert(fs.existsSync(pidPath), "simulated yt-dlp child was not started");
    const childPid = Number(fs.readFileSync(pidPath, "utf8"));
    active.abort();
    await assert.rejects(running, (error) =>
      error.code === "CHANNEL_FOUNDRY_ARCHIVE_CANCELLED",
    );
    assert(Date.now() - started < 5000, "canceled download did not terminate promptly");
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.throws(() => process.kill(childPid, 0), { code: "ESRCH" },
      "aborted yt-dlp process must not be left running");
    console.log("PASS transcript archive: successful fetch unchanged; pre-start abort; running yt-dlp process terminated");
  } finally {
    manager.executablePath = originalPath;
    delete process.env.STUDIO_TEST_HANG;
    delete process.env.STUDIO_TEST_PID;
    fs.rmSync(temp, { recursive:true, force:true });
  }
}

main().catch((error) => { console.error(error); process.exitCode=1; });
