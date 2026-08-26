import type {
  PredictionReport,
  ReasoningInput,
  ReasoningOutput,
  ReportService,
} from "@/lib/intelligence/reasoning/contracts";
import { notImplemented } from "@/lib/intelligence/reasoning/not-implemented";

export class StubReportService implements ReportService {
  async buildReport(
    _input: ReasoningInput,
    _output: ReasoningOutput,
  ): Promise<PredictionReport> {
    return notImplemented("ReportService.buildReport");
  }
}

export function createStubReportService(): ReportService {
  return new StubReportService();
}
