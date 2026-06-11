import { DepartmentsEditor } from '../DepartmentsEditor';
import { WorkflowButton } from './WorkflowButton';
import type { BatchDetails } from '../../types/app';

interface BatchReviewViewProps {
  batchDetails: BatchDetails;
  runCommand: (command: string, path: string) => void;
  openCanvaExport: (batchPath: string) => void;
  openCanvaImport: (batchPath: string) => void;
  isLoading: boolean;
}

export function BatchReviewView({
  batchDetails,
  runCommand,
  openCanvaExport,
  openCanvaImport,
  isLoading,
}: BatchReviewViewProps) {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <WorkflowButton label="Export for Canva" onClick={() => openCanvaExport(batchDetails.name)} disabled={isLoading} />
        <WorkflowButton label="Import from Canva" onClick={() => openCanvaImport(batchDetails.name)} disabled={isLoading} />
        <WorkflowButton label="Generate" onClick={() => runCommand('generate', batchDetails.name)} disabled={isLoading} />
        <WorkflowButton label="Preflight" onClick={() => runCommand('preflight', batchDetails.name)} disabled={isLoading} />
        <WorkflowButton label="Post" onClick={() => runCommand('post', batchDetails.name)} variant="primary" disabled={isLoading} />
      </div>
      <DepartmentsEditor batchName={batchDetails.name} />
    </div>
  );
}
