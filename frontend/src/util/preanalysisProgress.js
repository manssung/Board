export function summarizePreanalysis(inquiries, selectedBroker, getStatus) {
  const counts = { total: 0, completed: 0, analyzing: 0, queued: 0, blocked: 0, retrying: 0, saving: 0, excluded: 0 };
  inquiries.filter((inquiry) => selectedBroker == null || inquiry.broker === selectedBroker).forEach((inquiry) => {
    counts.total += 1;
    const status = getStatus(inquiry);
    if (inquiry.hasImageAttachment || ['attachment', 'unsupported', 'no_result'].includes(status)) {
      counts.blocked += 1;
      if (inquiry.hasImageAttachment || ['attachment', 'unsupported'].includes(status)) counts.excluded += 1;
    } else if (['ready', 'needs_confirmation'].includes(status)) counts.completed += 1;
    else if (['loading_conditions', 'analyzing', 'waiting_remote'].includes(status)) counts.analyzing += 1;
    else {
      counts.queued += 1;
      // Keep retry details for controls, while showing a single waiting category.
      if (['storing', 'save_pending'].includes(status)) counts.saving += 1;
      if (['failed', 'limit_reached'].includes(status)) counts.retrying += 1;
    }
  });
  const processed = counts.completed + counts.blocked;
  return { ...counts, processed, percent: counts.total ? Math.round(processed / counts.total * 100) : 0 };
}
