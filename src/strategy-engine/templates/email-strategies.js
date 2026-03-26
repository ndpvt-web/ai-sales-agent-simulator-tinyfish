/**
 * Email Strategy Parameter Space
 * ================================
 * Defines the discrete dimensions of the email strategy search space.
 * Each dimension is independently sampled to form StrategyParams.
 */

export const OPENING_STYLES = [
  'warm_personal',
  'data_driven',
  'provocative_question',
  'mutual_connection',
  'industry_insight',
  'direct_value',
];

export const VALUE_FRAMES = [
  'roi_focused',
  'risk_reduction',
  'competitive_edge',
  'innovation_leader',
  'efficiency_gain',
  'social_proof',
];

export const URGENCY_LEVELS = ['low', 'medium', 'high'];

export const EMOTIONAL_TONES = [
  'empathetic',
  'authoritative',
  'collaborative',
  'consultative',
  'challenger',
];

export const OBJECTION_HANDLERS = [
  'acknowledge_redirect',
  'data_counter',
  'social_proof',
  'reframe_question',
  'empathy_bridge',
];

/**
 * Subject line templates. Placeholders: {name}, {company}, {pain_point}
 */
export const EMAIL_SUBJECT_TEMPLATES = [
  'Quick question for {name} at {company}',
  'How {company} can address {pain_point}',
  '{name}, noticed something about {company}',
  'Solving {pain_point} for companies like {company}',
  '{company} + [us]: a quick idea',
  'Re: {pain_point} — worth 10 minutes?',
  '{name}, your competitors are solving {pain_point}',
  'One thing that could change {pain_point} at {company}',
  '{company} caught my eye — here\'s why',
  'A data point relevant to {name} at {company}',
  'Is {pain_point} still a challenge at {company}?',
  '{name} — mutual connection suggested I reach out',
  'What if {company} could eliminate {pain_point}?',
  'Insight for {company} on {pain_point}',
  '{name}, bold question about {pain_point}',
];

/**
 * Opening line templates for the email body.
 * Placeholders: {name}, {company}, {pain_point}, {industry}
 */
export const EMAIL_OPENING_TEMPLATES = {
  warm_personal: [
    'Hi {name}, I came across your recent work at {company} and it genuinely impressed me — especially your approach to {pain_point}.',
    'Hi {name}, a colleague of mine mentioned your name and the innovative things happening at {company}.',
  ],
  data_driven: [
    'Hi {name}, companies in {industry} are losing an average of 23% in productivity due to {pain_point} — and {company} may be facing the same.',
    'Hi {name}, recent benchmarks show that {industry} leaders who solve {pain_point} outperform peers by 40%.',
  ],
  provocative_question: [
    'Hi {name}, what would it mean for {company} if {pain_point} simply ceased to exist?',
    'Hi {name}, if {company} could eliminate {pain_point} in 90 days, would that be worth exploring?',
  ],
  mutual_connection: [
    'Hi {name}, [Mutual Contact] suggested I reach out — apparently we\'re both focused on {pain_point} in {industry}.',
    'Hi {name}, I was speaking with someone in your network who mentioned {company}\'s challenges around {pain_point}.',
  ],
  industry_insight: [
    'Hi {name}, I\'ve been tracking a shift in {industry} that\'s directly affecting how companies handle {pain_point}.',
    'Hi {name}, there\'s an emerging pattern in {industry} — the way leaders are solving {pain_point} is changing fast.',
  ],
  direct_value: [
    'Hi {name}, I\'ll be direct: we help {industry} companies like {company} solve {pain_point} in under 60 days.',
    'Hi {name}, one specific thing we do — eliminate {pain_point} for {industry} teams. That\'s it.',
  ],
};
