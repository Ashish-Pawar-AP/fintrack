import { api, useApi } from '../lib/api';
import { refresh } from '../lib/bus';
import { isoDay } from '../lib/format';
import { FormModal, useToast } from './ui';

// Shared by the FAB and the Transactions page (edit mode via `edit`).
export default function QuickAdd({ kind, onClose, edit }) {
  const { data: accounts } = useApi('/accounts');
  const { data: cats } = useApi('/categories');
  const { data: goals } = useApi('/goals', undefined, kind === 'Goal');
  const toast = useToast();
  const type = edit ? edit.type : kind;
  const acc = (accounts || []).map((a) => ({ value: a._id, label: a.name }));
  const open = !!kind || !!edit;
  const TYPE = { Expense: 'EXPENSE', Income: 'INCOME', Transfer: 'TRANSFER' };
  const T = TYPE[type] || type;

  const fields = () => {
    if (type === 'Goal') return [
      { name: 'goal', label: 'Goal', type: 'select', options: (goals || []).map((g) => ({ value: g._id, label: g.name })) },
      { name: 'amount', label: 'Amount (₹)', type: 'number' }, { name: 'date', label: 'Date', type: 'date' }, { name: 'note', label: 'Note' },
    ];
    const f = [{ name: 'amount', label: 'Amount (₹)', type: 'number', placeholder: '0.00' }];
    if (T === 'TRANSFER') f.push({ name: 'account', label: 'From', type: 'select', options: acc }, { name: 'toAccount', label: 'To', type: 'select', options: acc });
    else f.push({ name: 'category', label: 'Category', type: 'select', options: cats?.[T] || [] }, { name: 'account', label: 'Account', type: 'select', options: acc });
    f.push({ name: 'date', label: 'Date', type: 'date' }, { name: 'description', label: 'Description', placeholder: T === 'EXPENSE' ? 'e.g. Swiggy' : '' });
    return f;
  };
  const initial = edit
    ? { amount: edit.amount, category: edit.category, account: edit.account?._id || edit.account, toAccount: edit.toAccount?._id || edit.toAccount, date: isoDay(edit.date), description: edit.description }
    : { date: isoDay(), account: accounts?.[0]?._id || '' };

  const submit = async (v) => {
    if (type === 'Goal') await api.post(`/goals/${v.goal}/contributions`, v);
    else if (edit) await api.patch(`/transactions/${edit._id}`, { ...v, type: T });
    else await api.post('/transactions', { ...v, type: T });
    toast.success(edit ? 'Transaction updated' : `${type} saved`);
    refresh();
  };
  return <FormModal open={open} onClose={onClose} title={edit ? 'Edit transaction' : `Add ${type?.toLowerCase() || ''}`} fields={fields} initial={initial} onSubmit={submit} submitLabel={edit ? 'Update' : 'Save'} />;
}
