import Papa from 'papaparse';
import { CSVFile } from './csvParser';
import { format } from 'date-fns';

export const exportToCSV = (
  files: CSVFile[],
  categoryRules: Record<string, string>,
  notesRules: Record<string, string>,
): void => {
  const commentLines: string[] = [];

  for (const [merchant, category] of Object.entries(categoryRules)) {
    commentLines.push(`# RULE:category:${merchant}:${category}`);
  }

  for (const [merchant, notes] of Object.entries(notesRules)) {
    commentLines.push(`# RULE:notes:${merchant}:${notes}`);
  }

  const rows = files.flatMap((file) =>
    file.transactions.map((t) => ({
      'File Name': file.name,
      Date: format(t.date, 'dd/MM/yyyy'),
      'Business Name': t.businessName,
      Category: t.industry,
      'Transaction Amount': t.transactionAmount,
      'Debit Amount': t.debitAmount,
      Details: t.details,
      Notes: t.userNotes ?? '',
    })),
  );

  const csvTable = Papa.unparse(rows);
  const rulesPrefix = commentLines.length > 0 ? commentLines.join('\n') + '\n' : '';
  const fullCSVContent = '\uFEFF' + rulesPrefix + csvTable;

  const blob = new Blob([fullCSVContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `expense_analyzer_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
