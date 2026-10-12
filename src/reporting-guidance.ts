// Municipality facts are sourced separately from our product's drafting policy.
// Recheck the official sources before a release; category codes and form rules stay live.
export const zurichReportingGuidance = {
  municipality: 'Zürich (city only)',
  delivery_language: 'de',
  verified_on: '2026-10-04',
  sources: [{ title: 'Züri wie neu — official reporting guidance', url: 'https://www.zueriwieneu.ch/faq' }],
  scope: 'Damage and defects in city infrastructure and public spaces.',
  issue_groups: ['Waste and collection points', 'Lighting and clocks', 'Fountains and hydrants',
    'Graffiti', 'Green spaces and playgrounds', 'Roads, pavements and squares', 'VBZ / public transport', 'Pests'],
  exclusions: [
    { issue: 'Emergency or immediate danger', next_step: 'Use emergency services: 112 general, 144 ambulance, 117 police, 118 fire. Do not continue a maintenance report.' },
    { issue: 'Living wild animals', next_step: 'The city FAQ directs these reports to the police on 117.' },
    { issue: 'Outside Zürich city', next_step: 'Use the relevant municipality’s official reporting service. This integration currently supports Zürich city only.' },
    { issue: 'General beautification or improvement suggestions', next_step: 'Use the city’s general contact or relevant department through https://www.stadt-zuerich.ch/; this maintenance channel excludes general suggestions.' },
  ],
  responsibility: 'The city assigns reports to the responsible office and says it forwards reports outside its responsibility anonymously to the relevant third party. Do not require the resident to identify the department. Clarify ownership only when it changes whether this service is appropriate.',
  routing_note: 'Use the live category codes and location-specific requirements. For an issue outside the guide, verify the appropriate official channel; do not invent a destination or force a maintenance category.',
};

export const observationInstructions = `Help the resident report an observation with minimal effort. Suggest the best category yourself, considering the affected asset (for example, a tram-stop issue may belong to VBZ/ÖV). Describe visible facts and the user's observations concisely. Do not determine or assert legality, infer blame, intent, ownership or permission, or add legal citations. A maintenance report does not require proof of an offence. Keep uncertainty about legality out of the report; uncertainty alone does not block a factual report.
Choose one next step: prepare a factual report for a clear supported issue; ask one short, necessary clarification if the issue or routing is unclear; or explain briefly and direct the user to the appropriate official channel for excluded issues. Do not invent an issue when none is evident. Never force an excluded issue into a category. A sofa on a pavement can be described as an observation without calling it illegal dumping; do not ask the resident to prove whether collection was authorized.`;

export const reportingInstructions = `${observationInstructions}
Read list_categories for live categories and the municipality reporting guidance. Discuss and review drafts in the resident's preferred language. The final report must use the municipality's delivery language (German for Zürich), regardless of the review language.
For clear issues, proceed without asking the user to select a category or approve intermediate wording. Collect only missing required details, confirm the exact issue location, then show one complete preview for approval. Do not ask for optional name or phone unless the user wants to provide them or the category requires them. Do not repeat questions already answered or expose internal classification labels. Keep the final preview and explicit approval before submission.`;
