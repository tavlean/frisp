import {
  getBulkExportSummary,
  getBulkOutputSummary,
  type BulkExportSummary,
  type BulkOutputSummary,
} from './export';
import {
  getBulkActionState,
  getDetailedBatchProgress,
  getOverrideSummary,
  getSelectedJobContext,
  type BatchProgress,
  type BulkActionState,
  type BulkSession,
  type OverrideSummary,
  type SelectedJobContext,
} from './session';
import {
  defaultBulkConcurrency,
  getBulkQueueState,
  type BulkQueueState,
} from './queue';

export interface BulkSessionSummary {
  totalJobs: number;
  progress: BatchProgress;
  selectedJob: SelectedJobContext;
  actions: BulkActionState;
  overrides: OverrideSummary;
  output: BulkOutputSummary;
  export: BulkExportSummary;
  queue: BulkQueueState;
}

export function getBulkSessionSummary(
  session: BulkSession,
  concurrency = defaultBulkConcurrency,
): BulkSessionSummary {
  return {
    totalJobs: session.jobs.length,
    progress: getDetailedBatchProgress(session),
    selectedJob: getSelectedJobContext(session),
    actions: getBulkActionState(session),
    overrides: getOverrideSummary(session),
    output: getBulkOutputSummary(session),
    export: getBulkExportSummary(session),
    queue: getBulkQueueState(session, concurrency),
  };
}
