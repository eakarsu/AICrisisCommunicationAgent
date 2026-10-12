const cases = [
  { label: 'Service outage', title: 'Regional service outage', detail: 'Customers in the northeast report intermittent access after a deployment. Engineering is investigating; restoration time is unconfirmed.', company: 'Northstar Services', source: 'Customer support queue', audience: 'customers', tone: 'empathetic' },
  { label: 'Product recall', title: 'Product safety recall', detail: 'A supplier flagged a possible defect in one production batch. Distribution is paused while quality staff confirm affected units.', company: 'Harbor Products', source: 'Quality team report', audience: 'media', tone: 'factual' },
  { label: 'Data incident', title: 'Potential data exposure', detail: 'Monitoring detected unusual access to a customer portal. The security team has contained the session and is verifying scope.', company: 'Cedar Systems', source: 'Security alert review', audience: 'employees', tone: 'reassuring' },
];

export function nativeAIPresets(config) {
  return cases.map((sample) => ({ label: sample.label, values: Object.fromEntries(config.aiFields.map((field) => {
    const values = { crisis_title: sample.title, crisis_details: sample.detail, company_name: sample.company, spokesperson: 'Communications lead (confirm name)', crisis_context: sample.detail, text_input: `I am concerned about ${sample.title.toLowerCase()}. Please share what is known and when we will hear more.`, source: sample.source, scenario: sample.detail, industry: 'Consumer services', company_context: `${sample.company} serves customers across several regions. Incident command is validating facts before external statements.`, topic: sample.title, context: sample.detail, crisis_summary: sample.detail, actions_taken: 'Incident team assembled; facts being verified; next public update pending approval.', timeline: '09:00 issue reported; 09:20 triage started; 10:00 incident command briefed.', outcome: 'Investigation ongoing; resolution and affected scope unconfirmed.', key_message: 'We are investigating and will share verified updates as soon as they are available.', platform: sample.label === 'Product recall' ? 'facebook' : sample.label === 'Data incident' ? 'linkedin' : 'twitter', target_audience: sample.audience, tone: field.options?.includes(sample.tone) ? sample.tone : field.options?.[0] };
    return [field.key, values[field.key] ?? field.options?.[0] ?? ''];
  })) }));
}
