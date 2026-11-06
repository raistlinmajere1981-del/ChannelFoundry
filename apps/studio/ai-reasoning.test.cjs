"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const http=require("node:http");
const reasoning=require("./ai-reasoning.cjs");
const config=require("./ai-config.cjs");
const client=require("./ai-client.cjs");
const openCode=require("./ai-opencode.cjs");

test("provider metadata only: never guess ultra or max; preserve advertised names",()=>{
  const choice=reasoning.fromModelMetadata({
    supportedReasoningEfforts:[
      {reasoningEffort:"medium",description:"Normal"},
      {reasoningEffort:"ultra",description:"Explicitly from provider"},
      {reasoningEffort:"medium",description:"Duplicate"},
      {reasoningEffort:"bad newline\nvalue",description:"Rejected"},
    ],defaultReasoningEffort:"medium",
  });
  assert.deepEqual(choice.supportedReasoningEfforts.map(x=>x.reasoningEffort),["medium","ultra"]);
  assert.equal(choice.supportedReasoningEfforts[1].mode,"effort");
  assert.equal(choice.defaultReasoningEffort,"medium");
  assert.deepEqual(reasoning.fromModelMetadata({id:"gpt-hypothetical"}).supportedReasoningEfforts,[]);
});
test("OpenCode uses only explicitly reported variants, not model-name guesses",()=>{
  const models=openCode.normalizeServerModels([
    {providerID:"openai",id:"gpt-example",variants:{low:{},max:{},ultra:{}},defaultVariant:"low"},
    {providerID:"opencode",id:"no-variants"},
  ]);
  assert.deepEqual(models[0].supportedReasoningEfforts.map(o=>[o.reasoningEffort,o.mode]),
    [["low","variant"],["max","variant"],["ultra","variant"]]);
  assert.equal(models[0].defaultReasoningEffort,"low");
  assert.equal(models[1].supportedReasoningEfforts.length,0);
});
test("Gemini generic model supports thinking levels only if reported",()=>{
  const models=client.normalizeListedModels([
    {id:"gemini-a",supportedThinkingLevels:["minimal","high"]},
    {id:"gemini-b"},
    {id:"compatible-a",supportedReasoningEfforts:[{reasoningEffort:"xhigh"}]},
  ]);
  const gemini=models.find(item=>item.id==="gemini-a");
  const plain=models.find(item=>item.id==="gemini-b");
  const compatible=models.find(item=>item.id==="compatible-a");
  assert.deepEqual(gemini.supportedReasoningEfforts.map(o=>[o.reasoningEffort,o.mode]),
    [["minimal","thinkingLevel"],["high","thinkingLevel"]]);
  assert.equal(plain.supportedReasoningEfforts.length,0);
  assert.equal(compatible.supportedReasoningEfforts[0].mode,"effort");
});
test("save/reopen text & image choices are independent and no provider names are hardcoded",()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),"studio-ai-reasoning-"));
  try{
    const saved=config.saveConfig(directory,{
      provider:"codex-cli",model:"codex-model",
      reasoningEffort:"ultra",reasoningMode:"effort",
      imageProvider:"codex-cli",imageModel:"codex-vision",
      imageReasoningEffort:"xhigh",imageReasoningMode:"effort",
    });
    assert.equal(saved.reasoningEffort,"ultra");
    assert.equal(saved.image.reasoningEffort,"xhigh");
    assert.equal(config.readConfig(directory).imageReasoningMode,"effort");
    assert.equal(config.readConfig(directory).reasoningMode,"effort");
    const changed=config.saveConfig(directory,{imageReasoningEffort:"low"});
    assert.equal(changed.reasoningEffort,"ultra");
    assert.equal(changed.image.reasoningEffort,"low");
    assert.throws(()=>config.saveConfig(directory,{imageReasoningMode:"fake-level"}),/biçimi/);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test("reasoning effort reaches supported OpenAI chat transport only if chosen; defaults omit",async()=>{
  const captured=[];
  const server=http.createServer((request,response)=>{
    let raw="";
    request.on("data",chunk=>{raw+=chunk;});
    request.on("end",()=>{
      captured.push(JSON.parse(raw));
      response.writeHead(200,{"content-type":"application/json"});
      response.end(JSON.stringify({choices:[{message:{content:"ok"},finish_reason:"stop"}]}));
    });
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  try{
    const endpoint="http://127.0.0.1:"+server.address().port+"/v1";
    const base={provider:"openai-compatible",model:"model-one",endpoint};
    const messages=[{role:"user",content:"ok"}];
    await client.requestModelCompletion({...base,reasoningEffort:"max",reasoningMode:"effort"},messages,{retryDelaysMs:[]});
    await client.requestModelCompletion({...base,reasoningEffort:"",reasoningMode:""},messages,{retryDelaysMs:[]});
    assert.equal(captured[0].reasoning_effort,"max");
    assert.equal(captured[1].reasoning_effort,undefined);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test("settings UI displays only discovered options for text/image and never literal provider effort presets",()=>{
  const ui=fs.readFileSync(path.join(__dirname,"src/AiProviderSettings.tsx"),"utf8");
  assert.match(ui,/imageReasoningOptions/);
  assert.match(ui,/selectedReasoning/);
  assert.match(ui,/entry\.supportedReasoningEfforts/);
  assert.match(ui,/imageReasoningMode/);
  assert.match(ui,/seçenek tahmin edilmeyecek/);
  assert.doesNotMatch(ui,/\[["']low["'],["']medium["'],["']high["']/);
});

test("Gemini thinking level is sent only when metadata-selected thinking mode is configured",async()=>{
  const collected=[];
  const messages=[{role:"user",content:"ok"}];
  const fetcher=async(url,init)=>{
    collected.push({url,body:JSON.parse(init.body)});
    return {ok:true,text:async()=>JSON.stringify({modelVersion:"gemini-test",candidates:[{content:{parts:[{text:"ok"}]},finishReason:"STOP"}]})};
  };
  const endpoint="https://generativelanguage.googleapis.com/v1beta";
  await client.requestGeminiContent({endpoint,apiKey:"test-key",model:"gemini-test",
    reasoningMode:"thinkingLevel",reasoningEffort:"high"},messages,{fetcher});
  await client.requestGeminiContent({endpoint,apiKey:"test-key",model:"gemini-test"},messages,{fetcher});
  assert.deepEqual(collected[0].body.generationConfig.thinkingConfig,{thinkingLevel:"high"});
  assert.equal(collected[1].body.generationConfig.thinkingConfig,undefined);
});

test("Codex image generation uses image-specific effort, never selected text effort",async()=>{
  const aiCli=require("./ai-cli.cjs");
  let actual;
  const tinyPng=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRkkAAAAASUVORK5CYII=","base64").toString("base64");
  const image=await aiCli.requestImageGeneration({
    imageModel:"image-controller",reasoningEffort:"medium",imageReasoningEffort:"ultra",
  },"original picture",{command:"fake-codex",sessionRunner:async(options)=>{
    actual=options;return {item:{type:"imageGeneration",status:"completed",result:tinyPng},controllerModel:"image-controller"};
  }});
  assert.equal(actual.reasoningEffort,"ultra");
  assert.equal(image.extension,".png");
});
