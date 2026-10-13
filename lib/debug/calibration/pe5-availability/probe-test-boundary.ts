/**
 * PE-5.3C testing boundary.
 *
 * This is the only supported place to inject an in-memory double.
 * Branding the double lets the runner reject plain objects. It does not
 * sandbox the callback, and runPe53bProbe never reads it.
 * Importing this module from production code is outside the public entry.
 */

import { createPe53bBrandedOfflineTransport } from "@/lib/debug/calibration/pe5-availability/probe-offline-capability";
import {
  buildPe53bPlan,
  executePe53bBrandedPlan,
  type Pe53bPlannedRequest,
  type Pe53bProbeReport,
} from "@/lib/debug/calibration/pe5-availability/probe-runner";
import type { Pe53bTransport } from "@/lib/debug/calibration/pe5-availability/probe-transport";

export async function runPe53bProbeForTests(input: {
  transport: Pe53bTransport;
  inMemoryConfirmation?: string | null;
}): Promise<Pe53bProbeReport> {
  return executePe53bPlanForTests({
    plan: buildPe53bPlan(),
    transport: input.transport,
    inMemoryConfirmation: input.inMemoryConfirmation,
  });
}

export async function executePe53bPlanForTests(input: {
  plan: readonly Pe53bPlannedRequest[];
  transport: Pe53bTransport;
  inMemoryConfirmation?: string | null;
}): Promise<Pe53bProbeReport> {
  return executePe53bBrandedPlan({
    plan: input.plan,
    transport: createPe53bBrandedOfflineTransport(input.transport.request),
    inMemoryConfirmation: input.inMemoryConfirmation,
  });
}
