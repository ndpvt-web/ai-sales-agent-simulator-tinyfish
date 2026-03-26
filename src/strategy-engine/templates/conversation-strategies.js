/**
 * Conversation Strategy Parameter Space
 * =======================================
 * Defines the discrete dimensions of the conversation strategy search space.
 * Extends the email parameter space with conversation-specific dimensions.
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

export const FOLLOW_UP_CADENCES = [
  'aggressive',
  'patient',
  'mirroring',
  'challenge_response',
];

export const CLOSING_TECHNIQUES = [
  'assumptive',
  'summary',
  'next_step',
  'urgency',
  'value_recap',
];

/**
 * Conversation opener templates for Zoom/phone calls.
 * Placeholders: {name}, {company}, {pain_point}, {industry}
 */
export const CONVERSATION_OPENERS = {
  warm_personal: [
    'Hi {name}, thanks for making time today. I was reading about {company} before the call and was genuinely impressed — I\'d love to hear your perspective on where things are headed.',
    'Hi {name}, really appreciate the time. A mutual connection spoke highly of the work you\'re doing at {company}, and I was hoping to learn more before jumping into anything.',
  ],
  data_driven: [
    'Hi {name}, thanks for joining. I pulled some recent benchmarks on {industry} before this call — there\'s a pattern around {pain_point} I think will be directly relevant to you.',
    'Hi {name}, good to meet you. I want to share one data point up front that I think frames our conversation well — companies solving {pain_point} in {industry} are seeing significant competitive advantage.',
  ],
  provocative_question: [
    'Hi {name}, thanks for the time. I\'ll start with a direct question if that\'s okay — what would it mean for {company} if {pain_point} simply wasn\'t a constraint anymore?',
    'Hi {name}, good to connect. Before I say anything about what we do, I\'d love to ask you: how much of your week right now is spent dealing with {pain_point}?',
  ],
  mutual_connection: [
    'Hi {name}, great to finally connect — [Mutual Contact] has mentioned you a few times and I\'ve been looking forward to this conversation.',
    'Hi {name}, thanks for making time. Our mutual connection suggested we speak specifically about {pain_point}, and I think there might be a useful conversation here.',
  ],
  industry_insight: [
    'Hi {name}, appreciate the time today. I\'ve been spending a lot of time with {industry} leaders lately, and there\'s a consistent theme around {pain_point} I think is worth discussing.',
    'Hi {name}, good to meet you. I track {industry} pretty closely, and I keep seeing the same challenge surface — {pain_point} — I\'m curious how {company} is approaching it.',
  ],
  direct_value: [
    'Hi {name}, thanks for jumping on. I\'ll be direct — we help {industry} companies solve {pain_point} faster than they expect. I want to understand if that\'s relevant for {company}.',
    'Hi {name}, I appreciate you making room for this. Our focus is simple: we remove {pain_point} for {industry} teams. Let me ask a few questions and we\'ll see if there\'s a fit.',
  ],
};

/**
 * Closing technique scripts.
 * Placeholders: {name}, {company}, {pain_point}
 */
export const CLOSING_SCRIPTS = {
  assumptive: [
    'So {name}, it sounds like Tuesday or Thursday works best for your team — which do you prefer for a quick follow-up?',
    'Given what you\'ve shared, the logical next step is a 30-minute scoping session. I\'ll send a calendar invite — does next week work?',
  ],
  summary: [
    'To recap: you\'re dealing with {pain_point}, the current approach isn\'t scaling, and you need a solution by Q{n}. Our platform addresses all three. Does that match your understanding?',
    'So we\'ve covered the {pain_point} challenge, the impact on {company}, and what a solution would need to look like. I think we have a strong case for a next step. Agreed?',
  ],
  next_step: [
    '{name}, what would a useful next step look like on your end — a demo, a pilot conversation, or something else?',
    'I don\'t want to push for something that doesn\'t fit your process — what would be a natural next step from your side?',
  ],
  urgency: [
    '{name}, I want to be transparent — we have capacity opening up in the next two weeks, and given your timeline on {pain_point}, it might be worth moving sooner rather than later.',
    'There\'s a window here that I think aligns well with your Q{n} goals. Worth locking in a next step before it closes?',
  ],
  value_recap: [
    'Before we close, I just want to revisit what solving {pain_point} would mean for {company} — that\'s the north star here, and I think we\'re aligned on it.',
    '{name}, everything we\'ve talked about points back to one thing: eliminating {pain_point} at {company}. I\'d like to make sure we have a clear path forward.',
  ],
};
