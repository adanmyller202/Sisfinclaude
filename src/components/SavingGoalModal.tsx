/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SavingGoal, CurrencyCode, LanguageCode } from '../types';
import { getTranslations } from '../utils/i18n';
import { CURRENCIES } from '../utils/currency';
import { X, Target, Calendar, FileText, Check, AlertCircle, Sparkles } from 'lucide-react';

interface SavingGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    targetAmount: number;
    deadline?: string;
    icon?: string;
    notes?: string;
  }) => Promise<void>;
  goalToEdit?: SavingGoal | null;
  currency: CurrencyCode;
  language?: LanguageCode;
}

const POPULAR_ICONS = ['🏍️', '🚗', '🏠', '✈️', '💻', '💍', '🎓', '🏥', '🛡️', '🏖️', '📱', '🎯'];

export const SavingGoalModal: React.FC<SavingGoalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  goalToEdit,
  currency,
  language = 'pt',
}) => {
  const t = getTranslations(language);
  const currencySymbol = CURRENCIES[currency]?.symbol || '$';

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (goalToEdit) {
      setName(goalToEdit.name || '');
      setTargetAmount(goalToEdit.targetAmount ? String(goalToEdit.targetAmount) : '');
      setDeadline(goalToEdit.deadline || '');
      setIcon(goalToEdit.icon || '🎯');
      setNotes(goalToEdit.notes || '');
    } else {
      setName('');
      setTargetAmount('');
      setDeadline('');
      setIcon('🎯');
      setNotes('');
    }
    setError(null);
  }, [goalToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTarget = parseFloat(targetAmount.replace(/[^0-9.-]/g, ''));

    if (!name.trim()) {
      setError(language === 'es' ? 'Por favor, ingresa el nombre de la meta.' : 'Por favor, informe o nome do objetivo.');
      return;
    }

    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      setError(language === 'es' ? 'Por favor, ingresa un monto objetivo válido mayor que cero.' : 'Por favor, informe um valor objetivo válido.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        name: name.trim(),
        targetAmount: parsedTarget,
        deadline: deadline.trim() || undefined,
        icon: icon || '🎯',
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Error saving saving goal:', err);
      setError(err?.message || 'Error al guardar la meta de ahorro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain glass-overlay pt-safe pb-safe"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="glass-modal rounded-[2.5rem] max-w-md w-full max-h-[calc(100dvh-2.5rem)] sm:max-h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden relative shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Mesh Gradient */}
            <div className="relative p-8 shrink-0 overflow-hidden">
              <div className="absolute inset-0 mesh-gradient opacity-20" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <motion.div 
                    initial={{ rotate: -15, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner border border-emerald-500/20 text-3xl"
                  >
                    {icon}
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                      {goalToEdit ? t.editSavingModalTitle : t.createSavingModalTitle}
                    </h3>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mt-1 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-emerald-500" />
                      PLANEJAMENTO DE FUTURO
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all cursor-pointer flex items-center justify-center"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="mx-8 mt-2 p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-[11px] font-black uppercase tracking-widest flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-8 space-y-8 no-scrollbar">
                
                {/* Icon Selector */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                    {t.savingIconLabel || 'ÍCONE DO OBJETIVO'}
                  </label>
                  <div className="flex items-center gap-3 flex-wrap">
                    {POPULAR_ICONS.map((emoji) => (
                      <motion.button
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        key={emoji}
                        onClick={() => setIcon(emoji)}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl transition-all cursor-pointer border ${
                          icon === emoji
                            ? 'border-emerald-500 bg-emerald-500/20 shadow-lg shadow-emerald-500/10'
                            : 'border-slate-200 bg-white/80 hover:bg-[#D1FAEB]/30'
                        }`}
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                    {t.savingNameLabel || 'NOME DA META'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.savingNamePlaceholder}
                    className="w-full px-6 py-5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 text-slate-900 transition-all placeholder:text-slate-400"
                    required
                  />
                </div>

                {/* Target Amount */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                    {t.savingTargetLabel || 'VALOR OBJETIVO'}
                  </label>
                  <div className="relative group">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-600">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-12 pr-6 py-5 text-sm font-mono-numbers font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 text-slate-900 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Deadline */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    {t.deadlineLabel || 'PRAZO ESTIMADO'}
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-6 py-5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 text-slate-900 transition-all appearance-none"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    {t.savingNotesLabel || 'OBSERVAÇÕES'}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t.savingNotesPlaceholder}
                    className="w-full px-6 py-5 text-sm font-bold bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 focus:ring-slate-900/5 text-slate-900 min-h-32 resize-none transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Fixed Bottom Action Bar */}
              <div className="shrink-0 p-8 border-t border-slate-200/60 bg-white/80 backdrop-blur-2xl flex items-center justify-between gap-6 z-10">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-6 py-4 text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-[0.4em] transition-colors cursor-pointer"
                >
                  {t.cancelBtn}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting}
                  className="px-10 py-5 text-[11px] font-black text-white bg-emerald-600 rounded-2xl shadow-2xl shadow-emerald-600/20 disabled:opacity-50 uppercase tracking-[0.3em] cursor-pointer flex items-center gap-3 active:scale-95 transition-all"
                >
                  <Check className="w-5 h-5" />
                  <span>{isSubmitting ? 'SALVANDO...' : (goalToEdit ? 'ATUALIZAR META' : 'CRIAR META')}</span>
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
