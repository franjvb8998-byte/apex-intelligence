import { describe, expect, it } from "vitest";
import {
  buildLearningCase,
  createLearningEngine,
  createLearningEngineWithMocks,
  createMockLearningFixtures,
} from "@/lib/learning-engine";

describe("Learning Engine", () => {
  it("builds a learning case with market hits/misses and errors", () => {
    const [fixture] = createMockLearningFixtures();
    const learningCase = buildLearningCase(fixture!);

    expect(learningCase.outcomeCorrect).toBe(true);
    expect(learningCase.marketsHit.length).toBeGreaterThan(0);
    expect(learningCase.error.brierScore).toBeGreaterThanOrEqual(0);
    expect(learningCase.prediction.variables.length).toBeGreaterThan(0);
    expect(learningCase.prediction.factors.length).toBeGreaterThan(0);
  });

  it("registers, evaluates and accumulates knowledge from mocks", async () => {
    const { engine } = await createLearningEngineWithMocks();
    const cases = await engine.listCases();
    const report = await engine.evaluate(
      cases[0]?.prediction.modelVersion,
    );
    const knowledge = await engine.listKnowledge();

    expect(cases.length).toBe(4);
    expect(report.sampleSize).toBe(4);
    expect(report.accuracy.outcome).toBeGreaterThanOrEqual(0);
    expect(report.calibration.bins.length).toBe(5);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(knowledge.length).toBeGreaterThan(0);
  });

  it("recordAndLearn returns case + report + discoveries", async () => {
    const { engine } = createLearningEngine();
    const fixture = createMockLearningFixtures()[1]!;
    const result = await engine.recordAndLearn(fixture);

    expect(result.learningCase.outcomeCorrect).toBe(false);
    expect(result.report.sampleSize).toBe(1);
    expect(result.discoveries.length).toBeGreaterThan(0);
  });
});
