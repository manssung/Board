import { useCallback, useReducer } from 'react';

const initialState = {
  phase: 'idle',
  drafts: [],
  lastResult: null,
};

const resolveRestoredPhase = (drafts, selectedConditions) => {
  if (drafts.length > 0) return 'review';
  if (selectedConditions.length > 0) return 'editing';
  return 'idle';
};

function aiWorkflowReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return initialState;
    case 'RESTORE': {
      const drafts = Array.isArray(action.drafts) ? action.drafts : [];
      const selectedConditions = Array.isArray(action.selectedConditions) ? action.selectedConditions : [];
      return { phase: resolveRestoredPhase(drafts, selectedConditions), drafts, lastResult: null };
    }
    case 'REQUEST_STARTED':
      return { phase: 'loading', drafts: [], lastResult: null };
    case 'REQUEST_FAILED':
      return { ...state, phase: 'error' };
    case 'NO_RESULTS':
      return { ...state, phase: 'no_result', drafts: [], lastResult: null };
    case 'RECOMMENDATIONS_READY':
      return { phase: 'review', drafts: action.drafts, lastResult: action.lastResult };
    case 'ENTER_EDITING':
      return { ...state, phase: 'editing' };
    case 'EDITING_EMPTIED':
      return { ...state, phase: 'completed_empty' };
    case 'DRAFT_APPLIED': {
      const drafts = state.drafts.filter((_, index) => index !== action.index);
      return { ...state, drafts, phase: drafts.length === 0 ? 'editing' : 'partial_review' };
    }
    case 'ALL_DRAFTS_APPLIED':
      return { ...state, phase: 'editing', drafts: [] };
    case 'DRAFT_DISCARDED': {
      const drafts = state.drafts.filter((_, index) => index !== action.index);
      if (drafts.length === 0) {
        return { ...state, drafts, phase: action.hasSelectedConditions ? 'editing' : 'completed_empty' };
      }
      return { ...state, drafts, phase: action.hasSelectedConditions ? 'partial_review' : 'review' };
    }
    default:
      return state;
  }
}

export function useAiWorkflow() {
  const [state, dispatch] = useReducer(aiWorkflowReducer, initialState);

  const resetAiWorkflow = useCallback(() => dispatch({ type: 'RESET' }), []);
  const restoreAiWorkflow = useCallback((drafts, selectedConditions) => dispatch({ type: 'RESTORE', drafts, selectedConditions }), []);
  const startAiWorkflow = useCallback(() => dispatch({ type: 'REQUEST_STARTED' }), []);
  const failAiWorkflow = useCallback(() => dispatch({ type: 'REQUEST_FAILED' }), []);
  const setNoAiResults = useCallback(() => dispatch({ type: 'NO_RESULTS' }), []);
  const setAiRecommendations = useCallback((drafts, lastResult) => dispatch({ type: 'RECOMMENDATIONS_READY', drafts, lastResult }), []);
  const enterConditionEditing = useCallback(() => dispatch({ type: 'ENTER_EDITING' }), []);
  const markEditingEmpty = useCallback(() => dispatch({ type: 'EDITING_EMPTIED' }), []);
  const applyDraft = useCallback((index) => dispatch({ type: 'DRAFT_APPLIED', index }), []);
  const applyAllDrafts = useCallback(() => dispatch({ type: 'ALL_DRAFTS_APPLIED' }), []);
  const discardDraft = useCallback((index, hasSelectedConditions) => dispatch({ type: 'DRAFT_DISCARDED', index, hasSelectedConditions }), []);

  return {
    aiWorkflowPhase: state.phase,
    aiDraftConditions: state.drafts,
    lastAiResult: state.lastResult,
    resetAiWorkflow,
    restoreAiWorkflow,
    startAiWorkflow,
    failAiWorkflow,
    setNoAiResults,
    setAiRecommendations,
    enterConditionEditing,
    markEditingEmpty,
    applyDraft,
    applyAllDrafts,
    discardDraft,
  };
}
