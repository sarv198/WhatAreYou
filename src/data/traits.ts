/**
 * The trait registry is the shared vocabulary between animals and answers.
 * Animals describe themselves on these dimensions (0–1); answers push the
 * user's profile along them (−1…+1). Nothing else in the app needs to know
 * which traits exist.
 */

interface TraitMeta {
  label: string;
  /** Noun phrase used when explaining a match: "you share its {phrase}". */
  phrase: string;
  /** Overrides the group default for traits most animals simply don't have. */
  defaultValue?: number;
}

interface TraitGroupMeta {
  label: string;
  /** Value assumed when an animal profile omits a trait in this group. */
  defaultValue: number;
  traits: Record<string, TraitMeta>;
}

export const TRAIT_SCHEMA = {
  habitat: {
    label: 'Habitat',
    defaultValue: 0,
    traits: {
      rainforest: { label: 'Rainforest', phrase: 'a pull toward lush, tangled places' },
      desert: { label: 'Desert', phrase: 'a feel for harsh, sun-baked places' },
      snow: { label: 'Snowy winters', phrase: 'a tolerance for the cold' },
      grassland: { label: 'Open plains', phrase: 'a need for wide-open space' },
      ocean: { label: 'Ocean', phrase: 'a deep affinity for the water' },
    },
  },
  rhythm: {
    label: 'Activity cycle',
    defaultValue: 0.2,
    traits: {
      morning: { label: 'Early riser', phrase: 'early-morning energy' },
      afternoon: { label: 'Afternoon peak', phrase: 'a sun-drenched afternoon peak' },
      evening: { label: 'Twilight', phrase: 'a twilight streak' },
      night: { label: 'Nocturnal', phrase: 'a nocturnal streak' },
    },
  },
  lifestyle: {
    label: 'Lifestyle',
    defaultValue: 0.3,
    traits: {
      roaming: { label: 'Roamer', phrase: 'a restless urge to roam' },
      homebody: { label: 'Energy saver', phrase: 'a talent for conserving energy' },
      hunter: { label: 'Hunter', phrase: 'a hunter’s drive' },
      restless: { label: 'Always moving', phrase: 'a motor that never switches off' },
      appetite: { label: 'Big appetite', phrase: 'a serious appetite' },
    },
  },
  social: {
    label: 'Social style',
    defaultValue: 0.3,
    traits: {
      independence: { label: 'Independent', phrase: 'fierce independence' },
      pairBond: { label: 'Ride-or-die', phrase: 'deep one-on-one loyalty' },
      family: { label: 'Family-first', phrase: 'a family-first instinct' },
      pack: { label: 'Team player', phrase: 'a team-player mentality' },
      gregarious: { label: 'Sociable', phrase: 'an easy love of crowds' },
      territorial: { label: 'Territorial', phrase: 'firm boundaries' },
      easygoing: { label: 'Easygoing', phrase: 'a go-with-the-flow social style' },
    },
  },
  mind: {
    label: 'Mind',
    defaultValue: 0.35,
    traits: {
      intellect: { label: 'Analytical', phrase: 'an analytical mind' },
      curiosity: { label: 'Curious', phrase: 'relentless curiosity' },
      creativity: { label: 'Inventive', phrase: 'an inventive streak' },
      cunning: { label: 'Cunning', phrase: 'strategic cunning' },
      patience: { label: 'Patient', phrase: 'serious patience' },
      precision: { label: 'Precise', phrase: 'pinpoint precision' },
    },
  },
  temperament: {
    label: 'Temperament',
    defaultValue: 0.35,
    traits: {
      aggression: { label: 'Confrontational', phrase: 'a willingness to fight' },
      confidence: { label: 'Self-assured', phrase: 'unshakeable self-assurance' },
      ambition: { label: 'Competitive', phrase: 'a competitive fire' },
      calm: { label: 'Unbothered', phrase: 'an unbothered calm' },
      playfulness: { label: 'Playful', phrase: 'a playful streak' },
      chaos: { label: 'Chaotic', phrase: 'a gift for chaos' },
      loyalty: { label: 'Loyal', phrase: 'rock-solid loyalty' },
      leadership: { label: 'Leader', phrase: 'natural authority' },
      reserve: { label: 'Reserved', phrase: 'a quiet, watchful reserve' },
      persistence: { label: 'Relentless', phrase: 'sheer persistence' },
    },
  },
  defense: {
    label: 'Under pressure',
    defaultValue: 0.25,
    traits: {
      standGround: { label: 'Stands ground', phrase: 'a refusal to back down' },
      flee: { label: 'Quick exit', phrase: 'excellent escape instincts' },
      hide: { label: 'Lies low', phrase: 'a knack for lying low' },
      assess: { label: 'Reads the room', phrase: 'a habit of reading the situation first' },
      intimidate: { label: 'Intimidating', phrase: 'a talent for looking scarier than you are' },
      exploit: { label: 'Opportunist', phrase: 'a knack for turning trouble into opportunity' },
    },
  },
  gifts: {
    label: 'Natural gifts',
    defaultValue: 0.25,
    traits: {
      strength: { label: 'Strong', phrase: 'raw power' },
      speed: { label: 'Fast', phrase: 'a need for speed' },
      flight: { label: 'Airborne', phrase: 'a longing for the sky' },
      camouflage: { label: 'Elusive', phrase: 'a gift for going unseen' },
      regeneration: { label: 'Resilient', phrase: 'remarkable powers of recovery' },
      adaptability: { label: 'Adaptable', phrase: 'chameleon-level adaptability' },
      endurance: { label: 'Enduring', phrase: 'serious staying power' },
      armor: { label: 'Armoured', phrase: 'a near-indestructible shell', defaultValue: 0.2 },
      venom: { label: 'Venomous', phrase: 'a dangerously toxic edge', defaultValue: 0 },
    },
  },
  drive: {
    label: 'Drive',
    defaultValue: 0.3,
    traits: {
      industrious: { label: 'Builder', phrase: 'a builder’s work ethic' },
      aesthetic: { label: 'Aesthetic', phrase: 'an eye for beauty and display' },
    },
  },
} as const satisfies Record<string, TraitGroupMeta>;

export type TraitGroup = keyof typeof TRAIT_SCHEMA;
export type TraitKey<G extends TraitGroup> = keyof (typeof TRAIT_SCHEMA)[G]['traits'] & string;
export type TraitId = { [G in TraitGroup]: `${G}.${TraitKey<G>}` }[TraitGroup];

/** Sparse, grouped trait values (0–1). Omitted traits fall back to the group default. */
export type TraitProfile = { [G in TraitGroup]?: Partial<Record<TraitKey<G>, number>> };

export interface TraitDefinition {
  id: TraitId;
  group: TraitGroup;
  key: string;
  label: string;
  phrase: string;
  defaultValue: number;
}

export const TRAIT_DEFINITIONS: readonly TraitDefinition[] = Object.entries(TRAIT_SCHEMA).flatMap(
  ([group, meta]) =>
    Object.entries(meta.traits).map(([key, trait]: [string, TraitMeta]) => ({
      id: `${group}.${key}` as TraitId,
      group: group as TraitGroup,
      key,
      label: trait.label,
      phrase: trait.phrase,
      defaultValue: trait.defaultValue ?? meta.defaultValue,
    })),
);

export const TRAIT_IDS: readonly TraitId[] = TRAIT_DEFINITIONS.map((t) => t.id);

const TRAIT_BY_ID = new Map(TRAIT_DEFINITIONS.map((t) => [t.id, t]));

export function getTrait(id: TraitId): TraitDefinition {
  const trait = TRAIT_BY_ID.get(id);
  if (!trait) throw new Error(`Unknown trait "${id}"`);
  return trait;
}

export function isTraitId(value: string): value is TraitId {
  return TRAIT_BY_ID.has(value as TraitId);
}

/** Habitat and activity-cycle traits describe circumstances rather than personality. */
export const CONTEXT_GROUPS: ReadonlySet<TraitGroup> = new Set<TraitGroup>(['habitat', 'rhythm']);
