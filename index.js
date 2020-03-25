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
    var hits = text.match(pattern);
    if (hits === null) {
        return [];
    }
    return hits.map(function (username) { return username.replace("@", ""); });
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
var pickupInfoFromGithubPayload = function (payload) {
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
    throw new Error("unknown event hook: " + JSON.stringify(payload, undefined, 2));
};
var buildSlackPostMessage = function (slackIdsForMention, issueTitle, commentLink, githubBody) {
    var mentionBlock = slackIdsForMention.map(function (id) { return "<@" + id + ">"; }).join(" ");
    var body = githubBody
        .split("\n")
        .map(function (line) { return "> " + line; })
        .join("\n");
    return [
        mentionBlock + " mentioned at <" + commentLink + "|" + issueTitle + ">",
        body
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
    var token, configPath, githubClient, mapping, slackIds;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                token = core.getInput("repo-token", { required: true });
                configPath = core.getInput("configuration-path", { required: true });
                githubClient = new github.GitHub(token);
                return [4 /*yield*/, loadNameMappingConfig(githubClient, configPath)];
            case 1:
                mapping = _a.sent();
                slackIds = githubUsernames
                    .filter(function (githubUsername) { return mapping[githubUsername] !== undefined; })
                    .map(function (githubUsername) { return mapping[githubUsername]; });
                return [2 /*return*/, slackIds];
        }
    });
}); };
var execPrReviewRequestedMention = function (payload) { return __awaiter(void 0, void 0, void 0, function () {
    var requestedGithubUsername, slackIds, title, url, requestedSlackUserId, requestUsername, message, slackWebhookUrl;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                requestedGithubUsername = payload.requested_reviewer.login;
                return [4 /*yield*/, convertToSlackUsername([requestedGithubUsername])];
            case 1:
                slackIds = _d.sent();
                if (slackIds.length === 0) {
                    return [2 /*return*/];
                }
                title = (_a = payload.pull_request) === null || _a === void 0 ? void 0 : _a.title;
                url = (_b = payload.pull_request) === null || _b === void 0 ? void 0 : _b.html_url;
                requestedSlackUserId = slackIds[0];
                requestUsername = (_c = payload.sender) === null || _c === void 0 ? void 0 : _c.login;
                message = "<@" + requestedSlackUserId + "> has been requested to review <" + url + "|" + title + "> by " + requestUsername + ".";
                slackWebhookUrl = core.getInput("slack-webhook-url", {
                    required: true
                });
                if (!slackWebhookUrl) {
                    core.setFailed("Error! Need to set `slack-webhook-url` .");
                    return [2 /*return*/];
                }
                return [4 /*yield*/, postToSlack(slackWebhookUrl, message)];
            case 2:
                _d.sent();
                return [2 /*return*/];
        }
    });
}); };
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var info, githubUsernames, slackIds, message, slackWebhookUrl, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 5, , 6]);
                if (!(github.context.payload.action === "review_requested")) return [3 /*break*/, 2];
                return [4 /*yield*/, execPrReviewRequestedMention(github.context.payload)];
            case 1:
                _a.sent();
                return [2 /*return*/];
            case 2:
                info = pickupInfoFromGithubPayload(github.context.payload);
                githubUsernames = pickupUsername(info.body);
                if (githubUsernames.length === 0) {
                    return [2 /*return*/];
                }
                return [4 /*yield*/, convertToSlackUsername(githubUsernames)];
            case 3:
                slackIds = _a.sent();
                message = buildSlackPostMessage(slackIds, info.title, info.url, info.body);
                slackWebhookUrl = core.getInput("slack-webhook-url", {
                    required: true
                });
                if (!slackWebhookUrl) {
                    core.setFailed("Error! Need to set `slack-webhook-url` .");
                    return [2 /*return*/];
                }
                return [4 /*yield*/, postToSlack(slackWebhookUrl, message)];
            case 4:
                _a.sent();
                return [3 /*break*/, 6];
            case 5:
                error_1 = _a.sent();
                core.setFailed(error_1.message);
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
main();
