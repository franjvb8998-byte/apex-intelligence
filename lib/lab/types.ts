import type { ApexTone } from "@/components/design-system/tokens";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { OpportunityRiskFilter } from "@/lib/apex-opportunities/types";
import type {
  ApexDecision,
  ApexDecisionVerdictKind,
  ApexScoreComponent,
} from "@/lib/decision-engine/types";
import type { ExplainablePrediction } from "@/lib/explainable-ai/types";
import type { EvaluationReport } from "@/lib/learning-engine/types/evaluation";
import type { KnowledgeDiscovery } from "@/lib/learning-engine/types/knowledge";
import type { LearningCase } from "@/lib/learning-engine/types/case";
import type { ApexMatchRating } from "@/lib/match-rating/types";
import type { BankrollData, BankrollFixture } from "@/lib/bankroll/types";

export type LabModelStatus = "production" | "research" | "stub";

export type LabModelId =
  | "decision-engine"
  | "probability-engine"
  | "match-rating"
  | "explainable-ai"
  | "learning-engine"
  | "match-analysis-rules";

export type LabModelRecord = {
  id: LabModelId;
  name: string;
  version: string;
  role: string;
  method: string;
  status: LabModelStatus;
  sample: string;
  surfaces: string[];
  href: string;
  notes: string;
};

export type LabKpi = {
  label: string;
  value: string;
  tone?: ApexTone;
  hint?: string;
};

export type LabTableColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
};

export type LabTableRow = {
  id: string;
  href?: string;
  cells: Record<string, string>;
  tone?: ApexTone;
  badge?: { label: string; tone: ApexTone };
};

export type LabBar = {
  key: string;
  label: string;
  /** 0–1 display share. */
  weight: number;
  valueLabel: string;
  available: boolean;
  tone?: ApexTone;
};

export type LabPoint = {
  label: string;
  value: number;
};

export type LabStrategySpec = {
  id: string;
  name: string;
  minScore: number;
  minConfidence: number;
  /** Null = no EV floor (include negative / missing). */
  minEv: number | null;
  risk: OpportunityRiskFilter;
  verdicts: ApexDecisionVerdictKind[];
};

export type LabPaperResult = {
  spec: LabStrategySpec;
  passed: ApexOpportunity[];
  scanned: number;
  selected: number;
  averageScore: number | null;
  averageConfidence: number | null;
  averageEv: number | null;
  averageKelly: number | null;
  elite: number;
  skip: number;
};

export type LabBacktestMark = {
  id: string;
  label: string;
  predicted: string;
  actual: string;
  hit: boolean;
  brier: number;
  confidence: number;
  equity: number;
};

export type LabBacktest = {
  modelVersion: string;
  sampleLabel: string;
  sampleSize: number;
  hitRate: number;
  meanBrier: number;
  marks: LabBacktestMark[];
  equity: LabPoint[];
};

export type LabEngineCompareRow = {
  id: string;
  name: string;
  version: string;
  sample: string;
  paired: boolean;
  primaryLabel: string;
  primary: string;
  secondaryLabel: string;
  secondary: string;
  href: string;
  tone: ApexTone;
};

export type LabFeatureSeries = {
  id: string;
  title: string;
  description: string;
  bars: LabBar[];
};

export type LabDecisionView = {
  matchLabel: string;
  href: string;
  verdictLabel: string;
  verdictKind: ApexDecisionVerdictKind;
  selectionLabel: string;
  explanation: string;
  kpis: LabKpi[];
  components: ApexScoreComponent[];
  reasonsFor: Array<{ id: string; title: string; detail: string }>;
  reasonsAgainst: Array<{ id: string; title: string; detail: string }>;
};

export type LabWorkspace = {
  generatedAt: string;
  models: LabModelRecord[];
  versions: LabModelRecord[];
  scan: {
    ok: boolean;
    generatedAt: string | null;
    analyzed: ApexOpportunity[];
  };
  comparison: LabEngineCompareRow[];
  backtest: LabBacktest;
  report: EvaluationReport;
  knowledge: KnowledgeDiscovery[];
  cases: LearningCase[];
  book: BankrollData;
  fixtures: BankrollFixture[];
  featured: {
    label: string | null;
    href: string;
    decision: ApexDecision | null;
    rating: ApexMatchRating | null;
    explainable: ExplainablePrediction | null;
    probability: {
      modelVersion: string;
      home: number;
      draw: number;
      away: number;
    } | null;
  };
  features: LabFeatureSeries[];
  decision: LabDecisionView | null;
};
