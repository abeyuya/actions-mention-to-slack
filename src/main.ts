import * as core from "@actions/core";
import { context } from "@actions/github";
import { WebhookPayload } from "@actions/github/lib/interfaces";

import {
  pickupUsername,
  pickupInfoFromGithubPayload,
  needToSendApproveMention,
} from "./modules/github";
import {
  buildSlackPostMessage,
  buildSlackErrorMessage,
  SlackRepositoryImpl,
  convertGithubTextToBlockquotesText,
} from "./modules/slack";
import {
  MappingConfigRepositoryImpl,
  isUrl,
  MappingFile,
} from "./modules/mappingConfig";

export type AllInputs = {
  repoToken: string;
  configurationPath: string;
  slackWebhookUrl: string;
  iconUrl?: string;
  botName?: string;
  runId?: string;
};

export const arrayDiff = <T>(arr1: T[], arr2: T[]) =>
  arr1.filter((i) => arr2.indexOf(i) === -1);

export const convertToSlackUsername = (
  githubUsernames: string[],
  mapping: MappingFile
): string[] => {
  core.debug(JSON.stringify({ githubUsernames }, null, 2));

  const slackIds = githubUsernames
    .map((githubUsername) => mapping[githubUsername])
    .filter((slackId) => slackId !== undefined) as string[];

  core.debug(JSON.stringify({ slackIds }, null, 2));

  return slackIds;
};

const getSlackMention = (requestedSlackUserId: string, requestedSlackUserGroupId: string): string => {
  if (requestedSlackUserId) {
    return `<@${requestedSlackUserId}>`;
  }

  return `<!subteam^${requestedSlackUserGroupId}>`
}

export const execPrReviewRequestedMention = async (
  payload: WebhookPayload,
  allInputs: AllInputs,
  mapping: MappingFile,
  slackClient: Pick<typeof SlackRepositoryImpl, "postToSlack">
): Promise<void> => {
  const requestedGithubUsername = payload.requested_reviewer?.login;
  const requestedGithubTeam = payload.requested_team?.name;

  if (!requestedGithubUsername && !requestedGithubTeam) {
    throw new Error("Can not find review requested user or team.");
  }
  
  const slackUserIds = convertToSlackUsername([requestedGithubUsername], mapping);
  const slackUserGroupIds = convertToSlackUsername([requestedGithubTeam], mapping);

  if (slackUserIds.length === 0 && slackUserGroupIds.length === 0) {
    core.debug(
      "finish execPrReviewRequestedMention because slackUserIds and slackUserGroupIds length === 0"
    );
    return;
  }

  const title = payload.pull_request?.title;
  const url = payload.pull_request?.html_url;
  const requestUsername = payload.sender?.login;

  const slackMention = getSlackMention(slackUserIds[0], slackUserGroupIds[0]);
  const message = `${slackMention} has been requested to review <${url}|${title}> by ${requestUsername}.`
  const { slackWebhookUrl, iconUrl, botName } = allInputs;

  await slackClient.postToSlack(slackWebhookUrl, message, { iconUrl, botName });
};

export const execNormalMention = async (
  payload: WebhookPayload,
  allInputs: AllInputs,
  mapping: MappingFile,
  slackClient: Pick<typeof SlackRepositoryImpl, "postToSlack">,
  ignoreSlackIds: string[]
): Promise<void> => {
  const info = pickupInfoFromGithubPayload(payload);

  if (info.body === null) {
    core.debug("finish execNormalMention because info.body === null");
    return;
  }

  const githubUsernames = pickupUsername(info.body);
  if (githubUsernames.length === 0) {
    core.debug("finish execNormalMention because githubUsernames.length === 0");
    return;
  }

  const slackIds = convertToSlackUsername(githubUsernames, mapping);
  const slackIdsWithoutIgnore = arrayDiff(slackIds, ignoreSlackIds);

  if (slackIdsWithoutIgnore.length === 0) {
    core.debug("finish execNormalMention because slackIds.length === 0");
    return;
  }

  const message = buildSlackPostMessage(
    slackIdsWithoutIgnore,
    info.title,
    info.url,
    info.body,
    info.senderName
  );

  const { slackWebhookUrl, iconUrl, botName } = allInputs;

  const result = await slackClient.postToSlack(slackWebhookUrl, message, {
    iconUrl,
    botName,
  });

  core.debug(
    ["postToSlack result", JSON.stringify({ result }, null, 2)].join("\n")
  );
};

export const execApproveMention = async (
  payload: WebhookPayload,
  allInputs: AllInputs,
  mapping: MappingFile,
  slackClient: Pick<typeof SlackRepositoryImpl, "postToSlack">
): Promise<string | null> => {
  if (!needToSendApproveMention(payload)) {
    throw new Error("failed to parse payload");
  }

  const prOwnerGithubUsername = payload.pull_request?.user?.login;

  if (!prOwnerGithubUsername) {
    throw new Error("Can not find pr owner user.");
  }

  const slackIds = convertToSlackUsername([prOwnerGithubUsername], mapping);

  if (slackIds.length === 0) {
    core.debug("finish execApproveMention because slackIds.length === 0");
    return null;
  }

  const info = pickupInfoFromGithubPayload(payload);
  const prOwnerSlackUserId = slackIds[0];
  const approveOwner = payload.sender?.login;

  const blockquotesApproveMessage = convertGithubTextToBlockquotesText(
    info.body || ""
  );

  const message = [
    `<@${prOwnerSlackUserId}> has been approved <${info.url}|${info.title}> by ${approveOwner}.`,
    blockquotesApproveMessage,
  ].join("\n");
  const { slackWebhookUrl, iconUrl, botName } = allInputs;

  const postSlackResult = await slackClient.postToSlack(
    slackWebhookUrl,
    message,
    { iconUrl, botName }
  );

  core.debug(
    ["postToSlack result", JSON.stringify({ postSlackResult }, null, 2)].join(
      "\n"
    )
  );

  return prOwnerSlackUserId;
};

const buildCurrentJobUrl = (runId: string) => {
  const { owner, repo } = context.repo;
  return `https://github.com/${owner}/${repo}/actions/runs/${runId}`;
};

export const execPostError = async (
  error: Error,
  allInputs: AllInputs,
  slackClient: typeof SlackRepositoryImpl
): Promise<void> => {
  const { runId } = allInputs;
  const currentJobUrl = runId ? buildCurrentJobUrl(runId) : undefined;
  const message = buildSlackErrorMessage(error, currentJobUrl);

  core.warning(message);

  const { slackWebhookUrl, iconUrl, botName } = allInputs;

  await slackClient.postToSlack(slackWebhookUrl, message, { iconUrl, botName });
};

const getAllInputs = (): AllInputs => {
  const slackWebhookUrl = core.getInput("slack-webhook-url", {
    required: true,
  });

  if (!slackWebhookUrl) {
    core.setFailed("Error! Need to set `slack-webhook-url`.");
  }

  const repoToken = core.getInput("repo-token", { required: true });
  if (!repoToken) {
    core.setFailed("Error! Need to set `repo-token`.");
  }

  const iconUrl = core.getInput("icon-url", { required: false });
  const botName = core.getInput("bot-name", { required: false });
  const configurationPath = core.getInput("configuration-path", {
    required: true,
  });
  const runId = core.getInput("run-id", { required: false });

  return {
    repoToken,
    configurationPath,
    slackWebhookUrl,
    iconUrl,
    botName,
    runId,
  };
};

export const main = async (): Promise<void> => {
  core.debug("start main()");

  const { payload } = context;
  core.debug(JSON.stringify({ payload }, null, 2));

  const allInputs = getAllInputs();
  core.debug(JSON.stringify({ allInputs }, null, 2));

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
        context.sha
      );
    })();

    core.debug(JSON.stringify({ mapping }, null, 2));

    if (payload.action === "review_requested") {
      await execPrReviewRequestedMention(
        payload,
        allInputs,
        mapping,
        SlackRepositoryImpl
      );
      core.debug("finish execPrReviewRequestedMention()");
      return;
    }

    const ignoreSlackIds: string[] = [];

    if (needToSendApproveMention(payload)) {
      const sentSlackUserId = await execApproveMention(
        payload,
        allInputs,
        mapping,
        SlackRepositoryImpl
      );

      if (sentSlackUserId) {
        ignoreSlackIds.push(sentSlackUserId);
      }

      core.debug(
        [
          "execApproveMention()",
          JSON.stringify({ sentSlackUserId }, null, 2),
        ].join("\n")
      );
    }

    await execNormalMention(
      payload,
      allInputs,
      mapping,
      SlackRepositoryImpl,
      ignoreSlackIds
    );
    core.debug("finish execNormalMention()");
  } catch (error: any) {
    await execPostError(error, allInputs, SlackRepositoryImpl);
    core.warning(JSON.stringify({ payload }, null, 2));
  }
};
