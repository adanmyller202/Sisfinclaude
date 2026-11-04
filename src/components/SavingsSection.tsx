/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SavingGoal, SavingTransaction, CurrencyCode, LanguageCode } from '../types';
import { formatCurrency } from '../utils/currency';
import { getTranslations, getLocaleForLanguage } from '../utils/i18n';
import {
  PiggyBank,
  Plus,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Edit2,
  Trash2,
  CheckCircle2,
  Target,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface SavingsSectionProps {
  savings: SavingGoal[];
  transactions?: SavingTransaction[];
  currentBalance: number;
  currency: CurrencyCode;
  language?: LanguageCode;
  onOpenCreateModal: () => void;
  onOpenEditModal: (goal: SavingGoal) => void;
  onOpenTransferModal: (goalId?: string, type?: 'deposit' | 'withdrawal') => void;
  onDeleteGoal: (goalId: string) => Promise<void>;
}

export const SavingsSection: React.FC<SavingsSectionProps> = ({
  savings = [],
  transactions = [],
  currentBalance = 0,
  currency,
  language = 'pt',
  onOpenCreateModal,
  onOpenEditModal,
  onOpenTransferModal,
  onDeleteGoal,
}) => {
  const t = getTranslations(language);
  const locale = getLocaleForLanguage(language);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const safeSavings = Array.isArray(savings) ? savings : [];
  const totalSaved = safeSavings.reduce((sum, s) => sum + (s?.currentAmount || 0), 0);
  const totalTarget = safeSavings.reduce((sum, s) => sum + (s?.targetAmount || 0), 0);
  const overallPercentage = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  const handleDelete = async (goal: SavingGoal) => {
    if (confirm(`Deseja realmente excluir o cofrinho "${goal.name}"?`)) {
      try {
        setDeletingId(goal.id);
        await onDeleteGoal(goal.id);
      } catch (err) {
        console.error('Error deleting saving goal:', err);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const getDeadlineInfo = (deadlineStr?: string) => {
    if (!deadlineStr) return null;
    try {
      const targetDate = new Date(`${deadlineStr}T23:59:59`), now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / 86400000);
      const formatted = new Date(`${deadlineStr}T12:00:00`).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
      return { formatted, diffDays, isOverdue: diffDays < 0 };
    } catch { return null; }
  };

  const containerVariants: any = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const itemVariants: any = { hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } } };

  return (
    <div className="space-y-6">
      {/* Premium Overview Header */}
      {/* Premium Overview Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-[2.5rem] p-8 sm:p-10 shadow-md relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-10 opacity-10"><PiggyBank className="w-48 h-48 text-emerald-600" /></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[1.25rem] bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-600/20"><PiggyBank className="w-6 h-6 text-white" /></div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">Cofrinhos</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mt-2">Reservas Estratégicas</p>
              </div>
            </div>
            
            <div className="flex items-center gap-8">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Poupado</div>
                <div className="text-3xl font-black text-slate-900 font-mono tracking-tighter">{formatCurrency(totalSaved, currency)}</div>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Progresso</div>
                <div className="text-3xl font-black text-emerald-600 font-mono tracking-tighter">{overallPercentage}%</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={onOpenCreateModal} className="h-14 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-md transition-all flex items-center gap-3 cursor-pointer">
              <Plus className="w-5 h-5 stroke-[3]" /> Nova Reserva
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} disabled={safeSavings.length === 0} onClick={() => onOpenTransferModal()} className="h-14 px-8 rounded-2xl bg-white/80 border border-slate-200/80 text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-white transition-all flex items-center gap-3 disabled:opacity-30 shadow-xs cursor-pointer">
              <ArrowRightLeft className="w-5 h-5 text-emerald-600" /> Aporte Rápido
            </motion.button>
          </div>
        </div>

        <div className="mt-10 h-2.5 w-full bg-slate-200/80 rounded-full overflow-hidden border border-slate-200/50 relative z-10">
          <motion.div initial={{ width: 0 }} animate={{ width: `${overallPercentage}%` }} className="h-full bg-gradient-to-r from-emerald-600 to-teal-400" />
        </div>
      </motion.div>

      {/* Grid of Goals */}
      <AnimatePresence mode="popLayout">
        {safeSavings.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-24 glass-panel rounded-[3rem] text-center space-y-6 shadow-md">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto text-4xl shadow-xs">📦</div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900">Nenhum cofrinho ativo</h3>
              <p className="text-sm font-medium text-slate-600 max-w-xs mx-auto">Crie reservas para objetivos específicos como viagens, compras ou emergências.</p>
            </div>
            <button onClick={onOpenCreateModal} className="h-16 px-10 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-md cursor-pointer">Começar a Poupar</button>
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {safeSavings.map((goal, idx) => {
              const current = goal.currentAmount || 0, target = goal.targetAmount || 1;
              const percent = Math.min(100, Math.round((current / target) * 100));
              const deadlineInfo = getDeadlineInfo(goal.deadline);

              return (
                <motion.div key={goal.id} variants={itemVariants} className="glass-card rounded-[2.5rem] p-8 flex flex-col justify-between space-y-8 hover:border-emerald-500/40 transition-all group relative overflow-hidden shadow-md">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity"><div className="text-9xl">{goal.icon || '🎯'}</div></div>
                  
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center text-3xl shadow-xs transition-transform group-hover:scale-110">{goal.icon || '🎯'}</div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 leading-none uppercase tracking-tight">{goal.name}</h3>
                        {deadlineInfo && (
                          <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest mt-2 ${deadlineInfo.isOverdue ? 'text-rose-400' : 'text-slate-500'}`}>
                            <Calendar className="w-3 h-3" /> {deadlineInfo.formatted} • {deadlineInfo.isOverdue ? 'Vencido' : `${deadlineInfo.diffDays} dias`}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onOpenEditModal(goal)} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white transition-all"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(goal)} className="p-3 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>

                  <div className="space-y-4 relative z-10">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Acumulado</div>
                        <div className="text-2xl font-black text-emerald-400 font-mono tracking-tighter leading-none">{formatCurrency(current, currency)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Meta</div>
                        <div className="text-sm font-black text-white font-mono leading-none opacity-60">{formatCurrency(target, currency)}</div>
                      </div>
                    </div>
                    
                    <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className="h-full bg-gradient-to-r from-emerald-600 to-teal-400" />
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-emerald-500/80">
                      <span>{percent}% CONCLUÍDO</span>
                      <span className="text-slate-500">{percent >= 100 ? 'CONCLUÍDA 🎉' : `FALTA ${formatCurrency(Math.max(0, target - current), currency)}`}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 relative z-10 pt-4 border-t border-white/5">
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => onOpenTransferModal(goal.id, 'deposit')} className="flex-1 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2">
                      <ArrowUpRight className="w-4 h-4 stroke-[3]" /> Aporte
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => onOpenTransferModal(goal.id, 'withdrawal')} disabled={current <= 0} className="flex-1 h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest border border-white/10 flex items-center justify-center gap-2 disabled:opacity-30">
                      <ArrowDownLeft className="w-4 h-4 text-blue-400" /> Resgate
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
