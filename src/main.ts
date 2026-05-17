import { debug, getInput, setFailed, warning } from "@actions/core";
import { context, getOctokit } from "@actions/github";

import {
  isSupportedEvent,
  needToSendReviewSubmittedMention,
  pickupInfoFromGithubPayload,
  pickupUsername,
} from "./modules/github.js";
import {
  isUrl,
  MappingConfigRepositoryImpl,
  type MappingFile,
} from "./modules/mappingConfig.js";
import {
  buildReviewReminderMessage,
  fetchOpenReviewRequests,
  type ReminderEntry,
} from "./modules/reviewReminder.js";
import {
  buildSlackErrorMessage,
  buildSlackPostMessage,
  convertGithubTextToBlockquotesText,
  SlackRepositoryImpl,
} from "./modules/slack.js";

export type ActionType = "realtime-alert" | "scheduled-reminder";
export type AllInputs = {
  repoToken: string;
  configurationPath: string;
  slackWebhookUrl: string;
  iconUrl?: string;
  botName?: string;
  runId?: string;
  type?: ActionType;
};

export const arrayDiff = <T>(arr1: T[], arr2: T[]) =>
  arr1.filter((i) => arr2.indexOf(i) === -1);

export const convertToSlackUsername = (
  githubUsernames: string[],
  mapping: MappingFile,
): string[] => {
  debug(JSON.stringify({ githubUsernames }, null, 2));

  const slackIds = githubUsernames
    .map((githubUsername) => mapping[githubUsername])
    .filter((slackId) => slackId !== undefined) as string[];

  debug(JSON.stringify({ slackIds }, null, 2));

  return slackIds;
};

const getSlackMention = (
  requestedSlackUserId: string,
  requestedSlackUserGroupId: string,
): string => {
  if (requestedSlackUserId) {
    return `<@${requestedSlackUserId}>`;
  }

  return `<!subteam^${requestedSlackUserGroupId}>`;
};

export const execPrReviewRequestedMention = async (
  payload: typeof context.payload,
  allInputs: AllInputs,
  mapping: MappingFile,
  slackClient: Pick<typeof SlackRepositoryImpl, "postToSlack">,
): Promise<void> => {
  const requestedGithubUsername = payload.requested_reviewer?.login;
  const requestedGithubTeam = payload.requested_team?.name;

  if (!requestedGithubUsername && !requestedGithubTeam) {
    throw new Error("Can not find review requested user or team.");
  }

  const slackUserIds = convertToSlackUsername(
    [requestedGithubUsername],
    mapping,
  );
  const slackUserGroupIds = convertToSlackUsername(
    [requestedGithubTeam],
    mapping,
  );

  if (slackUserIds.length === 0 && slackUserGroupIds.length === 0) {
    debug(
      "finish execPrReviewRequestedMention because slackUserIds and slackUserGroupIds length === 0",
    );
    return;
  }

  const title = payload.pull_request?.title;
  const url = payload.pull_request?.html_url;
  const repoName = payload.repository?.full_name;
  const requestUsername = payload.sender?.login;

  const slackMention = getSlackMention(slackUserIds[0], slackUserGroupIds[0]);
  const message = `${slackMention} has been requested to review <${url}|${title}> by ${requestUsername} on ${repoName}.`;
  const { slackWebhookUrl, iconUrl, botName } = allInputs;

  await slackClient.postToSlack(slackWebhookUrl, message, { iconUrl, botName });
};

export const execNormalMention = async (
  payload: typeof context.payload,
  allInputs: AllInputs,
  mapping: MappingFile,
  slackClient: Pick<typeof SlackRepositoryImpl, "postToSlack">,
  ignoreSlackIds: string[],
): Promise<void> => {
  if (!isSupportedEvent(payload)) {
    debug("finish execNormalMention because event is not supported");
    return;
  }

  const info = pickupInfoFromGithubPayload(payload);

  if (info.body === null) {
    debug("finish execNormalMention because info.body === null");
    return;
  }

  const githubUsernames = pickupUsername(info.body);
  if (githubUsernames.length === 0) {
    debug("finish execNormalMention because githubUsernames.length === 0");
    return;
  }

  const slackIds = convertToSlackUsername(githubUsernames, mapping);
  const slackIdsWithoutIgnore = arrayDiff(slackIds, ignoreSlackIds);

  if (slackIdsWithoutIgnore.length === 0) {
    debug("finish execNormalMention because slackIds.length === 0");
    return;
  }

  const message = buildSlackPostMessage(
    slackIdsWithoutIgnore,
    info.title,
    info.url,
    info.body,
    info.senderName,
  );

  const { slackWebhookUrl, iconUrl, botName } = allInputs;

  const result = await slackClient.postToSlack(slackWebhookUrl, message, {
    iconUrl,
    botName,
  });

  debug(["postToSlack result", JSON.stringify({ result }, null, 2)].join("\n"));
};

export const execReviewSubmittedMention = async (
  payload: typeof context.payload,
  allInputs: AllInputs,
  mapping: MappingFile,
  slackClient: Pick<typeof SlackRepositoryImpl, "postToSlack">,
): Promise<string | null> => {
  if (!needToSendReviewSubmittedMention(payload)) {
    throw new Error("failed to parse payload");
  }

  if (!isSupportedEvent(payload)) {
    debug("finish execReviewSubmittedMention because event is not supported");
    return null;
  }

  const prOwnerGithubUsername = payload.pull_request?.user?.login;

  if (!prOwnerGithubUsername) {
    throw new Error("Can not find pr owner user.");
  }

  const slackIds = convertToSlackUsername([prOwnerGithubUsername], mapping);

  if (slackIds.length === 0) {
    debug("finish execReviewSubmittedMention because slackIds.length === 0");
    return null;
  }

  const info = pickupInfoFromGithubPayload(payload);
  const prOwnerSlackUserId = slackIds[0];
  const reviewer = payload.sender?.login;
  const reviewState = payload.review?.state;

  if (reviewer === prOwnerGithubUsername) {
    debug("skip slack post because the reviewer is the PR author");
    return null;
  }

  const blockquotesReviewBody = convertGithubTextToBlockquotesText(
    info.body || "",
  );

  const prLink = `<${info.url}|${info.title}>`;
  const userMention = `<@${prOwnerSlackUserId}>`;
  const headline = (() => {
    switch (reviewState) {
      case "approved":
        return `${userMention} has been approved ${prLink} by ${reviewer}.`;
      case "changes_requested":
        return `${userMention} has been requested changes on ${prLink} by ${reviewer}.`;
      default:
        return `${userMention} has received a review comment on ${prLink} by ${reviewer}.`;
    }
  })();

  const message = [headline, blockquotesReviewBody].join("\n");
  const { slackWebhookUrl, iconUrl, botName } = allInputs;

  const postSlackResult = await slackClient.postToSlack(
    slackWebhookUrl,
    message,
    { iconUrl, botName },
  );

  debug(
    ["postToSlack result", JSON.stringify({ postSlackResult }, null, 2)].join(
      "\n",
    ),
  );

  return prOwnerSlackUserId;
};

export const execReviewReminder = async (
  allInputs: AllInputs,
  mapping: MappingFile,
  slackClient: Pick<typeof SlackRepositoryImpl, "postToSlack">,
  octokit: ReturnType<typeof getOctokit>,
  owner: string,
  repo: string,
): Promise<void> => {
  const raw = await fetchOpenReviewRequests(octokit, owner, repo);

  const entries: ReminderEntry[] = raw.map((r) => ({
    ...r,
    slackId: mapping[r.githubName],
  }));

  const payload = buildReviewReminderMessage(entries, `${owner}/${repo}`);
  if (!payload) {
    debug("finish execReviewReminder because no pending reviews");
    return;
  }

  const { slackWebhookUrl, iconUrl, botName } = allInputs;
  await slackClient.postToSlack(slackWebhookUrl, payload.text, {
    iconUrl,
    botName,
    blocks: payload.blocks,
  });
};

const buildCurrentJobUrl = (runId: string) => {
  const { owner, repo } = context.repo;
  return `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
};

export const execPostError = async (
  error: Error,
  allInputs: AllInputs,
  slackClient: typeof SlackRepositoryImpl,
): Promise<void> => {
  const { runId } = allInputs;
  const currentJobUrl = runId ? buildCurrentJobUrl(runId) : undefined;
  const message = buildSlackErrorMessage(error, currentJobUrl);

  warning(message);

  const { slackWebhookUrl, iconUrl, botName } = allInputs;

  try {
    await slackClient.postToSlack(slackWebhookUrl, message, {
      iconUrl,
      botName,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    warning(`Failed to post error to Slack: ${reason}`);
  }
};

const getAllInputs = (): AllInputs => {
  const slackWebhookUrl = getInput("slack-webhook-url", {
    required: true,
  });

  if (!slackWebhookUrl) {
    setFailed("Error! Need to set `slack-webhook-url`.");
  }

  const repoToken = getInput("repo-token", { required: true });
  if (!repoToken) {
    setFailed("Error! Need to set `repo-token`.");
  }

  const iconUrl = getInput("icon-url", { required: false });
  const botName = getInput("bot-name", { required: false });
  const configurationPath = getInput("configuration-path", {
    required: true,
  });
  const runId = getInput("run-id", { required: false });
  const rawType = getInput("type", { required: false });
  const type: ActionType | undefined =
    rawType === "realtime-alert" || rawType === "scheduled-reminder"
      ? rawType
      : undefined;

  return {
    repoToken,
    configurationPath,
    slackWebhookUrl,
    iconUrl,
    botName,
    runId,
    type,
  };
};

export const main = async (): Promise<void> => {
  debug("start main()");

  const { payload } = context;
  debug(JSON.stringify({ payload }, null, 2));

  const allInputs = getAllInputs();
  debug(JSON.stringify({ allInputs }, null, 2));

  const { repoToken, configurationPath } = allInputs;

  try {
    const mapping = await (async () => {
      if (isUrl(configurationPath)) {
        return MappingConfigRepositoryImpl.loadFromUrl(configurationPath);
      }

      return MappingConfigRepositoryImpl.loadFromGithubPath(
        repoToken,
        context.repo.owner,
        context.repo.repo,
        configurationPath,
        context.sha,
      );
    })();

    debug(JSON.stringify({ mapping }, null, 2));

    if (allInputs.type === "scheduled-reminder") {
      await execReviewReminder(
        allInputs,
        mapping,
        SlackRepositoryImpl,
        getOctokit(repoToken),
        context.repo.owner,
        context.repo.repo,
      );
      debug("finish execReviewReminder()");
      return;
    }

    if (payload.action === "review_requested") {
      await execPrReviewRequestedMention(
        payload,
        allInputs,
        mapping,
        SlackRepositoryImpl,
      );
      debug("finish execPrReviewRequestedMention()");
      return;
    }

    const ignoreSlackIds: string[] = [];

    if (needToSendReviewSubmittedMention(payload)) {
      const sentSlackUserId = await execReviewSubmittedMention(
        payload,
        allInputs,
        mapping,
        SlackRepositoryImpl,
      );

      if (sentSlackUserId) {
        ignoreSlackIds.push(sentSlackUserId);
      }

      debug(
        [
          "execReviewSubmittedMention()",
          JSON.stringify({ sentSlackUserId }, null, 2),
        ].join("\n"),
      );
    }

    await execNormalMention(
      payload,
      allInputs,
      mapping,
      SlackRepositoryImpl,
      ignoreSlackIds,
    );
    debug("finish execNormalMention()");
  } catch (error: unknown) {
    await execPostError(error as Error, allInputs, SlackRepositoryImpl);
    warning(JSON.stringify({ payload }, null, 2));
  }
};
