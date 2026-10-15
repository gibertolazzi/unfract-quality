'use client';

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIAM } from '@/contexts/IamContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { useToast } from '@/contexts/ToastContext';
import { formatMessage } from '@/lib/i18n/formatMessage';
import { moveBlock, type MoveBlock, type MoveContext, type WorkflowColumn } from '@/lib/taskWorkflow';

type GuardTask = Parameters<typeof moveBlock>[0];

/**
 * Le regole del flusso (transizioni e condizioni, lib/taskWorkflow.ts) per
 * chi sposta un'attività: bacheca, spunta «fatto», dettaglio.
 */
export function useWorkflowGuard(columns: (WorkflowColumn & { title?: string })[]) {
  const { user } = useAuth();
  const { canWrite } = useIAM();
  const { t } = useTranslation();
  const toast = useToast();
  const isAdmin = canWrite('settings');
  const context: MoveContext = useMemo(() => ({ uid: user?.uid, isAdmin }), [user?.uid, isAdmin]);

  const message = useCallback((block: MoveBlock, task: GuardTask, toId: string) => {
    const name = (id?: string | null) => columns.find(c => c.id === id)?.title || '';
    const text: Record<MoveBlock, string> = {
      transition: t.tasks.moveBlockTransition,
      assignee: t.tasks.moveBlockAssignee,
      dueDate: t.tasks.moveBlockDueDate,
      assigneeOnly: t.tasks.moveBlockAssigneeOnly,
      adminOnly: t.tasks.moveBlockAdminOnly,
    };
    return formatMessage(text[block], { from: name(task.columnId), to: name(toId) });
  }, [columns, t]);

  const blockOf = useCallback((task: GuardTask, toId: string) => moveBlock(task, toId, columns, context), [columns, context]);

  /** true se l'attività può passare in `toId`; altrimenti mostra il motivo. */
  const check = useCallback((task: GuardTask, toId: string) => {
    const block = blockOf(task, toId);
    if (block) toast.error(message(block, task, toId));
    return !block;
  }, [blockOf, message, toast]);

  return { context, blockOf, check, message };
}
