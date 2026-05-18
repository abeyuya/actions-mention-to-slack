export type SectionBlock = {
  type: "section";
  text: { type: "mrkdwn"; text: string };
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
