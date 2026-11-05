import { Loader2 } from 'lucide-react';
import { ProgressIndicator, Notice } from '../ui/Feedback';

export default function EstadoProgreso({ status, progressMsg, details }) {
  if (status === 'scraping') {
    const matchPct = /(\d+)\s*%/.exec(progressMsg || '');
    const pct = matchPct ? Number(matchPct[1]) : 45;
    return (
      <div className="p-4 rounded-lg bg-surface-secondary border border-border/70 space-y-3">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-body-emphasis text-text-primary truncate">{progressMsg}</p>
            {details && <p className="text-footnote text-text-secondary truncate">{details}</p>}
          </div>
        </div>
        <ProgressIndicator value={pct} thin />
      </div>
    );
  }

  if (status === 'success') {
    return (
      <Notice variant="success">
        <span className="font-medium text-text-primary">{progressMsg}</span>
      </Notice>
    );
  }

  if (status === 'error') {
    return (
      <Notice variant="error" title={progressMsg}>
        {details}
      </Notice>
    );
  }

  return null;
}
