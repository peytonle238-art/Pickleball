import React, { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Edit3,
  Mail,
  Plus,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import {
  GradeLevel,
  Officer,
  OfficerRole,
  OfficerTask,
  TaskStatus,
} from '../types';

interface OfficersTasksViewProps {
  officers: Officer[];
  tasks: OfficerTask[];
  isOfficer: boolean;
  onUpdateOfficers: (officers: Officer[]) => void;
  onUpdateTasks: (tasks: OfficerTask[]) => void;
  onRequestOfficerUnlock: () => void;
}

const OFFICER_ROLES: OfficerRole[] = [
  'President',
  'Vice President',
  'Secretary',
  'Treasurer',
  'Events Coordinator',
  'Social Media',
];

const TASK_COLUMNS: TaskStatus[] = ['To Do', 'In Progress', 'Done'];

export const OfficersTasksView: React.FC<OfficersTasksViewProps> = ({
  officers,
  tasks,
  isOfficer,
  onUpdateOfficers,
  onUpdateTasks,
  onRequestOfficerUnlock,
}) => {
  // Officer form state
  const [showOfficerForm, setShowOfficerForm] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<Officer | null>(null);
  const [offName, setOffName] = useState('');
  const [offRole, setOffRole] = useState<OfficerRole>('President');
  const [offGrade, setOffGrade] = useState<GradeLevel>(12);
  const [offContact, setOffContact] = useState('');
  const [offBio, setOffBio] = useState('');

  // Task form state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<OfficerTask | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('To Do');
  const [taskAssignee, setTaskAssignee] = useState(
    officers[0]?.name || 'Marcus Vance'
  );
  const [taskDueDate, setTaskDueDate] = useState('2026-11-05');
  const [taskCategory, setTaskCategory] = useState('Operations');

  const openAddOfficer = () => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingOfficer(null);
    setOffName('');
    setOffRole('Events Coordinator');
    setOffGrade(11);
    setOffContact('');
    setOffBio('');
    setShowOfficerForm(true);
  };

  const openEditOfficer = (o: Officer) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingOfficer(o);
    setOffName(o.name);
    setOffRole(o.role);
    setOffGrade(o.grade);
    setOffContact(o.contact);
    setOffBio(o.bio || '');
    setShowOfficerForm(true);
  };

  const handleSaveOfficer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offName.trim()) return;

    if (editingOfficer) {
      onUpdateOfficers(
        officers.map((o) =>
          o.id === editingOfficer.id
            ? {
                ...o,
                name: offName.trim(),
                role: offRole,
                grade: offGrade,
                contact: offContact.trim(),
                bio: offBio.trim() || undefined,
              }
            : o
        )
      );
    } else {
      const created: Officer = {
        id: `off-${Date.now()}`,
        name: offName.trim(),
        role: offRole,
        grade: offGrade,
        contact: offContact.trim() || 'officer@bnhs.edu',
        bio: offBio.trim() || undefined,
      };
      onUpdateOfficers([...officers, created]);
    }
    setShowOfficerForm(false);
    setEditingOfficer(null);
  };

  const openAddTask = () => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingTask(null);
    setTaskTitle('');
    setTaskStatus('To Do');
    setTaskAssignee(officers[0]?.name || 'Marcus Vance');
    setTaskDueDate('2026-11-05');
    setTaskCategory('Operations');
    setShowTaskForm(true);
  };

  const openEditTask = (t: OfficerTask) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingTask(t);
    setTaskTitle(t.title);
    setTaskStatus(t.status);
    setTaskAssignee(t.assignee);
    setTaskDueDate(t.dueDate);
    setTaskCategory(t.category);
    setShowTaskForm(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    if (editingTask) {
      onUpdateTasks(
        tasks.map((t) =>
          t.id === editingTask.id
            ? {
                ...t,
                title: taskTitle.trim(),
                status: taskStatus,
                assignee: taskAssignee,
                dueDate: taskDueDate,
                category: taskCategory.trim() || 'Club',
              }
            : t
        )
      );
    } else {
      const created: OfficerTask = {
        id: `task-${Date.now()}`,
        title: taskTitle.trim(),
        status: taskStatus,
        assignee: taskAssignee,
        dueDate: taskDueDate,
        category: taskCategory.trim() || 'Club',
      };
      onUpdateTasks([created, ...tasks]);
    }
    setShowTaskForm(false);
    setEditingTask(null);
  };

  const advanceTaskStatus = (task: OfficerTask) => {
    const nextStatus: TaskStatus =
      task.status === 'To Do'
        ? 'In Progress'
        : task.status === 'In Progress'
        ? 'Done'
        : 'To Do';
    onUpdateTasks(
      tasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Officer Cards */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Club Executive Officers
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              President, Vice President, Secretary, Treasurer, Events
              Coordinator, and Social Media
            </p>
          </div>

          <button
            onClick={openAddOfficer}
            className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: 'var(--club-primary)' }}
          >
            <Plus className="w-4 h-4" />
            Add Officer
          </button>
        </div>

        {/* Add/Edit Officer Form */}
        {showOfficerForm && (
          <form
            onSubmit={handleSaveOfficer}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {editingOfficer
                ? `Edit Officer: ${editingOfficer.name}`
                : 'Add Club Officer'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Officer Name
                </label>
                <input
                  type="text"
                  value={offName}
                  onChange={(e) => setOffName(e.target.value)}
                  required
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Executive Role
                </label>
                <select
                  value={offRole}
                  onChange={(e) => setOffRole(e.target.value as OfficerRole)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  {OFFICER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Grade
                </label>
                <select
                  value={offGrade}
                  onChange={(e) =>
                    setOffGrade(Number(e.target.value) as GradeLevel)
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value={9}>Grade 9</option>
                  <option value={10}>Grade 10</option>
                  <option value={11}>Grade 11</option>
                  <option value={12}>Grade 12</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Contact (Email / Social)
                </label>
                <input
                  type="text"
                  value={offContact}
                  onChange={(e) => setOffContact(e.target.value)}
                  placeholder="name@bnhs.edu · @handle"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Responsibilities Note
              </label>
              <input
                type="text"
                value={offBio}
                onChange={(e) => setOffBio(e.target.value)}
                placeholder="Brief summary of club responsibilities"
                className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOfficerForm(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--club-primary)' }}
              >
                Save Officer
              </button>
            </div>
          </form>
        )}

        {/* Officer Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {officers.map((officer) => (
            <div
              key={officer.id}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs font-bold tracking-wide text-blue-600 dark:text-blue-400">
                    {officer.role} · Grade {officer.grade}
                  </div>
                  {isOfficer && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditOfficer(officer)}
                        className="p-1.5 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        title="Edit Officer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          onUpdateOfficers(
                            officers.filter((o) => o.id !== officer.id)
                          )
                        }
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Remove Officer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {officer.name}
                </h3>

                {officer.bio && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                    {officer.bio}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{officer.contact}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Officer Task Board (To Do, In Progress, Done) */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Officer Operations Task Board
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track To Do, In Progress, and Done club tasks with assignees and
              due dates
            </p>
          </div>

          <button
            onClick={openAddTask}
            className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
            style={{ backgroundColor: 'var(--club-primary)' }}
          >
            <Plus className="w-4 h-4" />
            New Officer Task
          </button>
        </div>

        {/* Add/Edit Task Form */}
        {showTaskForm && (
          <form
            onSubmit={handleSaveTask}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {editingTask ? 'Edit Officer Task' : 'Create Officer Task'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Task Description
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Confirm court reservation for regional warmup"
                  required
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Assignee
                </label>
                <select
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  {officers.map((o) => (
                    <option key={o.id} value={o.name}>
                      {o.name} ({o.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Column Status
                </label>
                <select
                  value={taskStatus}
                  onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  {TASK_COLUMNS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTaskForm(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--club-primary)' }}
              >
                Save Task
              </button>
            </div>
          </form>
        )}

        {/* 3-Column Task Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TASK_COLUMNS.map((columnStatus) => {
            const columnTasks = tasks.filter((t) => t.status === columnStatus);

            return (
              <div
                key={columnStatus}
                className="rounded-2xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 space-y-3"
              >
                <div className="flex items-center justify-between px-1">
                  <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {columnStatus}
                  </span>
                  <span className="font-mono-num text-xs font-semibold text-slate-500">
                    {columnTasks.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {columnTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-medium text-slate-500">
                          {task.category}
                        </span>
                        <div className="flex items-center gap-1">
                          {isOfficer && (
                            <>
                              <button
                                onClick={() => openEditTask(task)}
                                className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                                title="Edit task"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  onUpdateTasks(
                                    tasks.filter((x) => x.id !== task.id)
                                  )
                                }
                                className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                                title="Delete task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                        {task.title}
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                          <User className="w-3.5 h-3.5" />
                          {task.assignee.split(' ')[0]}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Calendar className="w-3.5 h-3.5" />
                          {task.dueDate}
                        </span>
                      </div>

                      <button
                        onClick={() => advanceTaskStatus(task)}
                        className="w-full py-1.5 px-2.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>
                          Move to{' '}
                          {task.status === 'To Do'
                            ? 'In Progress'
                            : task.status === 'In Progress'
                            ? 'Done'
                            : 'To Do'}
                        </span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="py-6 text-center text-xs text-slate-400">
                      No tasks in {columnStatus}.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
