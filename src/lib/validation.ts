import { TRAIT_SCHEMA, isTraitId, type TraitGroup } from '../data/traits';
import type { AnimalProfile, Question, TraitMappings } from '../types';

const REQUIRED_TEXT_FIELDS = ['id', 'name', 'tagline', 'description', 'funFact', 'color'] as const;

export function validateAnimal(animal: AnimalProfile): string[] {
  const errors: string[] = [];
  const label = animal.id || animal.name || '(unnamed animal)';

  for (const field of REQUIRED_TEXT_FIELDS) {
    if (typeof animal[field] !== 'string' || animal[field].trim() === '') {
      errors.push(`${label}: missing "${field}"`);
    }
  }
  if (!Array.isArray(animal.traits) || animal.traits.length < 3 || animal.traits.length > 5) {
    errors.push(`${label}: "traits" should list 3–5 personality traits`);
  }
  if (!animal.profile || typeof animal.profile !== 'object') {
    errors.push(`${label}: missing "profile"`);
    return errors;
  }

  for (const [group, values] of Object.entries(animal.profile)) {
    if (!(group in TRAIT_SCHEMA)) {
      errors.push(`${label}: unknown trait group "${group}"`);
      continue;
    }
    const known = TRAIT_SCHEMA[group as TraitGroup].traits;
    for (const [key, value] of Object.entries(values ?? {})) {
      if (!(key in known)) errors.push(`${label}: unknown trait "${group}.${key}"`);
      if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
        errors.push(`${label}: "${group}.${key}" must be a number between 0 and 1`);
      }
    }
  }

  const habitat = animal.profile.habitat ?? {};
  if (!Object.values(habitat).some((v) => typeof v === 'number' && v > 0)) {
    errors.push(`${label}: needs at least one habitat above 0`);
  }
  return errors;
}

export function validateQuestionBank(questions: Question[], mappings: TraitMappings): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const broadOrders = new Set<number>();

  for (const q of questions) {
    if (ids.has(q.id)) errors.push(`Duplicate question id "${q.id}"`);
    ids.add(q.id);
    if (!(q.weight > 0)) errors.push(`${q.id}: weight must be positive`);
    if (q.options.length < 2) errors.push(`${q.id}: needs at least two options`);
    if (q.phase === 'broad') {
      if (q.order === undefined) errors.push(`${q.id}: broad questions need an "order"`);
      else if (broadOrders.has(q.order)) errors.push(`${q.id}: duplicate broad order ${q.order}`);
      else broadOrders.add(q.order);
    }

    const optionIds = new Set<string>();
    for (const option of q.options) {
      if (optionIds.has(option.id)) errors.push(`${q.id}: duplicate option "${option.id}"`);
      optionIds.add(option.id);
      const effects = mappings[q.id]?.[option.id];
      if (!effects) {
        errors.push(`${q.id}.${option.id}: no trait mapping`);
        continue;
      }
      for (const [trait, value] of Object.entries(effects)) {
        if (!isTraitId(trait)) errors.push(`${q.id}.${option.id}: unknown trait "${trait}"`);
        if (typeof value !== 'number' || value < -1 || value > 1) {
          errors.push(`${q.id}.${option.id}: effect on "${trait}" must be between −1 and 1`);
        }
      }
    }
  }
  return errors;
}

export function validateAnimalSet(animals: AnimalProfile[]): string[] {
  const errors = animals.flatMap(validateAnimal);
  const seen = new Set<string>();
  for (const animal of animals) {
    if (seen.has(animal.id)) errors.push(`Duplicate animal id "${animal.id}"`);
    seen.add(animal.id);
  }
  if (animals.length === 0) errors.push('At least one animal is required');
  return errors;
}
