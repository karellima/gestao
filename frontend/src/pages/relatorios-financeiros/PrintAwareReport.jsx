import { useState } from 'react';
import PrintPreview from '../../components/PrintPreview';
import ReportActions from './ReportActions';

export default function PrintAwareReport({ title, subtitle, columns, data, filters, children, renderPrint }) {
  const [printing, setPrinting] = useState(false);

  if (printing) {
    return (
      <PrintPreview title={title} subtitle={subtitle} onClose={() => setPrinting(false)} autoPrint>
        {renderPrint ? renderPrint() : children}
      </PrintPreview>
    );
  }

  return (
    <div className="space-y-4">
      <ReportActions title={title} columns={columns} data={data} onPrint={() => setPrinting(true)} />
      {filters}
      <div id="report-content">{children}</div>
    </div>
  );
}
