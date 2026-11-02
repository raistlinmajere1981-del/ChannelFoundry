"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const {spawn} = require("node:child_process");

(async () => {
  const root = path.resolve(__dirname, "../..");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cf-first-admin-test-"));
  const serverRoot = path.join(tmp, "public_html");
  const apiRoot = path.join(serverRoot, "api");
  fs.mkdirSync(apiRoot, {recursive: true});
  fs.cpSync(path.join(root, "channels/birdesengor/web/public/api/community"), path.join(apiRoot, "community"), {recursive: true});
  fs.mkdirSync(path.join(apiRoot, "studio"), {recursive:true});
  fs.copyFileSync(path.join(root, "channels/birdesengor/web/public/api/studio/setup.php"), path.join(apiRoot, "studio", "setup.php"));
  const privateDir = path.join(tmp, "channel-foundry-private");
  fs.mkdirSync(privateDir, {recursive:true});
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => { const result=server.address().port; server.close(()=>resolve(result)); });
  });
  const proc = spawn("php", ["-S", `127.0.0.1:${port}`, "-t", serverRoot], {stdio:"ignore"});
  const url = `http://127.0.0.1:${port}/api/studio/setup.php`;
  const request = async (method="GET", body) => {
    const response = await fetch(url, {
      method, redirect:"manual",
      headers:{"Content-Type":"application/json"},
      ...(body ? {body:JSON.stringify(body)}:{}),
      signal:AbortSignal.timeout(3500),
    });
    return {status:response.status, body:await response.json()};
  };
  try {
    let ready = false;
    for(let i=0;i<35;i++){
      try {const x=await request();if(x.status===200){ready=true;break;}}catch{}
      await new Promise(resolve=>setTimeout(resolve,80));
    }
    assert.ok(ready, "PHP fixture unavailable");
    const initially = await request();
    assert.equal(initially.body.setupRequired,true);

    const ticketId="a".repeat(32), ticket="b".repeat(64);
    const input={ticketId,ticket,username:"studio-editor",password:"temporary-fixture-password"};
    const before = await request("POST",input);
    assert.equal(before.status,403);
    assert.equal(before.body.error,"setup_not_authorized");

    fs.writeFileSync(path.join(privateDir,`studio-setup-${ticketId}.token`),ticket+"\n",{mode:0o600});
    const wrong = await request("POST",{...input,ticket:"c".repeat(64)});
    assert.equal(wrong.status,403);

    const created = await request("POST",input);
    assert.equal(created.status,201,JSON.stringify(created.body));
    assert.equal(created.body.admin.username,input.username);
    assert.equal(fs.existsSync(path.join(privateDir,`studio-setup-${ticketId}.token`)),false);

    const after = await request();
    assert.equal(after.body.setupRequired,false);
    const login = await fetch(`http://127.0.0.1:${port}/api/community/?action=admin_me`,{
      headers:{Authorization:"Basic "+Buffer.from(input.username+":"+input.password).toString("base64")},
    });
    assert.equal(login.status,200);
    const admin = await login.json();
    assert.equal(admin.ok,true);
    const noOverwrite = await request("POST",input);
    assert.equal(noOverwrite.status,403); // ticket consumed, cannot reuse

    const regular = await fetch(`http://127.0.0.1:${port}/api/community/?action=register`,{
      method:"POST",headers:{"Content-Type":"application/json"},body:"{}",
    });
    assert.notEqual(regular.status,503,"normal registration should no longer require first admin");
    console.log("First Studio admin: status / missing token / wrong token / create / Basic auth / one-time / registration unlock PASS");
  } finally {
    proc.kill();
    fs.rmSync(tmp,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
