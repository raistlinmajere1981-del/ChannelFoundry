const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const store = require("./transcript-store.cjs");
const ytDlp = require("./ytdlp-manager.cjs");
const youtubeCatalogStore = require("./youtube-catalog-store.cjs");
const ignored = require("./youtube-transcript-ignore.cjs");

const execFileAsync = promisify(execFile);

async function ytDlpStatus() {
  return ytDlp.status();
}

function decodeEntities(text) {
  return String(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)));
}

function vttToPlainText(raw) {
  const lines = String(raw ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  let previous = "";
  for (let line of lines) {
    line = line.trim();
    if (!line || line === "WEBVTT" || /^NOTE(?:\s|$)/.test(line)) continue;
    if (/^\d+$/.test(line)) continue;
    if (/^\d{2}:\d{2}(?::\d{2})?[.,]\d{3}\s+-->/.test(line) || /-->/.test(line)) continue;
    if (/^(Kind|Language):/i.test(line)) continue;
    line = decodeEntities(line.replace(/<[^>]+>/g, "").replace(/\s+/g, " ")).trim();
    if (!line || line === previous) continue;
    output.push(line);
    previous = line;
  }
  return output.join("\n").trim();
}

function languageFromFilename(filename) {
  const match = String(filename).match(/\.([a-z]{2,3}(?:-[A-Za-z0-9]+)?)\.vtt$/i);
  return match?.[1] ?? "";
}

function chooseSubtitleFile(files, languages = ytDlp.mediaOptions().subtitleLanguages) {
  const vtt = files.filter((file) => file.toLowerCase().endsWith(".vtt"));
  const score = (name) => {
    const language = languageFromFilename(name).toLowerCase();
    const index = languages.map((item) => item.toLowerCase()).indexOf(language);
    return index < 0 ? languages.length : index;
  };
  return vtt.sort((a, b) => score(a) - score(b) || a.localeCompare(b))[0] ?? null;
}

function clearSubtitleFiles(directory) {
  for (const file of fs.readdirSync(directory)) {
    if (file.toLowerCase().endsWith(".vtt")) fs.rmSync(path.join(directory, file), { force: true });
  }
}

function subtitleAttemptArgs({ outputTemplate, url, automatic, languages = ytDlp.mediaOptions().subtitleLanguages }) {
  return [
    "--skip-download",
    automatic ? "--write-auto-subs" : "--write-subs",
    "--sub-langs", languages.join(","),
    "--sub-format", "vtt/best",
    "--output", outputTemplate,
    String(url),
  ];
}

function throwIfArchiveCanceled(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Altyazı arşivleme iptal edildi.");
  error.code = "CHANNEL_FOUNDRY_ARCHIVE_CANCELLED";
  throw error;
}

async function runSubtitleAttempt(directory, outputTemplate, url, automatic, languages, signal) {
  throwIfArchiveCanceled(signal);
  clearSubtitleFiles(directory);
  try {
    const result = await execFileAsync(ytDlp.executablePath(), subtitleAttemptArgs({ outputTemplate, url, automatic, languages }), {
      timeout: 180000,
      signal,
      maxBuffer: 8 * 1024 * 1024,
    });
    throwIfArchiveCanceled(signal);
    const selected = chooseSubtitleFile(fs.readdirSync(directory), languages);
    return { selected, automatic, stdout: String(result.stdout ?? ""), stderr: String(result.stderr ?? ""), error: null };
  } catch (error) {
    throwIfArchiveCanceled(signal);
    const selected = chooseSubtitleFile(fs.readdirSync(directory), languages);
    return {
      selected,
      automatic,
      stdout: String(error?.stdout ?? ""),
      stderr: String(error?.stderr ?? ""),
      error,
    };
  }
}

function subtitleFailureMessage(attempts) {
  const combined = attempts.map((attempt) => `${attempt.stderr}\n${attempt.stdout}\n${attempt.error?.message ?? ""}`).join("\n");
  if (/HTTP Error 429|Too Many Requests/i.test(combined)) {
    return "YouTube altyazı isteğini geçici olarak 429 (Too Many Requests) ile sınırladı. Studio otomatik çeviri altyazılarını istemiyor; buna rağmen 429 sürüyorsa biraz sonra tekrar dene. Gerekirse sonraki adımda tarayıcı oturum çerezlerini yalnız yerel yt-dlp çağrısında kullanacak bir seçenek ekleyebiliriz.";
  }
  const detail = combined.trim().slice(0, 900);
  return detail
    ? `YouTube altyazısı alınamadı. Manuel ve videonun kendi dilindeki otomatik altyazılar denendi. ${detail}`
    : "Bu video için kanal tercihlerindeki dillerde manuel veya otomatik altyazı bulunamadı.";
}

function resolveYoutubeTarget(db, input) {
  const contentKey = String(input?.contentKey ?? "").trim();
  const requestedVideoId = String(input?.videoId ?? "").trim();
  if (contentKey && store.tableExists(db, "content_sources")) {
    const source = db.prepare(`
      SELECT external_id AS videoId, canonical_url AS canonicalUrl
      FROM content_sources WHERE content_key = ? AND provider = 'youtube'
    `).get(contentKey);
    if (source) {
      const channelId = store.tableExists(db, "youtube_videos")
        ? db.prepare("SELECT channel_id AS channelId FROM youtube_videos WHERE video_id = ?").get(source.videoId)?.channelId ?? ""
        : "";
      return { contentKey, videoId: source.videoId, canonicalUrl: source.canonicalUrl, channelId };
    }
  }
  if (requestedVideoId && store.tableExists(db, "youtube_videos")) {
    const source = db.prepare(`
      SELECT video_id AS videoId, canonical_url AS canonicalUrl, channel_id AS channelId
      FROM youtube_videos WHERE video_id = ?
    `).get(requestedVideoId);
    if (source) {
      const mappedContentKey = store.tableExists(db, "content_sources")
        ? db.prepare("SELECT content_key AS contentKey FROM content_sources WHERE provider = 'youtube' AND external_id = ?").get(requestedVideoId)?.contentKey ?? ""
        : "";
      return { contentKey: mappedContentKey, videoId: source.videoId, canonicalUrl: source.canonicalUrl, channelId: source.channelId };
    }
  }
  throw new Error(contentKey ? "Bu kayıt bir YouTube kaynağına bağlı değil." : "Video yerel YouTube kataloğunda bulunamadı.");
}

function subtitleLanguagesForTarget(db, target) {
  const fallback = ytDlp.mediaOptions();
  if (!target?.channelId) return [...fallback.subtitleLanguages];
  const options = youtubeCatalogStore.channelMediaOptions(db, target.channelId, fallback);
  return options?.subtitleLanguages?.length ? [...options.subtitleLanguages] : [...fallback.subtitleLanguages];
}

async function fetchYoutubeTranscript(db, input, { signal } = {}) {
  throwIfArchiveCanceled(signal);
  store.ensureSchema(db);
  const target = resolveYoutubeTarget(db, input);
  const languages = subtitleLanguagesForTarget(db, target);
  if (ignored.isIgnored(db, target.videoId, languages)) {
    const error = new Error("Bu video seçili altyazı dilleri için eksik altyazı listesinde. Yeniden denemek için önce hariç tutma kaydını kaldır.");
    error.code = "CHANNEL_FOUNDRY_SUBTITLE_IGNORED";
    throw error;
  }
  const status = await ytDlpStatus();
  throwIfArchiveCanceled(signal);
  if (!status.available) {
    throw new Error("YouTube altyazısını otomatik almak için yt-dlp kurulu olmalı. İstersen transkripti elle de yapıştırabilirsin.");
  }

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "channel-foundry-transcript-"));
  try {
    const outputTemplate = path.join(tempDirectory, "%(id)s.%(ext)s");
    const attempts = [];
    // Avoid wildcard languages: auto-translated composite keys can trigger HTTP 429.
    attempts.push(await runSubtitleAttempt(tempDirectory, outputTemplate, target.canonicalUrl, false, languages, signal));
    let successful = attempts.find((attempt) => attempt.selected);
    if (!successful) {
      attempts.push(await runSubtitleAttempt(tempDirectory, outputTemplate, target.canonicalUrl, true, languages, signal));
      successful = attempts.find((attempt) => attempt.selected);
    }
    throwIfArchiveCanceled(signal);
    if (!successful?.selected) {
      // Only two successful yt-dlp commands with no subtitles are definitive.
      // Never ignore temporary limits, authentication or network errors.
      if (attempts.length === 2 && attempts.every((attempt) => !attempt.error)) {
        ignored.mark(db, target.videoId, languages);
        const missing = new Error("Bu video için seçili dillerde manuel veya otomatik altyazı bulunamadı. Eksik altyazılar listesine eklendi.");
        missing.code = "CHANNEL_FOUNDRY_SUBTITLE_UNAVAILABLE";
        throw missing;
      }
      throw new Error(subtitleFailureMessage(attempts));
    }

    const selected = successful.selected;
    const raw = fs.readFileSync(path.join(tempDirectory, selected), "utf8");
    const text = vttToPlainText(raw);
    if (!text) throw new Error("Altyazı dosyası alındı ancak okunabilir transkript üretilemedi.");
    const language = languageFromFilename(selected);
    throwIfArchiveCanceled(signal);
    const transcript = store.saveSourceTranscript(db, {
      videoId: target.videoId,
      source: "youtube",
      language,
      text,
    });
    if (target.contentKey) {
      store.saveTranscript(db, { contentKey: target.contentKey, source: "youtube", language, text });
    }
    ignored.clear(db, target.videoId);
    return {
      ...transcript,
      contentKey: target.contentKey || target.videoId,
      videoId: target.videoId,
      ytDlpVersion: status.version,
      filename: selected,
      captionType: successful.automatic ? "automatic" : "manual",
    };
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

module.exports = {
  chooseSubtitleFile,
  fetchYoutubeTranscript,
  resolveYoutubeTarget,
  subtitleAttemptArgs,
  subtitleFailureMessage,
  subtitleLanguagesForTarget,
  vttToPlainText,
  ytDlpStatus,
  runSubtitleAttempt,
  throwIfArchiveCanceled,
};
