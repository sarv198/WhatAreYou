import type { TraitMappings } from '../../types';
import { TRAIT_MAPPINGS } from '../traitMappings';

/**
 * Answer effects for the prehistoric quiz. Shared questions reuse the main
 * quiz's mappings so both quizzes score personality the same way.
 */
export const PREHISTORIC_TRAIT_MAPPINGS: TraitMappings = {
  habitat: {
    rainforest: { 'habitat.rainforest': 1 },
    desert: { 'habitat.desert': 1 },
    snow: { 'habitat.snow': 1 },
    grassland: { 'habitat.grassland': 1 },
    water: { 'habitat.ocean': 1 },
  },
  lifestyle: TRAIT_MAPPINGS.lifestyle!,
  sociality: TRAIT_MAPPINGS.sociality!,
  diet: TRAIT_MAPPINGS.diet!,
  dailyActivity: TRAIT_MAPPINGS.dailyActivity!,
  friends: TRAIT_MAPPINGS.friends!,
  superpower: {
    strength: TRAIT_MAPPINGS.superpower!.strength!,
    speed: TRAIT_MAPPINGS.superpower!.speed!,
    flight: TRAIT_MAPPINGS.superpower!.flight!,
    indestructible: TRAIT_MAPPINGS.superpower!.indestructible!,
    size: { 'gifts.size': 1, 'temperament.confidence': 0.3 },
    senses: { 'mind.precision': 0.7, 'defense.assess': 0.7, 'mind.curiosity': 0.3 },
  },
  danger: TRAIT_MAPPINGS.danger!,
  arguments: TRAIT_MAPPINGS.arguments!,
  legacy: {
    biggest: { 'gifts.size': 1, 'temperament.confidence': 0.4 },
    smartest: { 'mind.intellect': 0.8, 'mind.cunning': 0.5 },
    protector: { 'defense.standGround': 0.6, 'social.family': 0.6, 'temperament.loyalty': 0.5 },
    legend: { 'temperament.ambition': 0.7, 'temperament.aggression': 0.6, 'temperament.persistence': 0.4 },
    stylish: { 'drive.aesthetic': 1, 'temperament.confidence': 0.3 },
    survivor: { 'gifts.adaptability': 0.8, 'gifts.endurance': 0.5 },
  },
};
