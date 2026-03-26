/**
 * CONTRACTS: The Source of Truth
 * ================================
 * Aristotelian Axiom A6: Modules communicate ONLY through these contracts.
 * Every module imports from here. No module imports from another module directly.
 *
 * If you change a contract, you change the system. That's by design.
 */

// ============================================================
// LAYER 1: Primitives (irreducible atoms)
// ============================================================

/** @typedef {'email' | 'conversation'} SimulationMode */

/** @typedef {'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism'} BigFiveTrait */

/** @typedef {'analytical' | 'driver' | 'amiable' | 'expressive'} CommunicationStyle */

/** @typedef {'low' | 'medium' | 'high'} IntensityLevel */

/**
 * @typedef {Object} PersonalityScores
 * @property {number} openness - 0.0 to 1.0
 * @property {number} conscientiousness - 0.0 to 1.0
 * @property {number} extraversion - 0.0 to 1.0
 * @property {number} agreeableness - 0.0 to 1.0
 * @property {number} neuroticism - 0.0 to 1.0
 */

// ============================================================
// LAYER 2: Profiler Contracts (raw data -> structured profile)
// ============================================================

/**
 * @typedef {Object} RawClientData
 * @property {string} name - Full name of target client
 * @property {string} [title] - Job title
 * @property {string} [company] - Company name
 * @property {string} [industry] - Industry sector
 * @property {string[]} [linkedinPosts] - Array of LinkedIn post texts
 * @property {string[]} [tweets] - Array of tweet texts
 * @property {string[]} [blogPosts] - Array of blog post texts
 * @property {string[]} [publicStatements] - Interviews, talks, quotes
 * @property {string[]} [companyInfo] - Company news, press releases
 * @property {Object} [metadata] - Any additional structured data
 */

/**
 * @typedef {Object} ClientProfile
 * @property {string} id - Unique profile identifier
 * @property {string} name
 * @property {string} title
 * @property {string} company
 * @property {string} industry
 * @property {PersonalityScores} personality - Big Five scores
 * @property {CommunicationStyle} communicationStyle
 * @property {string[]} values - Core values inferred from data
 * @property {string[]} painPoints - Business pain points
 * @property {string[]} priorities - Current priorities
 * @property {string[]} objectionPatterns - Likely objection types
 * @property {string[]} persuasionTriggers - What motivates decisions
 * @property {string[]} turnOffs - What causes disengagement
 * @property {string} decisionStyle - How they make decisions
 * @property {string} summary - 2-3 paragraph behavioral summary
 */

// ============================================================
// LAYER 3: Twin Engine Contracts (profile -> agent persona)
// ============================================================

/**
 * @typedef {Object} TwinPersona
 * @property {string} profileId - Links back to ClientProfile.id
 * @property {string} systemPrompt - The full system prompt for the client agent
 * @property {string} model - Which LLM model to use
 * @property {number} temperature - 0.0 to 1.0
 */

// ============================================================
// LAYER 4: Strategy Engine Contracts (parameterized strategies)
// ============================================================

/**
 * @typedef {Object} StrategyParams
 * @property {string} id - Unique strategy identifier
 * @property {SimulationMode} mode - 'email' or 'conversation'
 * @property {string} openingStyle - e.g. 'warm_personal', 'data_driven', 'provocative_question'
 * @property {string} valueFrame - e.g. 'roi_focused', 'risk_reduction', 'competitive_edge'
 * @property {IntensityLevel} urgencyLevel
 * @property {string} emotionalTone - e.g. 'empathetic', 'authoritative', 'collaborative'
 * @property {string} objectionHandling - e.g. 'acknowledge_redirect', 'data_counter', 'social_proof'
 * @property {string} [emailSubject] - For email mode only
 * @property {string} [emailBody] - For email mode: the full email text
 * @property {string} [conversationOpener] - For conversation mode: opening line
 * @property {string} [followUpCadence] - e.g. 'aggressive', 'patient', 'mirroring'
 */

/**
 * @typedef {Object} SalesAgentConfig
 * @property {string} strategyId - Links to StrategyParams.id
 * @property {string} systemPrompt - System prompt for the sales agent
 * @property {string} model - LLM model
 * @property {number} temperature
 */

// ============================================================
// LAYER 5: Simulator Contracts (execution + results)
// ============================================================

/**
 * @typedef {Object} Message
 * @property {'sales_agent' | 'client'} role
 * @property {string} content
 * @property {number} timestamp - Unix ms
 */

/**
 * @typedef {Object} SimulationResult
 * @property {string} id - Unique simulation ID
 * @property {string} strategyId
 * @property {string} profileId
 * @property {SimulationMode} mode
 * @property {Message[]} transcript - Full conversation
 * @property {SimulationMetrics} metrics
 * @property {number} startTime
 * @property {number} endTime
 * @property {string} modelUsed - Which model was the client twin
 */

/**
 * @typedef {Object} SimulationMetrics
 * @property {number} engagementScore - 0-100: how engaged the client was
 * @property {number} sentimentProgression - -1.0 to 1.0: sentiment shift over conversation
 * @property {number} objectionCount - Number of objections raised
 * @property {number} objectionSeverity - 0-100: average severity
 * @property {number} meetingAcceptance - 0-100: likelihood of accepting next step
 * @property {number} trustIndicator - 0-100: rapport/trust level
 * @property {number} turnCount - Number of exchange turns
 * @property {string[]} objectionTypes - Categorized objection types
 * @property {string} clientFinalSentiment - Last assessed sentiment
 * @property {string} outcome - 'positive', 'neutral', 'negative', 'hostile'
 */

// ============================================================
// LAYER 6: Analyzer Contracts (aggregated insights)
// ============================================================

/**
 * @typedef {Object} StrategyRanking
 * @property {string} strategyId
 * @property {number} rank
 * @property {number} winRate - Percentage of positive outcomes
 * @property {number} avgEngagement
 * @property {number} avgMeetingAcceptance
 * @property {number} avgTrust
 * @property {number} avgObjections
 * @property {number} sampleSize - Number of simulations
 */

/**
 * @typedef {Object} AnalysisReport
 * @property {string} profileId
 * @property {SimulationMode} mode
 * @property {number} totalSimulations
 * @property {StrategyRanking[]} rankings - Sorted by winRate desc
 * @property {Object} commonObjections - {type: count}
 * @property {string[]} insights - AI-generated tactical insights
 * @property {Object} bestStrategy - The top-ranked strategy details
 * @property {string} playbook - Generated playbook text
 * @property {number} analysisTimestamp
 */

// ============================================================
// MODULE INTERFACES (what each module must export)
// ============================================================

/**
 * Profiler Interface:
 *   buildProfile(rawData: RawClientData) -> Promise<ClientProfile>
 *
 * Twin Engine Interface:
 *   createTwin(profile: ClientProfile, model?: string) -> Promise<TwinPersona>
 *
 * Strategy Engine Interface:
 *   generateStrategies(mode: SimulationMode, count: number, profile: ClientProfile) -> Promise<StrategyParams[]>
 *   buildSalesAgent(strategy: StrategyParams, profile: ClientProfile) -> Promise<SalesAgentConfig>
 *
 * Simulator Interface:
 *   runEmailSim(salesAgent: SalesAgentConfig, twin: TwinPersona, strategy: StrategyParams) -> Promise<SimulationResult>
 *   runConversationSim(salesAgent: SalesAgentConfig, twin: TwinPersona, strategy: StrategyParams, maxTurns?: number) -> Promise<SimulationResult>
 *
 * Analyzer Interface:
 *   analyze(results: SimulationResult[], profile: ClientProfile) -> Promise<AnalysisReport>
 */

export const CONTRACT_VERSION = '1.0.0';
