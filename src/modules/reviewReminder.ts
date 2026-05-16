import { getOctokit } from "@actions/github";

export type ReminderPr = {
  title: string;
  url: string;
};

export type RawReminderEntry = {
  githubName: string;
  isTeam: boolean;
  prs: ReminderPr[];
};

export type ReminderEntry = RawReminderEntry & {
  slackId?: string;
};

export const fetchOpenReviewRequests = async (
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string
): Promise<RawReminderEntry[]> => {
  const prs = await octokit.paginate(octokit.rest.pulls.list, {
    owner,
    repo,
    state: "open",
    per_page: 100,
  });

  const userEntries = new Map<string, ReminderPr[]>();
  const teamEntries = new Map<string, ReminderPr[]>();

  const addPr = (map: Map<string, ReminderPr[]>, key: string | undefined, pr: ReminderPr) => {
    if (!key) return;
    const list = map.get(key) ?? [];
    list.push(pr);
    map.set(key, list);
  };

  for (const pr of prs) {
    if (pr.draft) continue;

    const item: ReminderPr = { title: pr.title, url: pr.html_url };

    for (const reviewer of pr.requested_reviewers ?? []) {
      addPr(userEntries, reviewer?.login, item);
    }

    for (const team of pr.requested_teams ?? []) {
      addPr(teamEntries, team?.name, item);
    }
  }

  const toEntries = (
    map: Map<string, ReminderPr[]>,
    isTeam: boolean
  ): RawReminderEntry[] =>
    [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([githubName, prs]) => ({ githubName, isTeam, prs }));

  return [...toEntries(userEntries, false), ...toEntries(teamEntries, true)];
};

export const buildReviewReminderMessage = (
  entries: ReminderEntry[],
  repoFullName: string
): string | null => {
  if (entries.length === 0) return null;

  const sections = entries.map((entry) => {
    const header = (() => {
      if (entry.slackId) {
        return entry.isTeam
          ? `<!subteam^${entry.slackId}>`
          : `<@${entry.slackId}>`;
      }
      return `\`${entry.githubName}\``;
    })();

    const lines = entry.prs.map((pr) => `  • <${pr.url}|${pr.title}>`);
    return [header, ...lines].join("\n");
  });

  return [
    `:eyes: Pending review reminders for \`${repoFullName}\`:`,
    "",
    sections.join("\n\n"),
  ].join("\n");
};
