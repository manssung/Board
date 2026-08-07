import { useCallback, useState } from 'react';
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

export function useConditionEditor({ onEdit, onConditionsEmpty, onRequestConfirmation }) {
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [checkedLetters, setCheckedLetters] = useState(new Set());
  const [isGrouping, setIsGrouping] = useState(false);

  const resetSelection = useCallback(() => {
    setCheckedLetters(new Set());
    setIsGrouping(false);
  }, []);

  const replaceConditions = useCallback((conditions) => {
    setSelectedConditions(Array.isArray(conditions) ? conditions : []);
    resetSelection();
  }, [resetSelection]);

  const clearConditions = useCallback(() => replaceConditions([]), [replaceConditions]);

  const handleConditionClick = useCallback((condition) => {
    setSelectedConditions(previous => addCondition(previous, condition));
    onEdit?.('add');
  }, [onEdit]);

  const handleCommentChange = useCallback((index, comment) => {
    setSelectedConditions(previous => updateConditionComment(previous, index, comment));
    onEdit?.('comment');
  }, [onEdit]);

  const handleToggleOperator = useCallback((index) => {
    setSelectedConditions(previous => toggleConditionOperator(previous, index));
    onEdit?.('operator');
  }, [onEdit]);

  const handleMoveCondition = useCallback((index, direction) => {
    setSelectedConditions((previous) => {
      const next = moveConditionAndClearGroups(previous, index, direction);
      return next;
    });
    resetSelection();
    onEdit?.('move');
  }, [onEdit, resetSelection]);

  const handleRemoveCondition = useCallback((index) => {
    const isLastCondition = selectedConditions.length === 1;
    setSelectedConditions(previous => removeConditionAndClearGroups(previous, index));
    resetSelection();
    onEdit?.('remove');
    if (isLastCondition) onConditionsEmpty?.();
  }, [onConditionsEmpty, onEdit, resetSelection, selectedConditions.length]);

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

    const indices = Array.from(checkedLetters)
      .map(getConditionIndex)
      .filter(index => index >= 0)
      .sort((first, second) => first - second);

    if (indices.length !== checkedLetters.size || indices.some((index, position) => position > 0 && index - indices[position - 1] !== 1)) {
      showToast('연속된 조건끼리만 그룹으로 묶을 수 있습니다.', 'error');
      setCheckedLetters(new Set());
      return;
    }

    const firstIndex = indices[0];
    const lastIndex = indices[indices.length - 1];
    const groupRanges = new Map();

    selectedConditions.forEach((condition, index) => {
      (condition.groupIds || []).forEach((groupId) => {
        const range = groupRanges.get(groupId) || { start: index, end: index };
        groupRanges.set(groupId, { start: Math.min(range.start, index), end: Math.max(range.end, index) });
      });
    });

    const selectedGroups = indices
      .map(index => selectedConditions[index]?.groupIds || [])
      .reduce((sharedIds, groupIds) => sharedIds.filter(id => groupIds.includes(id)));

    const hasExactExistingGroup = selectedGroups.some((groupId) => {
      const range = groupRanges.get(groupId);
      return range?.start === firstIndex && range?.end === lastIndex;
    });

    if (hasExactExistingGroup) {
      showToast('이미 같은 괄호 그룹으로 묶인 조건입니다.', 'error');
      setCheckedLetters(new Set());
      return;
    }

    const isCrossingExistingGroup = Array.from(groupRanges.values()).some(({ start, end }) => {
      const overlaps = start <= lastIndex && firstIndex <= end;
      const selectionContainsGroup = firstIndex <= start && lastIndex >= end;
      const groupContainsSelection = start <= firstIndex && end >= lastIndex;
      return overlaps && !selectionContainsGroup && !groupContainsSelection;
    });

    if (isCrossingExistingGroup) {
      showToast('기존 괄호 범위를 가로질러 새 그룹을 만들 수 없습니다.', 'error');
      setCheckedLetters(new Set());
      return;
    }

    const groupId = `manual-group-${Date.now()}`;
    setSelectedConditions(previous => previous.map((condition, index) => (
      checkedLetters.has(getConditionLabel(index))
        ? { ...condition, groupIds: [...(condition.groupIds || []), groupId] }
        : condition
    )));
    setCheckedLetters(new Set());
  }, [checkedLetters, selectedConditions]);

  const handleToggleGroupMode = useCallback(() => {
    setIsGrouping((previous) => !previous);
    setCheckedLetters(new Set());
  }, []);

  const clearAllGroups = useCallback(() => {
    setSelectedConditions(previous => previous.map(condition => ({ ...condition, groupIds: [] })));
    setCheckedLetters(new Set());
  }, []);

  const handleClearAllGroups = useCallback(() => {
    const hasGroups = selectedConditions.some(condition => (condition.groupIds || []).length > 0);
    if (!hasGroups) {
      showToast('해제할 괄호 그룹이 없습니다.', 'error');
      return;
    }

    onRequestConfirmation?.({
      title: '모든 괄호 그룹을 해제할까요?',
      description: '설정된 괄호 그룹만 모두 해제합니다.',
      confirmLabel: '모든 그룹 해제',
      onConfirm: clearAllGroups,
    });
  }, [clearAllGroups, onRequestConfirmation, selectedConditions]);

  return {
    selectedConditions,
    setSelectedConditions,
    checkedLetters,
    isGrouping,
    clearConditions,
    replaceConditions,
    resetSelection,
    handleConditionClick,
    handleCommentChange,
    handleToggleOperator,
    handleMoveCondition,
    handleRemoveCondition,
    handleLetterCheck,
    handleGroupConditions,
    handleToggleGroupMode,
    handleClearAllGroups,
  };
}
