/**
 * Types for AI Maturity Assessment (EPIC 10.2)
 */

export interface MaturityScore {
  category: MaturityCategory;
  score: number; // 0-100
  level: 'beginner' | 'developing' | 'proficient' | 'advanced' | 'expert';
  findings: string[];
  recommendations: string[];
}

export type MaturityCategory =
  | 'governance'
  | 'memory'
  | 'optimization'
  | 'automation'
  | 'agent_adoption';

export interface MaturityReport {
  overallScore: number;
  overallLevel: string;
  scores: MaturityScore[];
  generatedAt: string;
  period: { start: string; end: string };
  highlights: string[];
  risks: string[];
}
