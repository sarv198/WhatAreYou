export interface EngineConfig {
  /**
   * How sharply accumulated evidence separates animals. Candidate logits are
   * `sharpness × totalEvidence × compatibility`, so the distribution naturally
   * tightens as more questions are answered.
   */
  sharpness: number;
  /** How decisively an animal-like person is assumed to pick its best-fitting option. */
  answerSharpness: number;
  /**
   * Share of compatibility that comes from answer distinctiveness rather than
   * raw trait similarity (0 = pure similarity). Counteracts generalist bias.
   */
  distinctivenessWeight: number;
  /** Animals whose logit is within this gap of the leader count as "still in the running". */
  poolLogitGap: number;
  /** No confidence-based early stop before this many answers. */
  minQuestions: number;
  /** Hard cap on questions asked. */
  maxQuestions: number;
  /** Stop once the leader's probability reaches this… */
  confidentProbability: number;
  /** …and it is at least this many times more likely than the runner-up. */
  confidentMargin: number;
  /** After minQuestions, stop when no remaining question is expected to teach us this many bits. */
  minUsefulGain: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  sharpness: 2.4,
  answerSharpness: 6,
  distinctivenessWeight: 0.3,
  poolLogitGap: 3.7,
  minQuestions: 9,
  maxQuestions: 13,
  confidentProbability: 0.6,
  confidentMargin: 2.5,
  minUsefulGain: 0.05,
};
