import { warning } from "@actions/core";
import type { getOctokit } from "@actions/github";
import {
  buildSection,
  CONTINUATION_SUFFIX,
  formatIssueRef,
  SECTION_TEXT_LIMIT,
  type SlackPostPayload,
} from "./slack.js";

export type ApprovalState =
  | "approved"
  | "changes_requested"
  | "review_required";

export type ReminderPr = {
  number: number;
  title: string;
  url: string;
  author: string;
  createdAt: string;
  approvalState: ApprovalState;
  labels: string[];
};

export type RawReminderEntry = {
  githubName: string;
  isTeam: boolean;
  prs: ReminderPr[];
};

export type ReminderEntry = RawReminderEntry & {
  slackId?: string;
};

export type ReminderSlackPayload = SlackPostPayload;

type ReviewLike = {
  user?: { login?: string | null } | null;
  state?: string | null;
};

const APPROVAL_API_CONCURRENCY = 5;
const LABEL_DISPLAY_LIMIT = 5;

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
};

export const aggregateApprovalState = (
  reviews: ReviewLike[],
): ApprovalState => {
  const latestByReviewer = new Map<string, string>();
  for (const review of reviews) {
    const login = review.user?.login;
    const state = review.state;
    if (!login || !state) continue;
    if (state === "APPROVED" || state === "CHANGES_REQUESTED") {
      latestByReviewer.set(login, state);
    } else if (state === "DISMISSED") {
      // DISMISSED は過去の APPROVED / CHANGES_REQUESTED を無効化する
      latestByReviewer.delete(login);
    }
  }

  if (latestByReviewer.size === 0) return "review_required";
  for (const state of latestByReviewer.values()) {
    if (state === "CHANGES_REQUESTED") return "changes_requested";
  }
  return "approved";
};

export const formatRelativeAge = (createdAt: Date, now: Date): string => {
  const diffMs = now.getTime() - createdAt.getTime();
  if (diffMs < 0) return "just now";
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 1) return `${diffMin}m`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 1) return `${diffHour}h`;
  return `${diffDay}d`;
};

export const formatLabels = (labels: string[]): string => {
  if (labels.length === 0) return "";
  // ラベル名内のバックティックは Slack mrkdwn の inline code を破壊するため除去
  const shown = labels
    .slice(0, LABEL_DISPLAY_LIMIT)
    .map((l) => `\`${l.replace(/`/g, "")}\``);
  const overflow = labels.length - LABEL_DISPLAY_LIMIT;
  return overflow > 0
    ? `${shown.join(", ")}, +${overflow} more`
    : shown.join(", ");
};

const APPROVAL_DISPLAY: Record<
  ApprovalState,
  { emoji: string; label: string }
> = {
  approved: { emoji: ":white_check_mark:", label: "approved" },
  changes_requested: { emoji: ":warning:", label: "changes requested" },
  review_required: {
    emoji: ":hourglass_flowing_sand:",
    label: "review required",
  },
};

const buildPrLine = (
  pr: ReminderPr,
  repoShortName: string,
  now: Date,
): string => {
  const age = formatRelativeAge(new Date(pr.createdAt), now);
  const approval = APPROVAL_DISPLAY[pr.approvalState];
  const labelText = formatLabels(pr.labels);
  const refLink = `<${pr.url}|${formatIssueRef(repoShortName, pr.number, pr.title)}>`;
  const authorSuffix = pr.author ? ` (${pr.author})` : "";
  const metaParts = [`${age} old`, `${approval.emoji} ${approval.label}`];
  if (labelText) metaParts.push(labelText);
  const meta = `_${metaParts.join(" · ")}_`;
  return `• ${refLink}${authorSuffix}\n${meta}`;
};

const splitSectionByLimit = (header: string, prLines: string[]): string[] => {
  const sections: string[] = [];
  let current = header;
  let hasContent = false;
  for (const line of prLines) {
    const candidate = `${current}\n${line}`;
    if (hasContent && candidate.length > SECTION_TEXT_LIMIT) {
      sections.push(current);
      current = `${header}${CONTINUATION_SUFFIX}\n${line}`;
    } else {
      current = candidate;
    }
    hasContent = true;
  }
  sections.push(current);
  return sections;
};

export const fetchOpenReviewRequests = async (
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
): Promise<RawReminderEntry[]> => {
  const prs = await octokit.paginate(octokit.rest.pulls.list, {
    owner,
    repo,
    state: "open",
    per_page: 100,
  });

  const pendingPrs = prs.filter((pr) => {
    if (pr.draft) return false;
    const reviewerCount = (pr.requested_reviewers ?? []).length;
    const teamCount = (pr.requested_teams ?? []).length;
    return reviewerCount > 0 || teamCount > 0;
  });

  const enriched = await mapWithConcurrency(
    pendingPrs,
    APPROVAL_API_CONCURRENCY,
    async (pr) => {
      try {
        const { data } = await octokit.rest.pulls.listReviews({
          owner,
          repo,
          pull_number: pr.number,
        });
        const base = aggregateApprovalState(data as ReviewLike[]);
        // pendingPrs フィルタを通過した PR には必ず未レビューの reviewer が残るため、
        // 「全員 APPROVED」だけで approved を出すと、リマインドを受ける本人視点では
        // 自分の review がまだ残っているのに approved と表示されてしまう。
        const approvalState: ApprovalState =
          base === "approved" ? "review_required" : base;
        return { pr, approvalState };
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        warning(
          `Failed to fetch reviews for PR #${pr.number}: ${reason}. Falling back to review_required.`,
        );
        return { pr, approvalState: "review_required" as const };
      }
    },
  );

  const userEntries = new Map<string, ReminderPr[]>();
  const teamEntries = new Map<string, ReminderPr[]>();

  const addPr = (
    map: Map<string, ReminderPr[]>,
    key: string | undefined,
    pr: ReminderPr,
  ) => {
    if (!key) return;
    const list = map.get(key) ?? [];
    list.push(pr);
    map.set(key, list);
  };

  for (const { pr, approvalState } of enriched) {
    const item: ReminderPr = {
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      author: pr.user?.login ?? "",
      createdAt: pr.created_at,
      approvalState,
      labels: (pr.labels ?? []).flatMap((l: unknown) => {
        if (typeof l === "string") return [l];
        if (l && typeof l === "object" && "name" in l) {
          const name = (l as { name?: unknown }).name;
          if (typeof name === "string" && name.length > 0) return [name];
        }
        return [];
      }),
    };

    for (const reviewer of pr.requested_reviewers ?? []) {
      addPr(userEntries, reviewer?.login, item);
    }

    for (const team of pr.requested_teams ?? []) {
      addPr(teamEntries, team?.name, item);
    }
  }

  const toEntries = (
    map: Map<string, ReminderPr[]>,
    isTeam: boolean,
  ): RawReminderEntry[] =>
    [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([githubName, prs]) => ({ githubName, isTeam, prs }));

  return [...toEntries(userEntries, false), ...toEntries(teamEntries, true)];
};

const buildEntryHeader = (entry: ReminderEntry): string => {
  if (entry.slackId) {
    return entry.isTeam ? `<!subteam^${entry.slackId}>` : `<@${entry.slackId}>`;
  }
  return `\`${entry.githubName}\``;
};

export const buildReviewReminderMessage = (
  entries: ReminderEntry[],
  repoFullName: string,
  now: Date = new Date(),
): ReminderSlackPayload | null => {
  if (entries.length === 0) return null;

  const headerText = `:eyes: Reviews assigned to you on \`${repoFullName}\``;
  // owner/repo の短い側を `[repo#n]` のリンクテキストに使う (純正もリポジトリ短縮名)
  const repoShortName = repoFullName.split("/").pop() || repoFullName;

  const entryBlockTexts: string[] = [];
  const entryTextSections: string[] = [];

  for (const entry of entries) {
    const header = buildEntryHeader(entry);
    const prLines = entry.prs.map((pr) => buildPrLine(pr, repoShortName, now));
    entryTextSections.push([header, ...prLines].join("\n"));
    entryBlockTexts.push(...splitSectionByLimit(header, prLines));
  }

  const text = [headerText, "", entryTextSections.join("\n\n")].join("\n");

  const blocks: unknown[] = [buildSection(headerText), { type: "divider" }];
  for (const section of entryBlockTexts) {
    blocks.push(buildSection(section));
  }

  return { text, blocks, attachments: [] };
};
