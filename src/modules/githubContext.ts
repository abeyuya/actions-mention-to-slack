import * as fs from "node:fs";

// biome-ignore lint/suspicious/noExplicitAny: GitHub webhook payloads are open shapes
type AnyRecord = { [key: string]: any };

export type WebhookPayload = AnyRecord & {
  action?: string;
  sender?: AnyRecord & {
    login: string;
    type?: string;
  };
  repository?: AnyRecord & {
    full_name?: string;
    name: string;
    owner: AnyRecord & {
      login: string;
    };
  };
  issue?: AnyRecord & {
    body?: string | null;
    title: string;
    html_url?: string;
    number: number;
  };
  pull_request?: AnyRecord & {
    body?: string | null;
    title: string;
    html_url?: string;
    number: number;
    user?: AnyRecord & {
      login: string;
    };
  };
  comment?: AnyRecord & {
    id: number;
    body: string;
    html_url: string;
  };
  review?: AnyRecord & {
    body: string | null;
    state?: string;
    html_url: string;
  };
  requested_reviewer?: AnyRecord & {
    login: string;
  };
  requested_team?: AnyRecord & {
    name: string;
  };
};

const readPayload = (): WebhookPayload => {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(path, "utf-8")) as WebhookPayload;
  } catch {
    return {};
  }
};

const parseRepo = (): { owner: string; repo: string } => {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) {
    return { owner: "", repo: "" };
  }
  const [owner, name] = repo.split("/");
  return { owner: owner ?? "", repo: name ?? "" };
};

export const context = {
  get payload(): WebhookPayload {
    return readPayload();
  },
  get repo(): { owner: string; repo: string } {
    return parseRepo();
  },
  get sha(): string {
    return process.env.GITHUB_SHA ?? "";
  },
};
