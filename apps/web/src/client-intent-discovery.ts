export const CLIENT_INTENT_DISCOVERY_KINDS = [
  'core_functional_job',
  'related_job',
  'consumption_chain_job',
  'desired_outcome',
  'emotional_job',
  'social_job',
  'financial_desired_outcome',
] as const;

export type ClientIntentDiscoveryKind = typeof CLIENT_INTENT_DISCOVERY_KINDS[number];

const discoveryKindTerms: Record<ClientIntentDiscoveryKind, { label: string; aliases: string[] }> = {
  core_functional_job: { label: 'Core Functional Job', aliases: ['core', 'functional', 'job'] },
  related_job: { label: 'Related Job', aliases: ['related', 'job'] },
  consumption_chain_job: { label: 'Consumption Chain Job', aliases: ['consumption', 'chain', 'job'] },
  desired_outcome: { label: 'Desired Outcome', aliases: ['desired', 'outcome', 'do'] },
  emotional_job: { label: 'Emotional Job', aliases: ['emotional', 'emotion', 'job'] },
  social_job: { label: 'Social Job', aliases: ['social', 'job'] },
  financial_desired_outcome: { label: 'Financial Desired Outcome', aliases: ['financial', 'desired', 'outcome', 'fdo'] },
};

export const normalizeClientIntentQuery = (query: string) => query.trim().toLocaleLowerCase();

export function clientIntentKindShortcutMatches(queryInput: string) {
  const query = normalizeClientIntentQuery(queryInput);
  if (!query) return [];
  return CLIENT_INTENT_DISCOVERY_KINDS.flatMap(kind => {
    const terms = discoveryKindTerms[kind];
    return terms.label.toLocaleLowerCase().includes(query)
      || terms.aliases.some(alias => alias.includes(query) || query.includes(alias))
      ? [{ kind, label: terms.label }]
      : [];
  });
}

export const clientIntentTitleMatches = (title: string, query: string) =>
  !query || title.toLocaleLowerCase().includes(normalizeClientIntentQuery(query));
