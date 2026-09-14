import { useCallback, useMemo, useState } from 'react';
import { showToast } from '../components/AppToast';
import {
  addCondition,
  getConditionIndex,
  getConditionLabel,
  moveConditionAndClearGroups,
  removeConditionAndClearGroups,
  toggleConditionOperator,
  updateConditionComment,
} from '../util/conditionEditor';

const createStrategy = (index, kind = 'condition') => ({
  id: `strategy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: `${index}번 조건식`,
  kind,
  fixedType: '',
  conditions: [],
});

const cloneStrategies = (items) => items.map((strategy) => ({
  ...strategy,
  conditions: (strategy.conditions || []).map((condition) => ({
    ...condition,
    groupIds: [...(condition.groupIds || [])],
  })),
}));

export function useConditionEditor({ onEdit, onConditionsEmpty, onRequestConfirmation }) {
  const [strategies, setStrategies] = useState(() => [createStrategy(1)]);
  const [activeStrategyId, setActiveStrategyId] = useState(null);
  const [checkedLetters, setCheckedLetters] = useState(new Set());
  const [isGrouping, setIsGrouping] = useState(false);
  const [history, setHistory] = useState([]);

  const activeStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === activeStrategyId) || strategies[0],
    [activeStrategyId, strategies],
  );
  const selectedConditions = activeStrategy?.conditions || [];

  const resetSelection = useCallback(() => {
    setCheckedLetters(new Set());
    setIsGrouping(false);
  }, []);

  const saveHistory = useCallback(() => {
    setHistory((previous) => [...previous, {
      strategies: cloneStrategies(strategies),
      activeStrategyId,
    }].slice(-30));
  }, [activeStrategyId, strategies]);

  const undoLastEdit = useCallback(() => {
    const snapshot = history.at(-1);
    if (!snapshot) return;
    setStrategies(cloneStrategies(snapshot.strategies));
    setActiveStrategyId(snapshot.activeStrategyId);
    setHistory((previous) => previous.slice(0, -1));
    resetSelection();
    showToast('직전 조건식 변경을 되돌렸습니다.', 'success');
  }, [history, resetSelection]);

  const setSelectedConditions = useCallback((nextValue) => {
    setStrategies((previous) => previous.map((strategy) => {
      if (strategy.id !== activeStrategy?.id) return strategy;
      const conditions = typeof nextValue === 'function' ? nextValue(strategy.conditions) : nextValue;
      return { ...strategy, conditions: Array.isArray(conditions) ? conditions : [] };
    }));
  }, [activeStrategy?.id]);

  const replaceConditions = useCallback((conditions) => {
    setSelectedConditions(Array.isArray(conditions) ? conditions : []);
    resetSelection();
  }, [resetSelection, setSelectedConditions]);

  const clearConditions = useCallback(() => replaceConditions([]), [replaceConditions]);

  const resetStrategies = useCallback((conditions = []) => {
    const initial = createStrategy(1);
    initial.conditions = Array.isArray(conditions) ? conditions : [];
    setStrategies([initial]);
    setActiveStrategyId(initial.id);
    setHistory([]);
    resetSelection();
  }, [resetSelection]);

  const restoreStrategies = useCallback((savedStrategies, legacyConditions = []) => {
    const restored = Array.isArray(savedStrategies) && savedStrategies.length
      ? savedStrategies.map((strategy, index) => ({
        id: strategy.id || createStrategy(index + 1).id,
        name: strategy.name || `${index + 1}번 조건식`,
        kind: strategy.kind || 'condition',
        fixedType: strategy.fixedType || '',
        conditions: Array.isArray(strategy.conditions) ? strategy.conditions : [],
      }))
      : [{ ...createStrategy(1), conditions: Array.isArray(legacyConditions) ? legacyConditions : [] }];
    setStrategies(restored);
    setActiveStrategyId(restored[0].id);
    setHistory([]);
    resetSelection();
  }, [resetSelection]);

  const addStrategy = useCallback((kind = 'condition') => {
    saveHistory();
    const next = createStrategy(strategies.length + 1, kind);
    setStrategies((previous) => [...previous, next]);
    setActiveStrategyId(next.id);
    resetSelection();
    onEdit?.('strategy-add');
  }, [onEdit, resetSelection, saveHistory, strategies.length]);

  const selectStrategy = useCallback((id) => {
    setActiveStrategyId(id);
    resetSelection();
  }, [resetSelection]);

  const setActiveTemplateType = useCallback((fixedType) => {
    saveHistory();
    setStrategies((previous) => previous.map((strategy) => (
      strategy.id === activeStrategy?.id ? { ...strategy, kind: fixedType ? 'template' : 'condition', fixedType, conditions: fixedType ? [] : strategy.conditions } : strategy
    )));
    onEdit?.('template');
  }, [activeStrategy?.id, onEdit, saveHistory]);

  const removeStrategy = useCallback((id) => {
    if (strategies.length === 1) {
      clearConditions();
      return;
    }
    const index = strategies.findIndex((strategy) => strategy.id === id);
    const nextActive = strategies[index - 1] || strategies[index + 1];
    saveHistory();
    setStrategies((previous) => previous.filter((strategy) => strategy.id !== id));
    setActiveStrategyId(nextActive.id);
    resetSelection();
  }, [clearConditions, resetSelection, saveHistory, strategies]);

  const handleConditionClick = useCallback((condition) => {
    saveHistory();
    setStrategies((previous) => previous.map((strategy) => (
      strategy.id === activeStrategy?.id ? { ...strategy, kind: 'condition', fixedType: '', conditions: addCondition(strategy.conditions, condition) } : strategy
    )));
    onEdit?.('add');
  }, [activeStrategy?.id, onEdit, saveHistory]);

  const handleCommentChange = useCallback((index, comment) => {
    setSelectedConditions((previous) => updateConditionComment(previous, index, comment));
    onEdit?.('comment');
  }, [onEdit, setSelectedConditions]);

  const handleToggleOperator = useCallback((index) => {
    saveHistory();
    setSelectedConditions((previous) => toggleConditionOperator(previous, index));
    onEdit?.('operator');
  }, [onEdit, saveHistory, setSelectedConditions]);

  const handleMoveCondition = useCallback((index, direction) => {
    saveHistory();
    setSelectedConditions((previous) => moveConditionAndClearGroups(previous, index, direction));
    resetSelection();
    onEdit?.('move');
  }, [onEdit, resetSelection, saveHistory, setSelectedConditions]);

  const handleRemoveCondition = useCallback((index) => {
    const isLastCondition = selectedConditions.length === 1;
    saveHistory();
    setSelectedConditions((previous) => removeConditionAndClearGroups(previous, index));
    resetSelection();
    onEdit?.('remove');
    showToast('조건을 삭제했습니다. 상단 되돌리기로 복구할 수 있습니다.', 'info');
    if (isLastCondition) onConditionsEmpty?.();
  }, [onConditionsEmpty, onEdit, resetSelection, saveHistory, selectedConditions.length, setSelectedConditions]);

  const handleDuplicateCondition = useCallback((index) => {
    saveHistory();
    setSelectedConditions((previous) => {
      const source = previous[index];
      if (!source) return previous;
      const copied = {
        ...source,
        id: `copied-${Date.now()}`,
        groupIds: [],
        operator: 'and',
      };
      return [...previous, copied];
    });
    resetSelection();
    onEdit?.('duplicate');
  }, [onEdit, resetSelection, saveHistory, setSelectedConditions]);

  const handleLetterCheck = useCallback((letter) => {
    setCheckedLetters((previous) => {
      const next = new Set(previous);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  }, []);

  const handleGroupConditions = useCallback(() => {
    if (checkedLetters.size < 2) {
      showToast('괄호로 묶을 조건을 2개 이상 선택해 주세요.', 'error');
      setCheckedLetters(new Set());
      return;
    }
    const indices = Array.from(checkedLetters).map(getConditionIndex).filter((index) => index >= 0).sort((a, b) => a - b);
    if (indices.length !== checkedLetters.size || indices.some((index, position) => position > 0 && index - indices[position - 1] !== 1)) {
      showToast('연속된 조건만 하나의 그룹으로 묶을 수 있습니다.', 'error');
      setCheckedLetters(new Set());
      return;
    }
    const first = indices[0];
    const last = indices[indices.length - 1];
    const ranges = new Map();
    selectedConditions.forEach((condition, index) => (condition.groupIds || []).forEach((id) => {
      const range = ranges.get(id) || { start: index, end: index };
      ranges.set(id, { start: Math.min(range.start, index), end: Math.max(range.end, index) });
    }));
    const shared = indices.map((index) => selectedConditions[index]?.groupIds || []).reduce((all, ids) => all.filter((id) => ids.includes(id)));
    if (shared.some((id) => ranges.get(id)?.start === first && ranges.get(id)?.end === last)) {
      showToast('이미 같은 괄호 그룹으로 묶인 조건입니다.', 'error');
      setCheckedLetters(new Set());
      return;
    }
    const crossing = Array.from(ranges.values()).some(({ start, end }) => {
      const overlaps = start <= last && first <= end;
      return overlaps && !(first <= start && last >= end) && !(start <= first && end >= last);
    });
    if (crossing) {
      showToast('기존 괄호 범위를 가로지르는 그룹은 만들 수 없습니다.', 'error');
      setCheckedLetters(new Set());
      return;
    }
    const groupId = `manual-group-${Date.now()}`;
    saveHistory();
    setSelectedConditions((previous) => previous.map((condition, index) => (
      checkedLetters.has(getConditionLabel(index)) ? { ...condition, groupIds: [...(condition.groupIds || []), groupId] } : condition
    )));
    setCheckedLetters(new Set());
  }, [checkedLetters, saveHistory, selectedConditions, setSelectedConditions]);

  const handleToggleGroupMode = useCallback(() => {
    setIsGrouping((previous) => !previous);
    setCheckedLetters(new Set());
  }, []);

  const clearAllGroups = useCallback(() => {
    saveHistory();
    setSelectedConditions((previous) => previous.map((condition) => ({ ...condition, groupIds: [] })));
    setCheckedLetters(new Set());
  }, [saveHistory, setSelectedConditions]);

  const handleClearAllGroups = useCallback(() => {
    if (!selectedConditions.some((condition) => (condition.groupIds || []).length)) {
      showToast('해제할 괄호 그룹이 없습니다.', 'error');
      return;
    }
    onRequestConfirmation?.({ title: '모든 괄호 그룹을 해제할까요?', description: '설정한 괄호 그룹만 모두 해제합니다.', confirmLabel: '모든 그룹 해제', onConfirm: clearAllGroups });
  }, [clearAllGroups, onRequestConfirmation, selectedConditions]);

  return {
    strategies, activeStrategy, activeStrategyId: activeStrategy?.id, activeStrategyKind: activeStrategy?.kind || 'condition', activeTemplateType: activeStrategy?.fixedType || '', setActiveTemplateType, addStrategy, selectStrategy, removeStrategy, resetStrategies, restoreStrategies,
    selectedConditions, setSelectedConditions, checkedLetters, isGrouping, clearConditions, replaceConditions, resetSelection, canUndo: history.length > 0, undoLastEdit,
    handleConditionClick, handleCommentChange, handleToggleOperator, handleMoveCondition, handleRemoveCondition, handleDuplicateCondition,
    handleLetterCheck, handleGroupConditions, handleToggleGroupMode, handleClearAllGroups,
  };
}
