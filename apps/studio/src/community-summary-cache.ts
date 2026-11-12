/** Last observed community counts; reading this never makes a network request. */
export type CommunitySummary = {
  threads: number;
  posts: number;
  members: number | null;
  updatedAt: string;
};

const cacheKey = (projectId: string) => "channel-foundry:community-summary-v1:" + projectId;

export function readCommunitySummary(projectId: string): CommunitySummary | null {
  if (!projectId) return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(projectId));
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<CommunitySummary>;
    if (!Number.isInteger(data.threads) || !Number.isInteger(data.posts) ||
      (data.members != null && !Number.isInteger(data.members)) || typeof data.updatedAt !== "string") return null;
    return { threads: data.threads as number, posts: data.posts as number,
      members: data.members ?? null, updatedAt: data.updatedAt };
  } catch { return null; }
}

export function saveCommunitySummary(projectId: string, data: { threads: number; posts: number; members?: number }): void {
  if (!projectId) return;
  try {
    const previous = readCommunitySummary(projectId);
    const snapshot: CommunitySummary = {
      threads: data.threads, posts: data.posts,
      members: data.members ?? previous?.members ?? null,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(cacheKey(projectId), JSON.stringify(snapshot));
  } catch { /* Storage may be disabled; the console itself continues to work. */ }
}
