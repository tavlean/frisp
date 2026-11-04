import { getBulkJobSizeSummary, type BulkJobSizeSummary } from './export';
import type { ImageRecipe } from '../recipe';
import {
  getJobEffectiveRecipe,
  getSelectedJobContext,
  type BulkSession,
  type ImageJob,
  type SelectedJobContext,
} from './session';

export interface BulkSelectedJobDetail {
  job: ImageJob;
  context: SelectedJobContext;
  effectiveRecipe: ImageRecipe;
  size: BulkJobSizeSummary;
  hasOverrides: boolean;
}

export function getBulkSelectedJobDetail(
  session: BulkSession,
): BulkSelectedJobDetail | undefined {
  const context = getSelectedJobContext(session);
  if (!context.job) return;

  const effectiveRecipe = getJobEffectiveRecipe(session, context.job.id);
  if (!effectiveRecipe) return;

  return {
    job: context.job,
    context,
    effectiveRecipe,
    size: getBulkJobSizeSummary(session, context.job),
    hasOverrides: context.job.ownRecipe !== undefined,
  };
}
