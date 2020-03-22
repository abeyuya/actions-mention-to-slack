"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var core = require("@actions/core");
var github = require("@actions/github");
var yaml = require("js-yaml");
var axios_1 = require("axios");
var pickupUsername = function (text) {
    var pattern = /\B@[a-z0-9_-]+/gi;
    return text.match(pattern).map(function (username) { return username.replace("@", ""); });
};
// const testPickupUsername = () => {
//   const text = "@jpotts18 what is up man? Are you hanging out with @kyle_clegg";
//   const usernames = pickupUsername(text);
//   console.log(usernames);
//   if (
//     usernames.length === 2 &&
//     usernames[0] === "jpotts18" &&
//     usernames[1] === "kyle_clegg"
//   ) {
//     console.log("pass! testPickupUsername");
//   } else {
//     throw new Error(`fail! testPickupUsername: ${usernames}`);
//   }
// };
// testPickupUsername();
var pickupInfoFromGithubPayload = function (payload) {
    if (payload.action === "opened" && payload.issue) {
        return {
            body: payload.issue.body,
            title: payload.issue.title,
            url: payload.issue.html_url
        };
    }
    if (payload.action === "opened" && payload.pull_request) {
        return {
            body: payload.pull_request.body,
            title: payload.pull_request.title,
            url: payload.pull_request.html_url
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
    throw new Error("unknown event hook: " + JSON.stringify(payload, undefined, 2));
};
var buildSlackPostMessage = function (slackUsernamesForMention, issueTitle, commentLink, githubBody) {
    var mentionBlock = slackUsernamesForMention.map(function (n) { return "@" + n; }).join(" ");
    return [
        mentionBlock + " mentioned at <" + commentLink + "|" + issueTitle + ">",
        "> " + githubBody
    ].join("\n");
};
var postToSlack = function (webhookUrl, message) { return __awaiter(void 0, void 0, void 0, function () {
    var slackOption;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                slackOption = {
                    text: message,
                    link_names: 1,
                    username: "Github Mention To Slack",
                    icon_emoji: ":bell:"
                };
                return [4 /*yield*/, axios_1["default"].post(webhookUrl, JSON.stringify(slackOption), {
                        headers: { "Content-Type": "application/json" }
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
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
var loadNameMappingConfig = function (client, configurationPath) { return __awaiter(void 0, void 0, void 0, function () {
    var configurationContent, configObject;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, fetchContent(client, configurationPath)];
            case 1:
                configurationContent = _a.sent();
                configObject = yaml.safeLoad(configurationContent);
                return [2 /*return*/, configObject];
        }
    });
}); };
var fetchContent = function (client, repoPath) { return __awaiter(void 0, void 0, void 0, function () {
    var response;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, client.repos.getContents({
                    owner: github.context.repo.owner,
                    repo: github.context.repo.repo,
                    path: repoPath,
                    ref: github.context.sha
                })];
            case 1:
                response = _a.sent();
                return [2 /*return*/, Buffer.from(response.data.content, response.data.encoding).toString()];
        }
    });
}); };
var convertToSlackUsername = function (githubUsernames) { return __awaiter(void 0, void 0, void 0, function () {
    var token, configPath, githubClient, mapping, slackUsernames;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                token = core.getInput("repo-token", { required: true });
                configPath = core.getInput("configuration-path", { required: true });
                githubClient = new github.GitHub(token);
                return [4 /*yield*/, loadNameMappingConfig(githubClient, configPath)];
            case 1:
                mapping = _a.sent();
                slackUsernames = githubUsernames.map(function (githubUsername) {
                    // return github username if mapping does not exist.
                    return mapping[githubUsername] || githubUsername;
                });
                return [2 /*return*/, slackUsernames];
        }
    });
}); };
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var info, githubUsernames, slackUsernames, message, slackWebhookUrl, payload, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                info = pickupInfoFromGithubPayload(github.context.payload);
                githubUsernames = pickupUsername(info.body);
                return [4 /*yield*/, convertToSlackUsername(githubUsernames)];
            case 1:
                slackUsernames = _a.sent();
                message = buildSlackPostMessage(slackUsernames, info.title, info.url, info.body);
                slackWebhookUrl = core.getInput("slack-webhook-url", {
                    required: true
                });
                return [4 /*yield*/, postToSlack(slackWebhookUrl, message)];
            case 2:
                _a.sent();
                payload = JSON.stringify(github.context.payload, undefined, 2);
                console.log("The event payload: " + payload);
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                core.setFailed(error_1.message);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
main();
