export const REACTION_EMOJI = ["👍", "👎", "🎉", "❤️", "👀", "🚀"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJI)[number];
