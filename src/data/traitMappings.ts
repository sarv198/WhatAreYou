import type { TraitMappings } from '../types';

/**
 * How each answer moves the user's personality profile.
 * Values are signed in [−1, 1]: magnitude is how strongly the answer speaks
 * to a trait, sign is the direction.
 */
export const TRAIT_MAPPINGS: TraitMappings = {
  habitat: {
    rainforest: { 'habitat.rainforest': 1 },
    desert: { 'habitat.desert': 1 },
    snow: { 'habitat.snow': 1 },
    grassland: { 'habitat.grassland': 1 },
    ocean: { 'habitat.ocean': 1 },
  },

  lifestyle: {
    roam: { 'lifestyle.roaming': 1, 'lifestyle.homebody': -0.5, 'mind.curiosity': 0.3 },
    home: {
      'lifestyle.homebody': 1,
      'lifestyle.restless': -0.6,
      'lifestyle.roaming': -0.4,
      'temperament.calm': 0.3,
    },
    hunt: { 'lifestyle.hunter': 1, 'temperament.ambition': 0.3, 'temperament.aggression': 0.3 },
    social: {
      'social.gregarious': 0.9,
      'social.independence': -0.6,
      'temperament.playfulness': 0.3,
    },
    active: { 'lifestyle.restless': 1, 'lifestyle.homebody': -0.6, 'drive.industrious': 0.4 },
  },

  sociality: {
    alone: { 'social.independence': 1, 'social.gregarious': -0.7, 'social.pack': -0.6 },
    bestFriend: {
      'social.pairBond': 1,
      'social.independence': -0.2,
      'temperament.loyalty': 0.4,
    },
    family: { 'social.family': 1, 'temperament.loyalty': 0.4, 'social.independence': -0.4 },
    squad: { 'social.pack': 1, 'social.gregarious': 0.5, 'social.independence': -0.7 },
    whoever: { 'social.easygoing': 1, 'social.gregarious': 0.4, 'gifts.adaptability': 0.3 },
  },

  rhythm: {
    morning: { 'rhythm.morning': 1, 'rhythm.night': -0.4 },
    afternoon: { 'rhythm.afternoon': 1, 'rhythm.night': -0.3 },
    evening: { 'rhythm.evening': 1 },
    night: { 'rhythm.night': 1, 'rhythm.morning': -0.4 },
  },

  problemSolving: {
    ignore: {
      'temperament.calm': 0.8,
      'mind.intellect': -0.4,
      'temperament.playfulness': 0.3,
      'defense.assess': -0.4,
    },
    giveUp: {
      'temperament.persistence': -0.9,
      'defense.flee': 0.5,
      'temperament.confidence': -0.4,
    },
    dissect: { 'mind.intellect': 1, 'mind.patience': 0.7, 'defense.assess': 0.5 },
    charge: {
      'defense.standGround': 0.6,
      'temperament.aggression': 0.6,
      'mind.patience': -0.6,
      'temperament.confidence': 0.4,
    },
    unconventional: { 'mind.creativity': 1, 'mind.cunning': 0.5, 'temperament.chaos': 0.3 },
  },

  sports: {
    none: { 'lifestyle.restless': -0.6, 'lifestyle.homebody': 0.6, 'temperament.ambition': -0.3 },
    team: { 'social.pack': 0.9, 'social.gregarious': 0.4, 'temperament.loyalty': 0.3 },
    combat: {
      'temperament.aggression': 0.9,
      'gifts.strength': 0.6,
      'defense.standGround': 0.5,
    },
    precision: { 'mind.precision': 1, 'gifts.speed': 0.4, 'mind.patience': 0.3 },
    gym: {
      'gifts.endurance': 0.7,
      'gifts.strength': 0.5,
      'drive.industrious': 0.4,
      'social.independence': 0.3,
    },
  },

  dailyActivity: {
    sleeping: { 'lifestyle.homebody': 0.9, 'lifestyle.restless': -0.7, 'temperament.calm': 0.5 },
    eating: { 'lifestyle.appetite': 1, 'lifestyle.homebody': 0.3 },
    exploring: { 'lifestyle.roaming': 0.8, 'mind.curiosity': 0.8 },
    exercising: { 'lifestyle.restless': 0.7, 'gifts.endurance': 0.7, 'gifts.speed': 0.3 },
    studying: { 'mind.intellect': 0.9, 'mind.curiosity': 0.6, 'mind.patience': 0.3 },
    building: { 'drive.industrious': 1, 'mind.patience': 0.4, 'social.pack': 0.2 },
  },

  arguments: {
    above: {
      'temperament.confidence': 0.7,
      'temperament.reserve': 0.5,
      'temperament.aggression': -0.3,
    },
    prove: {
      'temperament.persistence': 0.9,
      'temperament.ambition': 0.5,
      'temperament.aggression': 0.4,
    },
    angry: { 'temperament.aggression': 1, 'temperament.calm': -0.8 },
    dismantle: { 'mind.intellect': 0.8, 'mind.cunning': 0.5, 'temperament.calm': 0.4 },
    avoid: {
      'defense.flee': 0.6,
      'defense.hide': 0.5,
      'temperament.aggression': -0.8,
      'temperament.calm': 0.3,
    },
  },

  friends: {
    leader: {
      'temperament.leadership': 1,
      'temperament.confidence': 0.6,
      'social.pack': 0.3,
    },
    chaotic: {
      'temperament.chaos': 1,
      'temperament.playfulness': 0.5,
      'mind.patience': -0.4,
    },
    dependable: {
      'temperament.loyalty': 1,
      'social.family': 0.4,
      'temperament.persistence': 0.4,
    },
    quiet: {
      'temperament.reserve': 1,
      'defense.assess': 0.5,
      'mind.patience': 0.5,
      'social.gregarious': -0.4,
    },
    comedian: {
      'temperament.playfulness': 1,
      'temperament.calm': 0.3,
      'social.gregarious': 0.4,
    },
    wildcard: { 'temperament.chaos': 0.6, 'gifts.adaptability': 0.6, 'mind.cunning': 0.4 },
  },

  discipline: {
    science: { 'mind.intellect': 0.8, 'mind.curiosity': 0.8 },
    art: { 'drive.aesthetic': 1, 'mind.creativity': 0.7 },
    business: {
      'mind.cunning': 0.8,
      'temperament.leadership': 0.5,
      'drive.industrious': 0.5,
      'temperament.ambition': 0.4,
    },
    sports: {
      'temperament.ambition': 0.8,
      'gifts.speed': 0.4,
      'gifts.strength': 0.4,
      'social.pack': 0.2,
    },
    nature: { 'lifestyle.roaming': 0.6, 'mind.curiosity': 0.4, 'temperament.calm': 0.4 },
    philosophy: {
      'mind.patience': 0.7,
      'mind.intellect': 0.6,
      'temperament.reserve': 0.5,
      'temperament.calm': 0.4,
    },
  },

  confidence: {
    knowGood: {
      'temperament.confidence': 1,
      'temperament.calm': 0.5,
      'temperament.ambition': -0.3,
    },
    proveIt: {
      'temperament.ambition': 1,
      'temperament.persistence': 0.5,
      'temperament.confidence': 0.3,
    },
    quiet: {
      'temperament.reserve': 0.8,
      'temperament.confidence': 0.6,
      'mind.patience': 0.4,
    },
    fluctuating: {
      'temperament.confidence': -0.4,
      'defense.hide': 0.3,
      'gifts.adaptability': 0.3,
      'mind.curiosity': 0.3,
    },
    winging: {
      'temperament.chaos': 0.6,
      'temperament.playfulness': 0.5,
      'mind.patience': -0.4,
      'gifts.adaptability': 0.4,
    },
  },

  outlook: {
    explore: {
      'lifestyle.roaming': 0.9,
      'temperament.confidence': 0.4,
      'mind.curiosity': 0.4,
    },
    dangerous: {
      'defense.assess': 0.6,
      'defense.hide': 0.4,
      'temperament.reserve': 0.3,
      'social.territorial': 0.3,
    },
    fascinating: { 'mind.curiosity': 1, 'mind.intellect': 0.5 },
    tribe: { 'social.pack': 0.6, 'social.family': 0.6, 'social.gregarious': 0.5 },
    chaotic: { 'gifts.adaptability': 1, 'mind.cunning': 0.5, 'defense.exploit': 0.4 },
    beautiful: {
      'drive.aesthetic': 0.8,
      'temperament.calm': 0.6,
      'temperament.playfulness': 0.3,
    },
  },

  danger: {
    stand: {
      'defense.standGround': 1,
      'temperament.confidence': 0.6,
      'defense.flee': -0.6,
    },
    flee: { 'defense.flee': 1, 'gifts.speed': 0.5, 'defense.standGround': -0.6 },
    hide: { 'defense.hide': 1, 'gifts.camouflage': 0.6, 'defense.standGround': -0.5 },
    assess: { 'defense.assess': 1, 'mind.intellect': 0.4, 'mind.patience': 0.4 },
    scarier: {
      'defense.intimidate': 1,
      'temperament.aggression': 0.4,
      'drive.aesthetic': 0.2,
    },
    advantage: { 'defense.exploit': 1, 'mind.cunning': 0.8 },
  },

  superpower: {
    strength: { 'gifts.strength': 1 },
    speed: { 'gifts.speed': 1 },
    flight: { 'gifts.flight': 1 },
    camouflage: { 'gifts.camouflage': 1, 'defense.hide': 0.3 },
    regeneration: { 'gifts.regeneration': 1, 'gifts.endurance': 0.4 },
    intelligence: { 'mind.intellect': 1 },
    adaptation: { 'gifts.adaptability': 1 },
  },

  personalSpace: {
    territory: {
      'social.territorial': 1,
      'social.independence': 0.7,
      'lifestyle.roaming': 0.4,
    },
    ownSpace: {
      'social.independence': 0.7,
      'social.territorial': 0.3,
      'social.gregarious': -0.3,
    },
    oneOrTwo: { 'social.pairBond': 0.9, 'social.family': 0.4 },
    crowd: { 'social.gregarious': 1, 'social.pack': 0.4, 'social.independence': -0.6 },
    dontCare: { 'social.easygoing': 1, 'temperament.calm': 0.3 },
  },
};
