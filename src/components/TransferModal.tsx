/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SavingGoal, CurrencyCode, LanguageCode } from '../types';
import { getTranslations } from '../utils/i18n';
import { formatCurrency, CURRENCIES } from '../utils/currency';
import { getTodayStr } from '../utils/finance';
import {
  X,
  ArrowRightLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Target,
  Calendar,
  AlertCircle,
  Check,
  Plus,
  MessageSquare,
} from 'lucide-react';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  savings: SavingGoal[];
  currentBalance: number;
  currency: CurrencyCode;
  language?: LanguageCode;
  defaultSavingId?: string;
  defaultType?: 'deposit' | 'withdrawal';
  onTransferToSaving: (savingId: string, amount: number, date?: string, note?: string) => Promise<void>;
  onWithdrawFromSaving: (savingId: string, amount: number, date?: string, note?: string) => Promise<void>;
  onOpenCreateSaving?: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  savings = [],
  currentBalance = 0,
  currency,
  language = 'pt',
  defaultSavingId,
  defaultType = 'deposit',
  onTransferToSaving,
  onWithdrawFromSaving,
  onOpenCreateSaving,
}) => {
  const t = getTranslations(language);
  const currencySymbol = CURRENCIES[currency]?.symbol || '$';

  const safeSavings = Array.isArray(savings) ? savings : [];
  const [mode, setMode] = useState<'deposit' | 'withdrawal'>(defaultType);
  const [selectedSavingId, setSelectedSavingId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayStr());
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(defaultType);
      if (defaultSavingId && safeSavings.some((s) => s.id === defaultSavingId)) {
        setSelectedSavingId(defaultSavingId);
      } else if (safeSavings.length > 0) {
        setSelectedSavingId(safeSavings[0].id);
      } else {
        setSelectedSavingId('');
      }
      setAmount('');
      setDate(getTodayStr());
      setNote('');
      setError(null);
    }
  }, [isOpen, defaultSavingId, defaultType, safeSavings]);

  const selectedGoal = safeSavings.find((s) => s.id === selectedSavingId);
  const parsedAmount = parseFloat(amount.replace(/[^0-9.-]/g, '')) || 0;

  const afterBalance =
    mode === 'deposit'
      ? currentBalance - parsedAmount
      : currentBalance + parsedAmount;

  const afterSavingAmount = selectedGoal
    ? mode === 'deposit'
      ? (selectedGoal.currentAmount || 0) + parsedAmount
      : Math.max(0, (selectedGoal.currentAmount || 0) - parsedAmount)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSavingId) {
      setError(language === 'es' ? 'Selecciona una meta de ahorro.' : 'Selecione uma meta de ahorro.');
      return;
    }

    if (parsedAmount <= 0) {
      setError(language === 'es' ? 'Ingresa un monto válido mayor que cero.' : 'Informe um valor maior que zero.');
      return;
    }

    if (mode === 'deposit' && parsedAmount > currentBalance && currentBalance > 0) {
      const proceed = confirm(
        language === 'es'
          ? `El monto a transferir (${formatCurrency(parsedAmount, currency)}) es mayor que tu saldo disponible (${formatCurrency(currentBalance, currency)}). ¿Deseas continuar de todas formas?`
          : `O valor a transferir (${formatCurrency(parsedAmount, currency)}) é maior que seu saldo disponível (${formatCurrency(currentBalance, currency)}). Deseja continuar?`
      );
      if (!proceed) return;
    }

    if (mode === 'withdrawal') {
      const saved = selectedGoal?.currentAmount || 0;
      if (parsedAmount > saved) {
        setError(
          language === 'es'
            ? `No puedes retirar más de lo que tienes ahorrado en esta meta (${formatCurrency(saved, currency)}).`
            : `Não é possível retirar mais do que o valor economizado (${formatCurrency(saved, currency)}).`
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (mode === 'deposit') {
        await onTransferToSaving(selectedSavingId, parsedAmount, date, note.trim() || undefined);
      } else {
        await onWithdrawFromSaving(selectedSavingId, parsedAmount, date, note.trim() || undefined);
      }

      onClose();
    } catch (err: any) {
      console.error('Error in transfer/withdrawal:', err);
      setError(err?.message || 'Error al procesar la transferencia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAmount = (val: number) => {
    setAmount(String(val));
  };

  const handleMaxAmount = () => {
    if (mode === 'deposit') {
      if (currentBalance > 0) setAmount(String(currentBalance));
    } else {
      if (selectedGoal && selectedGoal.currentAmount > 0) {
        setAmount(String(selectedGoal.currentAmount));
      }
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
            className="glass-modal rounded-[2.5rem] max-w-lg w-full max-h-[calc(100dvh-2.5rem)] sm:max-h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden relative shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Mesh Gradient */}
            <div className="relative p-8 shrink-0 overflow-hidden">
              <motion.div 
                layout
                className={`absolute inset-0 mesh-gradient opacity-20 transition-colors duration-700 ${
                  mode === 'deposit' ? 'from-emerald-500/40' : 'from-blue-500/40'
                }`} 
              />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <motion.div 
                    key={mode}
                    initial={{ rotate: -15, scale: 0.8 }}
                    animate={{ rotate: 0, scale: 1 }}
                    className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-inner border transition-colors duration-500 ${
                      mode === 'deposit' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                    }`}
                  >
                    <ArrowRightLeft className="w-8 h-8" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                      {t.transferModalTitle}
                    </h3>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] mt-1">
                      MOVIMENTAÇÃO DE SALDO
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
                
                {/* Direction Toggle */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">
                    {t.transferTypeLabel || 'TIPO DE MOVIMENTAÇÃO'}
                  </label>
                  <div className="grid grid-cols-2 gap-4 p-1.5 rounded-[1.25rem] bg-[#D1FAEB]/60 border border-emerald-500/20 relative overflow-hidden backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => setMode('deposit')}
                      className={`flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer relative z-10 ${
                        mode === 'deposit' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {mode === 'deposit' && (
                        <motion.div layoutId="transfer-mode-bg" className="absolute inset-0 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/20" />
                      )}
                      <ArrowUpRight className="w-4 h-4 relative z-10" />
                      <span className="relative z-10">APORTE</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('withdrawal')}
                      className={`flex items-center justify-center gap-2 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all cursor-pointer relative z-10 ${
                        mode === 'withdrawal' ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {mode === 'withdrawal' && (
                        <motion.div layoutId="transfer-mode-bg" className="absolute inset-0 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20" />
                      )}
                      <ArrowDownLeft className="w-4 h-4 relative z-10" />
                      <span className="relative z-10">RESGATE</span>
                    </button>
                  </div>
                </div>

                {/* Meta Selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">
                      {t.selectSavingGoal}
                    </label>
                    {onOpenCreateSaving && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCreateSaving();
                        }}
                        className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 cursor-pointer uppercase tracking-[0.2em] hover:scale-105 transition-transform bg-emerald-500/5 px-3 py-1.5 rounded-xl border border-emerald-500/20"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>NOVA META</span>
                      </button>
                    )}
                  </div>

                  {safeSavings.length === 0 ? (
                    <div className="p-10 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center space-y-5 bg-white/80">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Nenhuma meta criada</p>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCreateSaving?.();
                        }}
                        className="px-8 py-4 text-[10px] font-black text-white bg-emerald-600 rounded-2xl uppercase tracking-widest shadow-xl shadow-emerald-600/20"
                      >
                        Criar Agora
                      </button>
                    </div>
                  ) : (
                    <div className="relative group">
                      <select
                        value={selectedSavingId}
                        onChange={(e) => setSelectedSavingId(e.target.value)}
                        className="w-full px-6 py-5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 text-slate-900 cursor-pointer transition-all appearance-none"
                        required
                      >
                        {safeSavings.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.icon || '🎯'} {s.name} ({formatCurrency(s.currentAmount, currency)})
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                         <Target className="w-5 h-5" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                      {t.transferAmountLabel}
                    </label>
                    <button
                      type="button"
                      onClick={handleMaxAmount}
                      className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] hover:scale-105 transition-transform bg-blue-500/5 px-3 py-1.5 rounded-xl border border-blue-500/20"
                    >
                      MÁXIMO ({formatCurrency(mode === 'deposit' ? currentBalance : (selectedGoal?.currentAmount || 0), currency)})
                    </button>
                  </div>

                  <div className="relative group">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-600">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className={`w-full pl-12 pr-6 py-5 text-base font-mono-numbers font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 transition-all text-slate-900 ${
                         mode === 'deposit' ? 'focus:ring-emerald-500/30' : 'focus:ring-blue-500/30'
                      }`}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center gap-3 flex-wrap pt-1 px-1">
                    {[50000, 100000, 200000, 500000].map((val) => (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        key={val}
                        onClick={() => handleQuickAmount(val)}
                        className="px-4 py-2 text-[10px] font-black font-mono-numbers rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 transition-all cursor-pointer border border-emerald-100 shadow-xs uppercase tracking-widest"
                      >
                        +{formatCurrency(val, currency).replace(/\s/g, '')}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Impact Preview Card */}
                <AnimatePresence>
                  {selectedGoal && parsedAmount > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className="glass-emerald p-8 rounded-[2.5rem] text-slate-900 space-y-6 shadow-md border border-emerald-500/20 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                      <div className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">RESUMO DO IMPACTO</div>
                      
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                            <Wallet className="w-4 h-4 text-emerald-600" /> SALDO LIVRE
                          </div>
                          <div className="text-xl font-black font-mono-numbers tracking-tighter text-slate-900">
                            {formatCurrency(afterBalance, currency)}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                            <Target className="w-4 h-4 text-emerald-600" /> {selectedGoal.name}
                          </div>
                          <div className="text-xl font-black font-mono-numbers tracking-tighter text-emerald-700">
                            {formatCurrency(afterSavingAmount, currency)}
                          </div>
                        </div>
                      </div>

                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] pt-4 border-t border-emerald-500/10 italic">
                        {mode === 'deposit' ? '• REGISTRADO COMO INVESTIMENTO' : '• RETORNADO AO SALDO DISPONÍVEL'}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Date & Note */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                      <Calendar className={`w-4 h-4 ${mode === 'deposit' ? 'text-emerald-500' : 'text-blue-500'}`} /> DATA
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className={`w-full px-6 py-5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 transition-all appearance-none text-slate-900 ${
                        mode === 'deposit' ? 'focus:ring-emerald-500/30' : 'focus:ring-blue-500/30'
                      }`}
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 flex items-center gap-2">
                       <MessageSquare className="w-4 h-4 text-slate-400" /> OBSERVAÇÃO
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ex: Aporte mensal..."
                      className={`w-full px-6 py-5 text-sm font-black bg-white/80 border border-slate-200/80 rounded-[1.5rem] focus:outline-hidden focus:ring-2 transition-all text-slate-900 ${
                        mode === 'deposit' ? 'focus:ring-emerald-500/30' : 'focus:ring-blue-500/30'
                      }`}
                    />
                  </div>
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
                  disabled={isSubmitting || safeSavings.length === 0}
                  className={`px-10 py-5 text-[11px] font-black text-white rounded-2xl shadow-2xl transition-all uppercase tracking-[0.3em] cursor-pointer flex items-center gap-3 active:scale-95 ${
                    mode === 'deposit' ? 'bg-emerald-600 shadow-emerald-600/30' : 'bg-blue-600 shadow-blue-600/30'
                  }`}
                >
                  <Check className="w-5 h-5" />
                  <span>
                    {isSubmitting ? 'PROCESSANDO...' : (mode === 'deposit' ? 'CONFIRMAR APORTE' : 'CONFIRMAR RESGATE')}
                  </span>
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
