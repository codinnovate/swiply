import type { Model } from 'mongoose';

import type { DuelScores } from '../domain/duel-alerts';
import type { PostingChallenge } from '../schemas/posting-challenge.schema';
import type { ScoredPost } from '../schemas/scored-post.schema';

type ScoredChallenge = Pick<
  PostingChallenge,
  'challengerUsername' | 'opponentUsername' | 'startsAt' | 'endsAt'
>;

/** Each side's post count inside the duel window. */
export async function challengeScores(
  posts: Model<ScoredPost>,
  challenge: ScoredChallenge,
): Promise<DuelScores> {
  const counts = await posts.aggregate<{ _id: string; score: number }>([
    {
      $match: {
        username: { $in: [challenge.challengerUsername, challenge.opponentUsername] },
        postedAt: { $gte: challenge.startsAt, $lte: challenge.endsAt },
      },
    },
    { $group: { _id: '$username', score: { $sum: 1 } } },
  ]);
  const score = new Map(counts.map((item) => [item._id, item.score]));
  return {
    challenger: score.get(challenge.challengerUsername) ?? 0,
    opponent: score.get(challenge.opponentUsername) ?? 0,
  };
}
