import React, { useState } from 'react';
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Download,
  Edit3,
  Package,
  Pin,
  Plus,
  RotateCcw,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  Announcement,
  ClubSettings,
  EquipmentItem,
  Member,
  Officer,
  SeasonArchive,
  TreasuryCategory,
  TreasuryTransaction,
} from '../types';

/* ========================================================================= */
/* 1. ANNOUNCEMENTS VIEW                                                     */
/* ========================================================================= */
interface AnnouncementsViewProps {
  announcements: Announcement[];
  officers: Officer[];
  isOfficer: boolean;
  openComposerOnMount?: boolean;
  onUpdateAnnouncements: (list: Announcement[]) => void;
  onRequestOfficerUnlock: () => void;
}

export const AnnouncementsView: React.FC<AnnouncementsViewProps> = ({
  announcements,
  officers,
  isOfficer,
  openComposerOnMount = false,
  onUpdateAnnouncements,
  onRequestOfficerUnlock,
}) => {
  const [showForm, setShowForm] = useState(openComposerOnMount && isOfficer);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [authorName, setAuthorName] = useState(
    officers[0]?.name || 'Marcus Vance'
  );
  const [pinned, setPinned] = useState(false);

  const sorted = [...announcements].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.date.localeCompare(a.date);
  });

  const openNew = () => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingAnn(null);
    setTitle('');
    setBody('');
    setPinned(false);
    setShowForm(true);
  };

  const openEdit = (ann: Announcement) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingAnn(ann);
    setTitle(ann.title);
    setBody(ann.body);
    setAuthorName(ann.author);
    setPinned(ann.pinned);
    setShowForm(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    const matchedOfficer = officers.find((o) => o.name === authorName);
    const role = matchedOfficer ? matchedOfficer.role : 'Officer';

    if (editingAnn) {
      onUpdateAnnouncements(
        announcements.map((a) =>
          a.id === editingAnn.id
            ? {
                ...a,
                title: title.trim(),
                body: body.trim(),
                author: authorName,
                authorRole: role,
                pinned,
              }
            : a
        )
      );
    } else {
      const created: Announcement = {
        id: `ann-${Date.now()}`,
        title: title.trim(),
        body: body.trim(),
        author: authorName,
        authorRole: role,
        date: new Date().toISOString().slice(0, 10),
        pinned,
      };
      onUpdateAnnouncements([created, ...announcements]);
    }
    setShowForm(false);
    setEditingAnn(null);
  };

  const togglePin = (ann: Announcement) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    onUpdateAnnouncements(
      announcements.map((a) =>
        a.id === ann.id ? { ...a, pinned: !a.pinned } : a
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Club Announcements & Bulletins
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Officers post updates and pin priority announcements to the top
          </p>
        </div>
        <button
          onClick={openNew}
          className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
          style={{ backgroundColor: 'var(--club-primary)' }}
        >
          <Plus className="w-4 h-4" />
          Post Announcement
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSave}
          className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
        >
          <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {editingAnn ? 'Edit Announcement' : 'New Club Announcement'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Headline
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Court 1–4 Resurfacing Update for Thursday"
                required
                className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Posted By Officer
              </label>
              <select
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                {officers.map((o) => (
                  <option key={o.id} value={o.name}>
                    {o.name} ({o.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Message Body
            </label>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write announcement details..."
              required
              className="w-full p-3 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="rounded border-slate-300"
              />
              Pin announcement to top of board & Home dashboard
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--club-primary)' }}
              >
                Publish Announcement
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {sorted.map((ann) => (
          <div
            key={ann.id}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {ann.pinned && (
                    <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                      <Pin className="w-3.5 h-3.5" /> Pinned to Top ·
                    </span>
                  )}
                  <span>
                    Posted by{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {ann.author}
                    </strong>{' '}
                    ({ann.authorRole})
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{ann.date}</span>
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  {ann.title}
                </h3>
              </div>

              {isOfficer && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => togglePin(ann)}
                    className={`p-2 rounded-lg cursor-pointer ${
                      ann.pinned
                        ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/50'
                        : 'text-slate-400 hover:text-slate-800'
                    }`}
                    title={ann.pinned ? 'Unpin' : 'Pin to top'}
                  >
                    <Pin className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEdit(ann)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      onUpdateAnnouncements(
                        announcements.filter((a) => a.id !== ann.id)
                      )
                    }
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {ann.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 2. TREASURY VIEW (Dues Tracker + Income/Expense Ledger)                   */
/* ========================================================================= */
interface TreasuryViewProps {
  members: Member[];
  transactions: TreasuryTransaction[];
  defaultDuesAmount: number;
  isOfficer: boolean;
  onUpdateMembers: (members: Member[]) => void;
  onUpdateTransactions: (txs: TreasuryTransaction[]) => void;
  onRequestOfficerUnlock: () => void;
}

export const TreasuryView: React.FC<TreasuryViewProps> = ({
  members,
  transactions,
  defaultDuesAmount,
  isOfficer,
  onUpdateMembers,
  onUpdateTransactions,
  onRequestOfficerUnlock,
}) => {
  const [showTxForm, setShowTxForm] = useState(false);
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [txDesc, setTxDesc] = useState('');
  const [txCategory, setTxCategory] = useState<TreasuryCategory>('Fundraiser');
  const [txType, setTxType] = useState<'income' | 'expense'>('income');
  const [txAmount, setTxAmount] = useState<number>(50);

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);
  const runningBalance = totalIncome - totalExpenses;

  // Compute running balance chronologically
  const chronologicalAsc = [...transactions].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  let bal = 0;
  const ledgerWithRunning = chronologicalAsc
    .map((t) => {
      bal += t.type === 'income' ? t.amount : -t.amount;
      return { ...t, runningBalance: bal };
    })
    .reverse();

  const toggleMemberDues = (m: Member) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    const nextPaid = !m.duesPaid;
    onUpdateMembers(
      members.map((x) =>
        x.id === m.id
          ? {
              ...x,
              duesPaid: nextPaid,
              duesAmount: m.duesAmount || defaultDuesAmount,
              duesPaidDate: nextPaid
                ? new Date().toISOString().slice(0, 10)
                : undefined,
            }
          : x
      )
    );
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txDesc.trim()) return;
    const created: TreasuryTransaction = {
      id: `tx-${Date.now()}`,
      date: txDate,
      description: txDesc.trim(),
      category: txCategory,
      type: txType,
      amount: Math.abs(Number(txAmount)),
    };
    onUpdateTransactions([created, ...transactions]);
    setShowTxForm(false);
    setTxDesc('');
  };

  return (
    <div className="space-y-6">
      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="text-xs text-slate-500">Running Club Balance</div>
          <div className="font-mono-num text-3xl font-bold text-slate-900 dark:text-white mt-1">
            ${runningBalance.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Available for balls, paddles, shirts & tournament grants
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="text-xs text-slate-500">Total Income & Fundraisers</div>
          <div className="font-mono-num text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            +${totalIncome.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {members.filter((m) => m.duesPaid).length} of {members.length} members
            paid dues
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="text-xs text-slate-500">Total Equipment & Gear Expenses</div>
          <div className="font-mono-num text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
            -${totalExpenses.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Balls, loaner paddles & club shirts
          </div>
        </div>
      </div>

      {/* Two Columns: Member Dues Tracker + Income/Expense Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Member Dues Tracker (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Member Dues Tracker (${defaultDuesAmount})
              </h3>
              <p className="text-xs text-slate-500">
                Shows who has paid, amount, and payment date
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((m) => (
              <div
                key={m.id}
                className="py-3 flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {m.name}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {m.duesPaid
                      ? `Paid $${m.duesAmount} on ${m.duesPaidDate || '2026-09-01'}`
                      : `Unpaid ($${m.duesAmount} due)`}
                  </div>
                </div>

                <button
                  onClick={() => toggleMemberDues(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                    m.duesPaid
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {m.duesPaid && <Check className="w-3.5 h-3.5" />}
                  {m.duesPaid ? 'Paid' : 'Mark Paid'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Income & Expense Ledger (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Income & Expense Log
              </h3>
              <p className="text-xs text-slate-500">
                Fundraisers, balls, paddles, and shirts with running balance
              </p>
            </div>

            <button
              onClick={() => {
                if (!isOfficer) {
                  onRequestOfficerUnlock();
                  return;
                }
                setShowTxForm(!showTxForm);
              }}
              className="min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: 'var(--club-primary)' }}
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>

          {showTxForm && (
            <form
              onSubmit={handleAddTransaction}
              className="mb-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={txDesc}
                    onChange={(e) => setTxDesc(e.target.value)}
                    placeholder="e.g. Franklin X-40 Balls Restock"
                    required
                    className="w-full px-3 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Category
                  </label>
                  <select
                    value={txCategory}
                    onChange={(e) =>
                      setTxCategory(e.target.value as TreasuryCategory)
                    }
                    className="w-full px-3 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="Fundraiser">Fundraiser</option>
                    <option value="Dues">Dues</option>
                    <option value="Balls">Balls</option>
                    <option value="Paddles">Paddles</option>
                    <option value="Shirts">Shirts</option>
                    <option value="Tournament">Tournament</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Type
                  </label>
                  <select
                    value={txType}
                    onChange={(e) =>
                      setTxType(e.target.value as 'income' | 'expense')
                    }
                    className="w-full px-3 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="income">Income (+)</option>
                    <option value="expense">Expense (–)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Amount ($)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={txAmount}
                    onChange={(e) => setTxAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTxForm(false)}
                  className="px-3 py-1.5 rounded text-xs text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded text-xs font-bold text-white cursor-pointer"
                  style={{ backgroundColor: 'var(--club-primary)' }}
                >
                  Save Transaction
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 pr-2">Date</th>
                  <th className="py-2.5 px-2">Description & Category</th>
                  <th className="py-2.5 px-2 text-right">Amount</th>
                  <th className="py-2.5 pl-2 text-right">Running Bal.</th>
                  {isOfficer && <th className="py-2.5 pl-2 text-right"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {ledgerWithRunning.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-3 pr-2 font-mono-num text-xs text-slate-500 whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-3 px-2">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {tx.description}
                      </div>
                      <div className="text-xs text-slate-500">{tx.category}</div>
                    </td>
                    <td className="py-3 px-2 text-right font-mono-num font-bold whitespace-nowrap">
                      <span
                        className={
                          tx.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {tx.type === 'income' ? '+' : '–'}${tx.amount}
                      </span>
                    </td>
                    <td className="py-3 pl-2 text-right font-mono-num font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      ${tx.runningBalance}
                    </td>
                    {isOfficer && (
                      <td className="py-3 pl-2 text-right">
                        <button
                          onClick={() =>
                            onUpdateTransactions(
                              transactions.filter((x) => x.id !== tx.id)
                            )
                          }
                          className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 3. EQUIPMENT INVENTORY VIEW (Paddles, Balls, Nets Check-Out / Check-In)   */
/* ========================================================================= */
interface EquipmentViewProps {
  equipment: EquipmentItem[];
  members: Member[];
  isOfficer: boolean;
  onUpdateEquipment: (items: EquipmentItem[]) => void;
  onRequestOfficerUnlock: () => void;
}

export const EquipmentView: React.FC<EquipmentViewProps> = ({
  equipment,
  members,
  isOfficer,
  onUpdateEquipment,
  onRequestOfficerUnlock,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'Paddle' | 'Balls' | 'Net'
  >('all');
  const [checkoutItemId, setCheckoutItemId] = useState<string | null>(null);
  const [checkoutMemberId, setCheckoutMemberId] = useState<string>(
    members[0]?.id || ''
  );

  // Add new equipment item form
  const [showAddForm, setShowAddForm] = useState(false);
  const [eqName, setEqName] = useState('');
  const [eqCat, setEqCat] = useState<'Paddle' | 'Balls' | 'Net'>('Paddle');
  const [eqCode, setEqCode] = useState('PAD-06');
  const [eqCond, setEqCond] = useState<'Mint' | 'Good' | 'Fair'>('Mint');
  const [eqNotes, setEqNotes] = useState('');

  const handleConfirmCheckout = (itemId: string) => {
    onUpdateEquipment(
      equipment.map((item) =>
        item.id === itemId
          ? {
              ...item,
              checkedOutToMemberId: checkoutMemberId,
              checkedOutDate: new Date().toISOString().slice(0, 10),
            }
          : item
      )
    );
    setCheckoutItemId(null);
  };

  const handleCheckIn = (itemId: string) => {
    onUpdateEquipment(
      equipment.map((item) =>
        item.id === itemId
          ? {
              ...item,
              checkedOutToMemberId: null,
              checkedOutDate: null,
            }
          : item
      )
    );
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eqName.trim()) return;
    const created: EquipmentItem = {
      id: `eq-${Date.now()}`,
      name: eqName.trim(),
      category: eqCat,
      code: eqCode.trim() || 'EQ-01',
      condition: eqCond,
      checkedOutToMemberId: null,
      checkedOutDate: null,
      notes: eqNotes.trim() || 'Club Locker',
    };
    onUpdateEquipment([...equipment, created]);
    setShowAddForm(false);
    setEqName('');
  };

  const filtered = equipment.filter(
    (e) => categoryFilter === 'all' || e.category === categoryFilter
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Club Equipment Locker & Check-Out
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inventory of club paddles, balls, and nets with 1-tap member
              check-out and check-in
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['all', 'Paddle', 'Balls', 'Net'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {cat === 'all' ? 'All Gear' : `${cat}s`}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                if (!isOfficer) {
                  onRequestOfficerUnlock();
                  return;
                }
                setShowAddForm(!showAddForm);
              }}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: 'var(--club-primary)' }}
            >
              <Plus className="w-4 h-4" />
              Add Equipment
            </button>
          </div>
        </div>

        {showAddForm && (
          <form
            onSubmit={handleAddItem}
            className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
          >
            <div className="lg:col-span-2">
              <label className="block text-xs text-slate-500 mb-1">
                Item Name
              </label>
              <input
                type="text"
                value={eqName}
                onChange={(e) => setEqName(e.target.value)}
                placeholder="e.g. Six Zero DBD 16mm Loaner"
                required
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Category
              </label>
              <select
                value={eqCat}
                onChange={(e) =>
                  setEqCat(e.target.value as 'Paddle' | 'Balls' | 'Net')
                }
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <option value="Paddle">Paddle</option>
                <option value="Balls">Balls</option>
                <option value="Net">Net</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Asset Code / Condition
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={eqCode}
                  onChange={(e) => setEqCode(e.target.value)}
                  className="w-1/2 px-2 py-2 rounded-lg text-xs font-mono-num bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
                <select
                  value={eqCond}
                  onChange={(e) =>
                    setEqCond(e.target.value as 'Mint' | 'Good' | 'Fair')
                  }
                  className="w-1/2 px-2 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="Mint">Mint</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="min-h-[38px] px-4 py-2 rounded-lg text-xs font-bold text-white cursor-pointer"
              style={{ backgroundColor: 'var(--club-primary)' }}
            >
              Add to Inventory
            </button>
          </form>
        )}
      </div>

      {/* Equipment Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((item) => {
          const holder = members.find(
            (m) => m.id === item.checkedOutToMemberId
          );
          const isSelecting = checkoutItemId === item.id;

          return (
            <div
              key={item.id}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono-num font-bold text-slate-700 dark:text-slate-300">
                    {item.code} · {item.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>Condition: {item.condition}</span>
                    {isOfficer && (
                      <button
                        onClick={() =>
                          onUpdateEquipment(
                            equipment.filter((x) => x.id !== item.id)
                          )
                        }
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Delete equipment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  {item.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.notes}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                {holder ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="text-amber-600 dark:text-amber-400 font-bold block">
                        Checked Out to {holder.name}
                      </span>
                      <span className="text-slate-400 tabular-nums">
                        Since {item.checkedOutDate}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCheckIn(item.id)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                    >
                      Check In
                    </button>
                  </div>
                ) : isSelecting ? (
                  <div className="space-y-2">
                    <select
                      value={checkoutMemberId}
                      onChange={(e) => setCheckoutMemberId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (Grade {m.grade})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfirmCheckout(item.id)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer"
                        style={{ backgroundColor: 'var(--club-primary)' }}
                      >
                        Confirm Check-Out
                      </button>
                      <button
                        onClick={() => setCheckoutItemId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Available in Club Locker
                    </span>
                    <button
                      onClick={() => setCheckoutItemId(item.id)}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white cursor-pointer"
                    >
                      Check Out to Member
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 4. SETTINGS & SEASON ARCHIVE VIEW                                         */
/* ========================================================================= */
interface SettingsViewProps {
  settings: ClubSettings;
  archives: SeasonArchive[];
  isOfficer: boolean;
  onUpdateSettings: (settings: ClubSettings) => void;
  onResetAndArchiveSeason: (seasonLabel: string) => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  onResetFactoryData: () => void;
  onRequestOfficerUnlock: () => void;
}

const SCHOOL_COLOR_PRESETS = [
  { name: 'Bobcat Royal & Gold', primary: '#1d4ed8', secondary: '#eab308' },
  { name: 'Varsity Navy & Electric Lime', primary: '#1e3a8a', secondary: '#84cc16' },
  { name: 'Crimson & Championship Gold', primary: '#b91c1c', secondary: '#f59e0b' },
  { name: 'Forest Green & Crisp Gold', primary: '#15803d', secondary: '#eab308' },
  { name: 'Midnight Slate & Court Teal', primary: '#0f172a', secondary: '#14b8a6' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  archives,
  isOfficer,
  onUpdateSettings,
  onResetAndArchiveSeason,
  onExportJSON,
  onImportJSON,
  onResetFactoryData,
  onRequestOfficerUnlock,
}) => {
  const [clubName, setClubName] = useState(settings.clubName);
  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor);
  const [officerPin, setOfficerPin] = useState(settings.officerPin);
  const [seasonStartDate, setSeasonStartDate] = useState(
    settings.seasonStartDate
  );
  const [duesAmount, setDuesAmount] = useState(settings.duesAmount);
  const [savedBanner, setSavedBanner] = useState(false);

  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [archiveLabel, setArchiveLabel] = useState('Fall 2026 Season');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    onUpdateSettings({
      ...settings,
      clubName: clubName.trim() || 'BNHS Pickleball Club HQ',
      schoolName: schoolName.trim() || 'Byron Nelson High School',
      primaryColor,
      secondaryColor,
      officerPin: officerPin.replace(/\D/g, '').slice(0, 4).padEnd(4, '0'),
      seasonStartDate,
      duesAmount: Number(duesAmount) || 25,
    });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Club Configuration & School Colors (7 cols) */}
        <form
          onSubmit={handleSaveSettings}
          className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                Club Settings & School Colors
              </h2>
              <p className="text-xs text-slate-500">
                Customize club name, school colors, 4-digit Officer PIN, and
                season start date
              </p>
            </div>
            {!isOfficer && (
              <button
                type="button"
                onClick={onRequestOfficerUnlock}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 cursor-pointer"
              >
                Unlock Officer Mode to Edit
              </button>
            )}
          </div>

          {savedBanner && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              Settings saved and applied across BNHS Pickleball Club HQ!
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Club Name
              </label>
              <input
                type="text"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                disabled={!isOfficer}
                className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                High School Name
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                disabled={!isOfficer}
                className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Primary School Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={!isOfficer}
                  className="w-11 h-10 rounded cursor-pointer border border-slate-300"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={!isOfficer}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg text-xs font-mono-num bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Secondary School Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  disabled={!isOfficer}
                  className="w-11 h-10 rounded cursor-pointer border border-slate-300"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  disabled={!isOfficer}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg text-xs font-mono-num bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>
          </div>

          {/* Quick School Color Presets */}
          <div>
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Quick School Color Palettes:
            </span>
            <div className="flex flex-wrap gap-2">
              {SCHOOL_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  disabled={!isOfficer}
                  onClick={() => {
                    setPrimaryColor(preset.primary);
                    setSecondaryColor(preset.secondary);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: preset.primary }}
                  />
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: preset.secondary }}
                  />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                4-Digit Officer PIN
              </label>
              <input
                type="text"
                maxLength={4}
                value={officerPin}
                onChange={(e) => setOfficerPin(e.target.value)}
                disabled={!isOfficer}
                className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm font-mono-num bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Season Start Date
              </label>
              <input
                type="date"
                value={seasonStartDate}
                onChange={(e) => setSeasonStartDate(e.target.value)}
                disabled={!isOfficer}
                className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Default Semester Dues ($)
              </label>
              <input
                type="number"
                value={duesAmount}
                onChange={(e) => setDuesAmount(Number(e.target.value))}
                disabled={!isOfficer}
                className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm font-mono-num bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!isOfficer}
              className="min-h-[44px] px-6 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: 'var(--club-primary)' }}
            >
              Save Club Settings
            </button>
          </div>
        </form>

        {/* Right 5 Cols: JSON Backup/Restore + Season Reset & Archives */}
        <div className="lg:col-span-5 space-y-6">
          {/* JSON Backup & Restore Card */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Browser Storage & JSON Backup
            </h3>
            <p className="text-xs text-slate-500">
              All club data is automatically saved in browser localStorage.
              Export a JSON file anytime to back up or transfer devices.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onExportJSON}
                className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
                style={{ backgroundColor: 'var(--club-primary)' }}
              >
                <Download className="w-4 h-4" />
                Export JSON Backup
              </button>

              <label className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" />
                Import JSON Backup
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImportJSON(file);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Restore default sample dataset?
              </span>
              <button
                type="button"
                onClick={onResetFactoryData}
                className="font-semibold text-slate-700 dark:text-slate-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Sample Data
              </button>
            </div>
          </div>

          {/* Reset Season & Archive Stats Card */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  Season Archive & Reset
                </h3>
                <p className="text-xs text-slate-500">
                  Archives current season ladder standings and resets W–L & Elo
                  to 1200 for the new semester.
                </p>
              </div>
              <Archive className="w-5 h-5 text-amber-500" />
            </div>

            {!confirmArchiveOpen ? (
              <button
                type="button"
                onClick={() => {
                  if (!isOfficer) {
                    onRequestOfficerUnlock();
                    return;
                  }
                  setConfirmArchiveOpen(true);
                }}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer"
              >
                Reset Season & Archive Current Stats
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-3">
                <label className="block text-xs font-bold text-amber-900 dark:text-amber-200">
                  Archive Name for Completed Season:
                </label>
                <input
                  type="text"
                  value={archiveLabel}
                  onChange={(e) => setArchiveLabel(e.target.value)}
                  className="w-full px-3 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-amber-300"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onResetAndArchiveSeason(archiveLabel);
                      setConfirmArchiveOpen(false);
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-red-600 text-white cursor-pointer"
                  >
                    Confirm Archive & Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmArchiveOpen(false)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Past Archived Seasons List */}
            <div className="space-y-2.5 pt-2">
              <div className="text-xs font-semibold text-slate-500">
                Archived Seasons ({archives.length})
              </div>
              {archives.map((arch) => (
                <div
                  key={arch.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                    <span>{arch.seasonName}</span>
                    <span className="font-mono-num text-slate-500">
                      {arch.totalMatches} Matches
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {arch.startDate} to {arch.endDate}
                  </div>
                  <div className="pt-1 space-y-1">
                    {arch.topPlayers.map((tp, i) => (
                      <div
                        key={tp.name}
                        className="flex items-center justify-between text-slate-700 dark:text-slate-300"
                      >
                        <span>
                          #{i + 1} {tp.name}
                        </span>
                        <span className="font-mono-num font-semibold">
                          {tp.elo} Elo ({tp.wins}–{tp.losses})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
