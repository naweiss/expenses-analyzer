import Papa from 'papaparse';
import { Transaction } from './csvParser';
import { format } from 'date-fns';

export const exportTransactionsToCSV = (transactions: Transaction[]) => {
  const data = transactions.map((t) => ({
    Date: format(t.date, 'dd/MM/yyyy'),
    'Business Name': t.businessName,
    Category: t.industry,
    'Transaction Amount': t.transactionAmount,
    'Debit Amount': t.debitAmount,
    Details: t.details,
    Notes: t.userNotes ?? '',
  }));

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `expenses_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
