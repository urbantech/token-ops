/**
 * Types for Consultant Workspace (EPIC 11)
 */

export interface ConsultantAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  threshold: number;
  createdAt: string;
}

export interface ConsultantRecommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  estimatedSavings: number;
  effort: 'low' | 'medium' | 'high';
  priority: number; // 1-10
}

export interface ActionPlan {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'completed';
  items: ActionPlanItem[];
  totalExpectedSavings: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActionPlanItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  expectedSavings: number;
  effort: 'low' | 'medium' | 'high';
  dueDate?: string;
}

export interface CustomerInsight {
  alerts: ConsultantAlert[];
  recommendations: ConsultantRecommendation[];
  risks: string[];
  opportunities: string[];
}
