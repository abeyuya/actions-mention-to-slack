export type SectionBlock = {
  type: "section";
  text: { type: "mrkdwn"; text: string };
};

export type QuoteAttachment = {
  color: string;
  blocks: unknown[];
};

export const sectionTexts = (blocks: unknown[]): string[] =>
  blocks
    .filter(
      (b): b is SectionBlock =>
        typeof b === "object" &&
        b !== null &&
        (b as { type?: string }).type === "section",
    )
    .map((b) => b.text.text);

export const attachmentSectionTexts = (
  attachments: unknown[] | undefined,
): string[][] =>
  (attachments ?? []).map((a) =>
    sectionTexts((a as { blocks?: unknown[] }).blocks ?? []),
  );
