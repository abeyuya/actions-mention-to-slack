"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const yaml = __importStar(require("js-yaml"));
const axios_1 = __importDefault(require("axios"));
const pickupUsername = (text) => {
    const pattern = /\B@[a-z0-9_-]+/gi;
    const hits = text.match(pattern);
    if (hits === null) {
        return [];
    }
    return hits.map(username => username.replace("@", ""));
};
// const testPickupUsername = () => {
//   const test1 = () => {
//     const text =
//       "@jpotts18 what is up man? Are you hanging out with @kyle_clegg";
//     const usernames = pickupUsername(text);
//     if (
//       usernames.length === 2 &&
//       usernames[0] === "jpotts18" &&
//       usernames[1] === "kyle_clegg"
//     ) {
//       console.log("pass! testPickupUsername.test1");
//     } else {
//       throw new Error(`fail! testPickupUsername.test1: ${usernames}`);
//     }
//   };
//   test1();
//   const test2 = () => {
//     const text = "no mention comment";
//     const usernames = pickupUsername(text);
//     if (usernames.length === 0) {
//       console.log("pass! testPickupUsername.test2");
//     } else {
//       throw new Error(`fail! testPickupUsername.test2: ${usernames}`);
//     }
//   };
//   test2();
// };
// testPickupUsername();
const pickupInfoFromGithubPayload = (payload) => {
    var _a;
    if (payload.action === "opened" && payload.issue) {
        return {
            body: payload.issue.body || "",
            title: payload.issue.title,
            url: payload.issue.html_url || ""
        };
    }
    if (payload.action === "opened" && payload.pull_request) {
        return {
            body: payload.pull_request.body || "",
            title: payload.pull_request.title,
            url: payload.pull_request.html_url || ""
        };
    }
    if (payload.action === "created" && payload.comment) {
        if (payload.issue) {
            return {
                body: payload.comment.body,
                title: payload.issue.title,
                url: payload.comment.html_url
            };
        }
        if (payload.pull_request) {
            return {
                body: payload.comment.body,
                title: payload.pull_request.title,
                url: payload.comment.html_url
            };
        }
    }
    if (payload.action === "submitted" && payload.review) {
        return {
            body: payload.review.body,
            title: ((_a = payload.pull_request) === null || _a === void 0 ? void 0 : _a.title) || "",
            url: payload.review.html_url
        };
    }
    throw new Error(`unknown event hook: ${JSON.stringify(payload, undefined, 2)}`);
};
const buildSlackPostMessage = (slackIdsForMention, issueTitle, commentLink, githubBody) => {
    const mentionBlock = slackIdsForMention.map(id => `<@${id}>`).join(" ");
    const body = githubBody
        .split("\n")
        .map(line => `> ${line}`)
        .join("\n");
    return [
        `${mentionBlock} mentioned at <${commentLink}|${issueTitle}>`,
        body
    ].join("\n");
};
const postToSlack = async (webhookUrl, message) => {
    const botName = (() => {
        const n = core.getInput("bot-name", { required: false });
        if (n && n !== "") {
            return n;
        }
        return "Github Mention To Slack";
    })();
    const slackOption = {
        text: message,
        link_names: 0,
        username: botName
    };
    const iconUrl = core.getInput("icon-url", { required: false });
    if (iconUrl && iconUrl !== "") {
        slackOption.icon_url = iconUrl;
    }
    else {
        slackOption.icon_emoji = ":bell:";
    }
    await axios_1.default.post(webhookUrl, JSON.stringify(slackOption), {
        headers: { "Content-Type": "application/json" }
    });
};
// const testPostToSlack = async () => {
//   const message = buildSlackPostMessage(
//     ["abeyuya"],
//     "title of issue here",
//     "https://google.com",
//     "pr comment dummy @abeyuya"
//   );
//   try {
//     await postToSlack(process.env.SLACK_WEBHOOK_URL, message);
//   } catch (e) {
//     console.error(e);
//   }
// };
// testPostToSlack();
const loadNameMappingConfig = async (client, configurationPath) => {
    const configurationContent = await fetchContent(client, configurationPath);
    const configObject = yaml.safeLoad(configurationContent);
    return configObject;
};
const fetchContent = async (client, repoPath) => {
    const response = await client.repos.getContents({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        path: repoPath,
        ref: github.context.sha
    });
    return Buffer.from(response.data.content, response.data.encoding).toString();
};
const convertToSlackUsername = async (githubUsernames) => {
    const token = core.getInput("repo-token", { required: true });
    const configPath = core.getInput("configuration-path", { required: true });
    const githubClient = new github.GitHub(token);
    const mapping = await loadNameMappingConfig(githubClient, configPath);
    const slackIds = githubUsernames
        .filter(githubUsername => mapping[githubUsername] !== undefined)
        .map(githubUsername => mapping[githubUsername]);
    return slackIds;
};
const execPrReviewRequestedMention = async (payload) => {
    var _a, _b, _c;
    const requestedGithubUsername = payload.requested_reviewer.login;
    const slackIds = await convertToSlackUsername([requestedGithubUsername]);
    if (slackIds.length === 0) {
        return;
    }
    const title = (_a = payload.pull_request) === null || _a === void 0 ? void 0 : _a.title;
    const url = (_b = payload.pull_request) === null || _b === void 0 ? void 0 : _b.html_url;
    const requestedSlackUserId = slackIds[0];
    const requestUsername = (_c = payload.sender) === null || _c === void 0 ? void 0 : _c.login;
    const message = `<@${requestedSlackUserId}> has been requested to review <${url}|${title}> by ${requestUsername}.`;
    const slackWebhookUrl = core.getInput("slack-webhook-url", {
        required: true
    });
    if (!slackWebhookUrl) {
        core.setFailed("Error! Need to set `slack-webhook-url` .");
        return;
    }
    await postToSlack(slackWebhookUrl, message);
};
const main = async () => {
    try {
        if (github.context.payload.action === "review_requested") {
            await execPrReviewRequestedMention(github.context.payload);
            return;
        }
        const info = pickupInfoFromGithubPayload(github.context.payload);
        const githubUsernames = pickupUsername(info.body);
        if (githubUsernames.length === 0) {
            return;
        }
        const slackIds = await convertToSlackUsername(githubUsernames);
        const message = buildSlackPostMessage(slackIds, info.title, info.url, info.body);
        const slackWebhookUrl = core.getInput("slack-webhook-url", {
            required: true
        });
        if (!slackWebhookUrl) {
            core.setFailed("Error! Need to set `slack-webhook-url` .");
            return;
        }
        await postToSlack(slackWebhookUrl, message);
    }
    catch (error) {
        core.setFailed(error.message);
    }
};
main();
//# sourceMappingURL=index.js.map