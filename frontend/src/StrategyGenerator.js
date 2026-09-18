import React, { useState, useEffect, useRef, useCallback } from 'react';
import './css/StrategyGenerator.css';
import BrokerSelector from '../src/components/BrokerSelector';
import ConditionSearch from '../src/components/Condition Search';
import ConditionList from '../src/components/Condition List';
import SelectedConditions from '../src/components/Selected Conditions';
import GeneratedMent from '../src/components/Generated Ment';
import fixedMentMap from './data/fixedMentMap.js';
import brokerMap from './data/brokerMap.js';
import { useBrokerData } from './hooks/useBrokerData';
import { useAiStrategyGenerator } from './hooks/useAiStrategyGenerator';
import { useAiWorkflow } from './hooks/useAiWorkflow';
import { useConditionEditor } from './hooks/useConditionEditor';
import {
  groupOrConditions,
} from './util/conditionEditor';
import { getRecommendationCandidates } from './util/conditionCandidateFilter';
import { useSavedStrategies } from './hooks/useSavedStrategies';
import SavedStrategies from './components/SavedStrategies';
import AppToast, { showToast } from './components/AppToast';
import AiDraftList from './components/AiDraftList';
import WorkspaceEmptyState from './components/WorkspaceEmptyState';
import { useUnansweredInquiries } from './hooks/useUnansweredInquiries';


const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// 이미지 첨부 기능은 검토 후 다시 공개할 수 있도록 코드만 보관합니다.
const ENABLE_IMAGE_ATTACHMENT = false;
const INBOX_PAGE_SIZE = 5;


const readImageAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
  reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
  reader.readAsDataURL(file);
});

export default function StrategyGenerator() {
  const brokers = Object.keys(brokerMap);

  const [selectedBroker, setSelectedBroker] = useState("");
  const [search, setSearch] = useState("");

  const [customerQuery, setCustomerQuery] = useState(""); 
  const { isAiLoading, generateStrategy } = useAiStrategyGenerator();
  const [activeTab, setActiveTab] = useState('ai'); 
  const {
    aiWorkflowPhase,
    aiDraftConditions,
    lastAiResult,
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
  } = useAiWorkflow();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSavedStrategiesOpen, setIsSavedStrategiesOpen] = useState(false);
  const savedStrategiesRef = useRef(null);
  const isImportingInboxInquiryRef = useRef(false);
  const [imageAttachment, setImageAttachment] = useState(null);
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const [isRestoringSavedStrategy, setIsRestoringSavedStrategy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [isInboxPickerOpen, setIsInboxPickerOpen] = useState(false);
  const { inquiries: inboxInquiries, loading: inboxLoading, error: inboxError, refresh: refreshInbox, lastUpdatedAt: inboxLastUpdatedAt } = useUnansweredInquiries(isInboxPickerOpen && activeTab === 'ai');
  const [inboxBrokerFilter, setInboxBrokerFilter] = useState('전체');
  const [inboxSortOrder, setInboxSortOrder] = useState('oldest');
  const [inboxPage, setInboxPage] = useState(1);
  const [inboxAttachmentNotice, setInboxAttachmentNotice] = useState(false);
  const [inboxSourceInquiry, setInboxSourceInquiry] = useState(null);
  const { savedStrategies, saveStrategy, deleteSavedStrategy } = useSavedStrategies();

  const inboxBrokers = [...new Set(inboxInquiries.map((inquiry) => inquiry.broker))];
  const visibleInboxInquiries = inboxInquiries
    .filter((inquiry) => inboxBrokerFilter === '전체' || inquiry.broker === inboxBrokerFilter)
    .sort((left, right) => (inboxSortOrder === 'oldest' ? left.receivedAt.localeCompare(right.receivedAt) : right.receivedAt.localeCompare(left.receivedAt)));
  const inboxPageCount = Math.max(1, Math.ceil(visibleInboxInquiries.length / INBOX_PAGE_SIZE));
  const currentInboxPage = Math.min(inboxPage, inboxPageCount);
  const pagedInboxInquiries = visibleInboxInquiries.slice(
    (currentInboxPage - 1) * INBOX_PAGE_SIZE,
    currentInboxPage * INBOX_PAGE_SIZE,
  );
  const inboxPageNumbers = Array.from({ length: inboxPageCount }, (_, index) => index + 1)
    .filter((page) => page === 1 || page === inboxPageCount || Math.abs(page - currentInboxPage) <= 1);
  const usageGuide = activeTab === 'manual'
    ? {
        title: '사용 방법 · 조건식 편집',
        description: '조건 카탈로그에서 항목을 직접 구성하고, 상세값과 논리 구조를 검토해 조건식을 완성합니다.',
        steps: [
          { screenTitle: '조건 카탈로그', visual: ['가격지표 · 거래량분석', '기술적지표 · 재무분석'], cta: '조건 추가', title: '조건 찾기', description: '좌측 카탈로그에서 필요한 조건을 전략에 추가합니다.' },
          { screenTitle: '선택된 조건', visual: ['A  종가 · 60일 이동평균 상향', 'B  거래량 · 평균 대비 3배'], cta: '상세값 수정', title: '상세값 조정', description: '하단 설정 영역에서 기간·값·비교 기준을 바로 수정합니다.' },
          { screenTitle: '조건식', visual: ['A  AND  B', '( A  OR  B )  AND  C'], cta: '그룹 설정', title: '논리 구조 편집', description: '연결 방식과 괄호 그룹을 설정해 의도한 조건식을 만듭니다.' },
          { screenTitle: '답변 멘트', visual: ['확정 조건식 확인', '고객 안내 문구 확인'], cta: '복사', title: '검토 · 답변', description: '최종 조건식과 안내 문구를 확인한 뒤 답변에 사용합니다.' },
        ],
        noteTitle: '작업 보관',
        note: '<b>답변 멘트에서 임시저장</b>을 누르면 현재 작업이 저장됩니다. 상단 <b>최근 작업</b>에서 다시 불러올 수 있으며, 저장본은 24시간 동안 유지됩니다.',
      }
      : {
        title: '사용 방법 · 자동 추천',
        description: '문의에서 조건 초안을 만들고, 작업자가 검토·수정한 뒤 조건식을 확정합니다.',
        steps: [
          { screenTitle: '고객 문의 입력', visual: ['거래량이 많고 시가총액이 큰 종목을 찾아줘'], cta: '조건 추천 받기', title: '문의 입력', description: '고객 문의를 자연스럽게 입력하거나 미응답 문의에서 원글을 불러옵니다.' },
          { screenTitle: '추천 결과', visual: ['거래량 증가', '시가총액 1,000억 이상'], cta: '추천 조건 적용', title: '추천 조건 검토', description: '추천 이유를 확인하고 필요한 조건만 적용합니다.' },
          { screenTitle: '조건식 편집', visual: ['부족한 조건 직접 추가', '상세 조건값 · 괄호 그룹 설정'], cta: '수정 내용 반영', title: '조건식 편집', description: '부족한 조건을 추가하고 상세값·연결 방식을 수정합니다.' },
          { screenTitle: '답변 멘트 확인', visual: ['조건식 ( A OR B ) AND C', '고객 안내 문구 확인'], cta: '답변 멘트 복사', title: '조건식 확정 · 답변 복사', description: '완성된 조건식과 고객 안내 문구를 확인한 뒤 복사합니다.' },
        ],
        noteTitle: '작업 보관',
        note: '<b>답변 멘트에서 임시저장</b>을 누르면 현재 작업이 저장됩니다. 상단 <b>최근 작업</b>에서 다시 불러올 수 있으며, 저장본은 24시간 동안 유지됩니다.',
      };
  const usageFlow = activeTab === 'manual'
    ? ['조건 카탈로그', '조건 추가', '상세값 설정', 'AND · OR · 괄호', '답변 복사']
    : ['증권사 선택', '문의 입력', '조건 추천 받기', '추천 검토', '조건식 · 답변 복사'];

  const handleConditionEditorEdit = useCallback((kind) => {
    if (kind === 'add' || kind === 'duplicate') {
      if (aiDraftConditions.length === 0) enterConditionEditing();
      return;
    }
  }, [aiDraftConditions.length, enterConditionEditing]);

  const {
    selectedConditions,
    setSelectedConditions,
    strategies,
    activeStrategyId,
    activeStrategyKind,
    activeTemplateType: fixedType,
    setActiveTemplateType: setFixedType,
    addStrategy,
    selectStrategy,
    removeStrategy,
    resetStrategies,
    restoreStrategies,
    checkedLetters,
    isGrouping,
    resetSelection,
    canUndo,
    undoLastEdit,
    handleConditionClick,
    handleCommentChange,
    handleToggleOperator,
    handleMoveCondition,
    handleRemoveCondition,
    handleDuplicateCondition,
    handleLetterCheck,
    handleGroupConditions,
    handleToggleGroupMode,
    handleClearAllGroups,
  } = useConditionEditor({
    onEdit: handleConditionEditorEdit,
    onConditionsEmpty: () => {
      if (aiDraftConditions.length === 0) markEditingEmpty();
    },
    onRequestConfirmation: setConfirmDialog,
  });

// ✨ 1. 괄호로 묶을 항목(A, B, C...)을 저장할 상태
  const { allConditions, isLoading, error } = useBrokerData(selectedBroker);

  useEffect(() => { //증권사 데이터 불러오기
  if (isRestoringSavedStrategy) {
    setIsRestoringSavedStrategy(false);
    return;
  }
  const shouldKeepImportedInquiry = isImportingInboxInquiryRef.current;
  isImportingInboxInquiryRef.current = false;
  resetStrategies();
  setSearch("");
  resetAiWorkflow();
  if (!shouldKeepImportedInquiry) {
    setCustomerQuery('');
    setInboxSourceInquiry(null);
  }
  setImageAttachment(null);
  setAttachmentInputKey(key => key + 1);
}, [selectedBroker]);

  useEffect(() => {
    if (!isSavedStrategiesOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (!savedStrategiesRef.current?.contains(event.target)) {
        setIsSavedStrategiesOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSavedStrategiesOpen]);


  const insertMent = (type) => { //멘트 삽입 함수
    if (!selectedBroker) {
      showToast("먼저 증권사를 선택해주세요.", 'error');
      return;
    }
    setFixedType(type);
  };
  
  const handleReset = () => { //초기화 버튼
  resetStrategies();
  resetAiWorkflow();
  setCustomerQuery('');
  setInboxSourceInquiry(null);
  setInboxAttachmentNotice(false);
  setImageAttachment(null);
  setAttachmentInputKey(key => key + 1);
  resetSelection();
  };

  const handleSaveStrategy = () => {
    if (!customerQuery.trim() && !strategies.some((strategy) => strategy.conditions.length > 0 || strategy.fixedType) && aiDraftConditions.length === 0) {
      showToast('저장할 고객 문의 또는 조건식을 먼저 작성해 주세요.', 'error');
      return;
    }

    const saved = saveStrategy({
      title: customerQuery.trim().slice(0, 44) || `${selectedBroker || '미선택'} 조건식`,
      selectedBroker,
      customerQuery,
      selectedConditions,
      strategies,
      aiDraftConditions,
      activeTab,
    });

    if (saved) {
      setIsSavedStrategiesOpen(true);
      showToast('현재 전략을 임시저장했습니다. 24시간 동안 보관됩니다.', 'success');
    } else {
      showToast('임시저장 공간이 부족합니다. 오래된 저장 항목을 삭제해 주세요.', 'error');
    }
  };

  const handleLoadStrategy = (item) => {
    setIsSavedStrategiesOpen(false);
    setConfirmDialog({
      title: '저장한 전략을 불러오시겠습니까?',
      description: '현재 작업 내용은 불러온 전략으로 변경됩니다.',
      confirmLabel: '불러오기',
      onConfirm: () => restoreSavedStrategy(item),
    });
  };

  const restoreSavedStrategy = (item) => {
    setIsRestoringSavedStrategy(item.selectedBroker !== selectedBroker);
    setSelectedBroker(item.selectedBroker || '');
    setCustomerQuery(item.customerQuery || '');
    restoreStrategies(item.strategies, item.selectedConditions);
    restoreAiWorkflow(item.aiDraftConditions, item.selectedConditions);
    setActiveTab('manual');
    resetSelection();
  };

  const handleDeleteSavedStrategy = (id) => {
    if (!deleteSavedStrategy(id)) {
      showToast('저장 목록을 정리하지 못했습니다.', 'error');
    }
  };

  
  

  useEffect(() => { //멘트 바로 수정
    if (fixedType && selectedConditions.length === 0) {
      //  필요한 모든 재료를 객체 형태로 전달해줍니다.
    }
  }, [selectedConditions, fixedType, selectedBroker]); 


  const filteredConditions = allConditions?.filter(
    c => (
      c?.path?.toLowerCase().includes(search.toLowerCase()) ||
      c?.detail?.toLowerCase().includes(search.toLowerCase()) ||
      c?.type?.toLowerCase().includes(search.toLowerCase())
    )
  ) || [];

const runAiGeneration = async () => {
    // ✨ 중요: 함수 호출 시 3번째 인자로 'selectedBroker'를 전달합니다!
  setInboxSourceInquiry((current) => current || {
    broker: selectedBroker,
    title: '고객 문의',
    author: '직접 입력',
    receivedAt: '',
    query: customerQuery,
    isFollowUp: false,
  });
  resetStrategies();
    startAiWorkflow();
    resetSelection();
    const recommendationCandidates = getRecommendationCandidates(customerQuery, allConditions);
    const aiResult = await generateStrategy(customerQuery, recommendationCandidates, selectedBroker, ENABLE_IMAGE_ATTACHMENT ? imageAttachment : null);

    if (aiResult === null) {
      failAiWorkflow();
      return;
    }

    const matchedConditions = aiResult.conditions;

    // 2. 결과 처리 (여러 개의 매칭 결과를 모두 반영)
    if (matchedConditions && matchedConditions.length > 0) {
      const newConditionItems = groupOrConditions(matchedConditions.map((cond, i) => ({
        ...cond,
        id: Date.now() + i, // ✨ 여러 개를 한 번에 추가해도 id가 겹치지 않도록
        operator: cond.nextOperator === 'or' ? 'or' : 'and',
        comment: cond.detail,
      })));

      setAiRecommendations(newConditionItems, { request: customerQuery, count: newConditionItems.length, coverage: aiResult.coverage });
      showToast(`조건 ${newConditionItems.length}개를 추천했습니다. 오른쪽에서 검토 후 적용해 주세요.`, 'success');

    } else {
      setNoAiResults();
      showToast("적절한 조건을 찾지 못했습니다.\n질문을 더 구체적으로 적어주세요.", 'error');
    }
  };

  const handleAiGenerate = () => {
    if (!selectedBroker) {
      showToast('먼저 증권사를 선택해주세요.', 'error');
      return;
    }
    if (!customerQuery.trim()) {
      showToast('고객 문의 내용을 입력해주세요.', 'error');
      return;
    }
    if (!allConditions || allConditions.length === 0) {
      showToast('선택하신 증권사의 조건 데이터가 없습니다.', 'error');
      return;
    }
    if (strategies.some((strategy) => strategy.conditions.length > 0) || aiDraftConditions.length > 0) {
      setConfirmDialog({
        title: '새 추천을 시작할까요?',
        description: '현재 선택한 조건과 추천 초안은 초기화됩니다.',
        confirmLabel: '새 추천 시작',
        onConfirm: runAiGeneration,
      });
      return;
    }
    runAiGeneration();
  };

  const handleUseInboxInquiry = ({ id, broker, query, title, author, receivedAt, isFollowUp, hasImageAttachment }) => {
    if (!brokerMap[broker]) {
      showToast(`${broker}은 지원하지 않는 증권사입니다.`, 'error');
      return;
    }
    if (inboxSourceInquiry?.id === id && inboxSourceInquiry?.broker === broker && inboxSourceInquiry?.query === query) {
      setIsInboxPickerOpen(false);
      return;
    }
    const applyInquiry = () => {
    resetStrategies();
    setSearch('');
    setImageAttachment(null);
    setAttachmentInputKey((key) => key + 1);
    // 증권사가 바뀌어도 가져온 원글은 유지합니다.
    isImportingInboxInquiryRef.current = broker !== selectedBroker;
    setSelectedBroker(broker);
    setCustomerQuery(query);
    setInboxSourceInquiry({ id, broker, title, author, receivedAt, query, isFollowUp });
    setInboxAttachmentNotice(Boolean(hasImageAttachment));
    resetAiWorkflow();
    setIsInboxPickerOpen(false);
    showToast(`${title} 내용을 자동 추천에 불러왔습니다.`, 'success');
    };
    const hasWork = strategies.some((strategy) => strategy.conditions?.length > 0 || strategy.kind === 'template') || aiDraftConditions.length > 0 || Boolean(customerQuery.trim());
    if (hasWork) {
      setConfirmDialog({
        title: '다른 문의로 전환할까요?',
        description: '현재 입력한 문의와 모든 전략·추천 초안이 초기화됩니다. 보관이 필요하면 취소 후 임시저장해 주세요.',
        confirmLabel: '초기화 후 문의 가져오기',
        onConfirm: applyInquiry,
      });
    } else applyInquiry();
  };

  
  const handleImageAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      showToast('JPG, PNG, WEBP 형식의 이미지만 첨부할 수 있습니다.', 'error');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      showToast('이미지는 2MB 이하로 첨부해 주세요.', 'error');
      event.target.value = '';
      return;
    }

    try {
      const data = await readImageAsBase64(file);
      if (!data) throw new Error('이미지 데이터가 비어 있습니다.');
      setImageAttachment({ name: file.name, mimeType: file.type, data });
    } catch (error) {
      showToast(error.message || '이미지를 첨부하지 못했습니다.', 'error');
    }
  };

  const handleRemoveImageAttachment = () => {
    setImageAttachment(null);
    setAttachmentInputKey(key => key + 1);
  };

  //새로운 멘트
  const handleApplyAiDraft = (index) => {
    const draft = aiDraftConditions[index];
    if (!draft) return;
    const isLastDraft = aiDraftConditions.length === 1;
    setSelectedConditions(prev => [...prev, { ...draft, groupIds: [] }]);
    applyDraft(index);
    if (isLastDraft) {
      setActiveTab('manual');
    }
  };

  const handleApplyAllAiDrafts = () => {
    if (aiDraftConditions.length === 0) return;
    setSelectedConditions(prev => [...prev, ...aiDraftConditions]);
    applyAllDrafts();
    setActiveTab('manual');
  };

  const handleDiscardAiDraft = (index) => {
    const isLastDraft = aiDraftConditions.length === 1;
    discardDraft(index, selectedConditions.length > 0);
    if (isLastDraft) {
      setActiveTab('manual');
    }
  };

  const handleCustomerQueryChange = (query) => {
    setCustomerQuery(query);
    setInboxSourceInquiry((current) => {
      // 게시판에서 가져온 원글의 출처 정보는 사용자가 내용을 보완해도 유지합니다.
      if (current && current.author !== '직접 입력') return current;
      if (!query.trim()) return null;
      return {
        broker: selectedBroker,
        title: '고객 문의',
        author: '직접 입력',
        receivedAt: '',
        query,
        isFollowUp: false,
      };
    });
  };

  const handleAiExample = (query) => {
    handleCustomerQueryChange(query);
  };



  const mentButtons = selectedBroker?.includes('신한')
  ? ['조건선물', '기능불가', '작성불가', '전략외문의', '오류답변']
  : ['조건선물', '작성불가', '고객센터']; // 기존에 쓰시던 기본 버튼 목록


  return (
<div className="container">
      <div className="card">
        <header className="app-intro">
          <div>
            <p className="app-eyebrow">AI 전략 Q&amp;A · 업무용</p>
            <h1>고객 문의 조건식 작성</h1>
            <p className="app-description">문의 내용을 입력하면 조건 후보를 제안합니다. 검토 후 적용해 주세요.</p>
          </div>
          <div className="app-header-actions">
            <button
              type="button"
              className="usage-help-button"
              onClick={() => { setIsHelpOpen(open => !open); setIsSavedStrategiesOpen(false); }}
              aria-expanded={isHelpOpen}
              aria-controls="usage-help-popover"
            >
              사용 방법
            </button>
            <div className="saved-strategies-anchor" ref={savedStrategiesRef}>
              <button
                type="button"
                className="usage-help-button"
                onClick={() => { setIsSavedStrategiesOpen(open => !open); setIsHelpOpen(false); }}
                aria-expanded={isSavedStrategiesOpen}
                aria-controls="saved-strategies-popover"
              >
                최근 작업
              </button>
              {isSavedStrategiesOpen && (
                <section id="saved-strategies-popover" className="saved-strategies-popover" aria-label="최근 임시저장">
                  <div className="saved-strategies-popover-title">
                    <strong>최근 작업</strong>
                    <button type="button" onClick={() => setIsSavedStrategiesOpen(false)} aria-label="최근 작업 닫기">×</button>
                  </div>
                  <SavedStrategies items={savedStrategies} onLoad={handleLoadStrategy} onDelete={handleDeleteSavedStrategy} />
                </section>
              )}
            </div>
            <div className={`app-status ${selectedBroker ? 'ready' : 'pending'}`}>{selectedBroker ? `${selectedBroker} 조건 데이터 준비됨` : '증권사를 선택해 주세요'}</div>
            {isHelpOpen && (
              <div className="usage-help-modal-backdrop" onMouseDown={() => setIsHelpOpen(false)}>
                <section id="usage-help-popover" className="usage-help-modal" role="dialog" aria-modal="true" aria-label="사용 방법" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="usage-help-title">
                    <div><strong>{usageGuide.title}</strong><p>{usageGuide.description}</p></div>
                    <button type="button" onClick={() => setIsHelpOpen(false)} aria-label="사용 방법 닫기">×</button>
                  </div>
                  <div className="usage-help-flow" aria-label="작업 순서">
                    {usageFlow.map((label, index) => (
                      <React.Fragment key={label}>
                        <span className={index === 0 ? 'current' : ''}><b>{index + 1}</b>{label}</span>
                        {index < usageFlow.length - 1 && <i>→</i>}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="usage-help-steps">
                    {usageGuide.steps.map((step, index) => (
                      <article className="usage-help-step" key={step.title}>
                        <div className="help-screen help-result-screen">
                          <span className="help-mini-title">{step.screenTitle}</span>
                          {step.visual.map((line) => <i key={line}>{line}</i>)}
                          <b>{step.cta}</b>
                        </div>
                        <span className="help-step-number">{String(index + 1).padStart(2, '0')}</span>
                        <h4>{step.title}</h4>
                        <p>{step.description}</p>
                      </article>
                    ))}
                  </div>
                  <section className="usage-help-save-note">
                    <strong>{usageGuide.noteTitle}</strong>
                    <p dangerouslySetInnerHTML={{ __html: usageGuide.note }} />
                  </section>
                </section>
              </div>
            )}
          </div>
        </header>
        <div className="main-content">
          <div className={`top-panel ${activeTab === 'ai' ? 'ai-workflow-layout' : 'manual-editor-layout'}`}>
            <div id="left-panel" className={`panel ${activeTab === 'ai' ? 'ai-request-panel' : ''}`}>
              <div className="tabs-container">
                <button className={`tab-button ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>조건식 편집</button>
                <button className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>AI 추천</button>
              </div>
              
              <div className="broker-actions-container">
               <BrokerSelector brokers={brokers} selectedBroker={selectedBroker} onChange={setSelectedBroker} />
               {/*} <div className="fixed-ment-buttons">
                  <button className="notice-button" onClick={() => insertMent('조건선물')}>조건선물</button>
                  <button className="notice-button" onClick={() => insertMent('작성불가')}>작성불가</button>
                  <button className="notice-button" onClick={() => insertMent('고객센터')}>고객센터</button>
                  {/* 필요에 따라 버튼 추가 
                </div> */}
               {activeTab === 'manual' && (
                 <div className="ment-template-control">
                   <select
                     value={fixedType}
                    onChange={(event) => insertMent(event.target.value)}
                     className="workspace-select"
                     aria-label="답변 템플릿 선택"
                   >
                     <option value="">답변 템플릿 선택</option>
                     {mentButtons.map((ment) => <option key={ment} value={ment}>{ment}</option>)}
                   </select>
                 </div>
               )}
                </div>

              {activeTab === 'manual' && (
                <div className="strategy-switcher" aria-label="조건식 전략 선택">
                  <div className="strategy-switcher-list">
                    {strategies.map((strategy, index) => (
                      <button
                        key={strategy.id}
                        type="button"
                        className={`strategy-switcher-button ${strategy.id === activeStrategyId ? 'active' : ''}`}
                        onClick={() => selectStrategy(strategy.id)}
                      >
                        전략 {index + 1}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="strategy-add-button" onClick={() => addStrategy('condition')}>+ 전략 추가</button>
                  {strategies.length > 1 && (
                    <button type="button" className="strategy-remove-button" onClick={() => removeStrategy(activeStrategyId)}>현재 전략 삭제</button>
                  )}
                </div>
              )}
              
              <div className="panel-content">
                {activeTab === 'manual' && (
                  <div className="manual-condition-workspace">
                    <div className="manual-condition-toolbar">
                      <div className="ai-workflow-heading">
                        <span className="ai-workflow-icon">☷</span>
                        <div><h3>조건 선택</h3></div>
                      </div>
                      <div className="list-header">
                        <ConditionSearch search={search} onSearch={setSearch} />
                      </div>
                    </div>
                    <ConditionList conditions={filteredConditions} onConditionClick={handleConditionClick} isSearching={Boolean(search.trim())} />
                  </div>
                )}
                {activeTab === 'ai' && isInboxPickerOpen && (
                  <div className="board-inquiry-browser" aria-label="미응답 문의 선택">
                    <div className="board-inquiry-browser-head">
                      <div><span>BOARD INBOX</span><h3>증권사별 업무 큐</h3><p>처리할 문의를 고르면 원글을 자동 추천 입력창으로 가져옵니다.</p></div>
                      <button type="button" onClick={() => setIsInboxPickerOpen(false)}>입력으로 돌아가기</button>
                    </div>
                    <div className="board-queue-summary" aria-label="문의 현황">
                      <span><b>{inboxInquiries.length}</b> 전체 문의</span>
                      <span><b>{inboxBrokers.length}</b> 증권사</span>
                      <span>원문을 선택하면 자동 추천 입력창으로 가져옵니다.</span>
                    </div>
                    <div className="board-queue-layout">
                      <aside className="board-queue-brokers" aria-label="증권사 필터">
                        <button type="button" className={inboxBrokerFilter === '전체' ? 'active' : ''} onClick={() => { setInboxBrokerFilter('전체'); setInboxPage(1); }}><span>전체 문의</span><b>{inboxInquiries.length}</b></button>
                        {inboxBrokers.map((broker) => {
                          const count = inboxInquiries.filter((inquiry) => inquiry.broker === broker).length;
                          return <button type="button" key={broker} className={inboxBrokerFilter === broker ? 'active' : ''} onClick={() => { setInboxBrokerFilter(broker); setInboxPage(1); }}><span>{broker}</span><b>{count}</b></button>;
                        })}
                      </aside>
                      <section className="board-queue-list">
                        <div className="board-queue-list-head">
                          <strong>{inboxBrokerFilter === '전체' ? '전체 미응답 문의' : `${inboxBrokerFilter} 문의`} <small className="board-queue-count">{visibleInboxInquiries.length}건</small></strong>
                          <div className="board-queue-list-actions">
                            <button type="button" disabled={inboxLoading} onClick={refreshInbox}>{inboxLoading ? (inboxLastUpdatedAt ? '갱신 중…' : '불러오는 중…') : '새로고침'}</button>
                            <button type="button" onClick={() => { setInboxSortOrder((order) => order === 'oldest' ? 'latest' : 'oldest'); setInboxPage(1); }}>
                              {inboxSortOrder === 'oldest' ? '오래된순 ↑' : '최신순 ↓'}
                            </button>
                          </div>
                        </div>
                        <div className="board-inquiry-browser-list">
                          {pagedInboxInquiries.map((inquiry) => (
                            <button type="button" key={inquiry.id} onClick={() => handleUseInboxInquiry(inquiry)}>
                              <span><em>{inquiry.broker}</em><small>게시글 #{inquiry.id} · {inquiry.author} · {inquiry.receivedAt}</small></span>
                              <strong>{inquiry.isFollowUp && <mark>재문의</mark>}{inquiry.hasImageAttachment && <mark className="attachment">첨부파일</mark>}{inquiry.title}</strong>
                              <p>{inquiry.query}</p>
                            </button>
                          ))}
                          {inboxLoading && !inboxLastUpdatedAt && <div className="board-queue-empty" role="status">미답변 문의를 불러오는 중입니다…</div>}
                          {inboxError && <div className="board-queue-empty" role="alert">{inboxError}</div>}
                          {!inboxLoading && !inboxError && visibleInboxInquiries.length === 0 && <div className="board-queue-empty">조건에 맞는 문의가 없습니다.</div>}
                        </div>
                        {inboxPageCount > 1 && (
                          <nav className="board-queue-pagination" aria-label="문의 페이지">
                            <button type="button" disabled={currentInboxPage === 1} onClick={() => setInboxPage((page) => Math.max(1, page - 1))}>이전</button>
                            {inboxPageNumbers.map((page, index) => <React.Fragment key={page}>{index > 0 && inboxPageNumbers[index - 1] !== page - 1 && <i>…</i>}<button type="button" className={page === currentInboxPage ? 'active' : ''} onClick={() => setInboxPage(page)}>{page}</button></React.Fragment>)}
                            <button type="button" disabled={currentInboxPage === inboxPageCount} onClick={() => setInboxPage((page) => Math.min(inboxPageCount, page + 1))}>다음</button>
                          </nav>
                        )}
                      </section>
                    </div>
                  </div>
                )}
                {activeTab === 'ai' && !isInboxPickerOpen && (
                  <div className="ai-workflow">
                    <div className="ai-workflow-heading recommendation-input-heading">
                      <span className="recommendation-step-number">01</span>
                      <div>
                        <span className="recommendation-kicker">CUSTOMER INQUIRY</span>
                        <h3>고객 문의</h3>
                        <p>고객이 원하는 종목 조건을 자연스럽게 작성해 주세요.</p>
                      </div>
                      <span className="recommendation-catalog-status">{selectedBroker ? `${selectedBroker} · ${allConditions.length.toLocaleString()}개 조건` : '증권사 선택 필요'}</span>
                    </div>
                    <div className="board-inquiry-import">
                      <button type="button" onClick={() => setIsInboxPickerOpen(true)}>미응답 문의 선택 </button>
                    </div>
                    <button type="button" className="ai-clear-query-button" onClick={() => { setCustomerQuery(''); setInboxAttachmentNotice(false); setInboxSourceInquiry(null); }} disabled={!customerQuery}>문의 지우기</button>
                    {inboxAttachmentNotice && <div className="inbox-attachment-notice"><b>첨부파일가 있는 문의입니다.</b> 첨부파일 내용은 자동 추천에 포함되지 않으므로, 답변 전 게시판 원글의 첨부파일을 확인해 주세요.</div>}
                    {ENABLE_IMAGE_ATTACHMENT && (
                      <>
                        <div className="ai-attachment-row">
                          <label className="ai-attachment-button">
                            <input
                              key={attachmentInputKey}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleImageAttachment}
                            />
                            이미지 첨부
                          </label>
                          <span>문의 캡처는 참고용으로만 분석됩니다. JPG·PNG·WEBP, 최대 2MB</span>
                        </div>
                        {imageAttachment && (
                          <div className="ai-attachment-file">
                            <span>{imageAttachment.name}</span>
                            <button type="button" onClick={handleRemoveImageAttachment}>제거</button>
                          </div>
                        )}
                      </>
                    )}
                    {lastAiResult && (
                      <div className="ai-inline-result">최근 추천: {lastAiResult.count}개 조건 초안을 만들었습니다. 검토 후 적용해 주세요.</div>
                    )}
                    <textarea
                      className="ment-box ai-query-input"
                      rows={7}
                      value={customerQuery}
                      onChange={(e) => handleCustomerQueryChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.ctrlKey && e.key === 'Enter') handleAiGenerate();
                      }}
                      placeholder="예: 거래량이 많고 시가총액이 1,000억 이상인 종목을 찾아줘"
                    />
                    <div className="ai-example-area">
                      <span>빠른 입력</span>
                      <div className="ai-example-chips">
                        <button type="button" onClick={() => handleAiExample('거래량이 최근 평균보다 크게 증가한 종목을 찾아줘')}>거래량 급증</button>
                        <button type="button" onClick={() => handleAiExample('저평가된 대형주를 찾아줘')}>저평가 대형주</button>
                        <button type="button" onClick={() => handleAiExample('최근 상승 추세가 이어지는 종목을 찾아줘')}>상승 추세</button>
                      </div>
                    </div>
                    <button className="generate-button ai-primary-button" onClick={handleAiGenerate} disabled={isAiLoading || isLoading}>
                      {isAiLoading || isLoading ? '조건을 분석하고 있습니다...' : '조건 추천 받기'}
                    </button>
                    <p className="ai-keyboard-hint">Ctrl + Enter로 바로 분석할 수 있습니다.</p>
                  </div>
                )}
              </div>
            </div>
            
            <div id="right-panel" className="panel">
              <div className={`panel-header ${activeTab === 'ai' ? 'ai-results-header' : 'manual-results-header'}`}>
                {activeTab === 'ai' && (
                  <div className="ai-results-title">
                    <span className="recommendation-step-number">02</span>
                    <div><span className="recommendation-kicker">STRATEGY DRAFT</span><h3>전략 초안</h3><p>추천 조건을 적용하면 조건식 편집 화면으로 이동합니다.</p></div>
                  </div>
                )}
                {activeTab === 'manual' && (
                  <div className="ai-results-title">
                    <span className="ai-workflow-icon">✓</span>
                    <div><h3>선택된 조건</h3><p>조건의 순서와 상세 설정값을 검토해 주세요.</p></div>
                  </div>
                )}
                <div className="workspace-header-actions">
                  {activeTab === 'manual' && <button type="button" className="undo-button" onClick={undoLastEdit} disabled={!canUndo}>되돌리기</button>}
                  <button className="reset-button" onClick={handleReset}>전체 초기화</button>
                </div>
              </div>
              <div className={`panel-content ${activeTab === 'manual' ? 'manual-panel-content' : ''}`}>
                {activeTab === 'ai' && aiWorkflowPhase === 'loading' && (
                  <WorkspaceEmptyState className="ai-empty-state ai-loading-state" icon="⋯" title="조건을 분석하고 있습니다." description="증권사 조건 목록과 고객 문의를 비교하고 있습니다." />
                )}
                {activeTab === 'ai' && aiWorkflowPhase === 'no_result' && (
                  <WorkspaceEmptyState className="ai-empty-state ai-no-result-state" icon="?" title="추천할 조건을 찾지 못했습니다." description="문의 내용을 조금 더 구체적으로 작성하거나 조건 목록을 확인해 주세요." />
                )}
                {activeTab === 'ai' && aiWorkflowPhase === 'error' && (
                  <WorkspaceEmptyState className="ai-empty-state ai-error-state" icon="!" title="조건 추천을 완료하지 못했습니다." description="안내 팝업의 내용을 확인한 뒤 잠시 후 다시 시도해 주세요." />
                )}
                {activeTab === 'ai' && aiWorkflowPhase === 'editing' && (
                  <div className="ai-return-state">
                    <span>✓</span>
                    <strong>조건식 편집이 진행 중입니다.</strong>
                    <p>현재 {selectedConditions.length}개 조건이 적용되어 있습니다.<br />새 추천을 시작하면 기존 조건은 초기화됩니다.</p>
                  </div>
                )}
                {activeTab === 'ai' && ['review', 'partial_review'].includes(aiWorkflowPhase) && (
                  <AiDraftList
                    drafts={aiDraftConditions}
                    coverage={lastAiResult?.coverage}
                    brokerName={selectedBroker}
                    isPartial={aiWorkflowPhase === 'partial_review'}
                    onApplyAll={handleApplyAllAiDrafts}
                    onApply={handleApplyAiDraft}
                    onDiscard={handleDiscardAiDraft}
                  />
                )}
                {activeTab === 'manual' && (
                  activeStrategyKind === 'template' ? (
                    <WorkspaceEmptyState className="manual-empty-state" icon="✉" title={fixedType ? '답변 템플릿이 선택되었습니다.' : '답변 템플릿을 선택해 주세요.'} description={fixedType ? '답변 멘트의 현재 순서에 이 템플릿이 삽입됩니다.' : '왼쪽 상단의 답변 템플릿 선택에서 내용을 골라 주세요.'} />
                  ) : selectedConditions.length > 0 || inboxSourceInquiry ? (
                    <SelectedConditions
                      selectedConditions={selectedConditions}
                      sourceInquiry={inboxSourceInquiry}
                      onRemove={handleRemoveCondition}
                      onCommentChange={handleCommentChange}
                      onMove={handleMoveCondition}
                      onDuplicate={handleDuplicateCondition}
                      onToggleOperator={handleToggleOperator}
                      isGrouping={isGrouping}
                      checkedLetters={checkedLetters}
                      onToggleGroupMode={handleToggleGroupMode}
                      onLetterCheck={handleLetterCheck}
                      onGroup={handleGroupConditions}
                      onClearAllGroups={handleClearAllGroups}
                    />
                  ) : (
                    <WorkspaceEmptyState className="manual-empty-state" icon="＋" title="적용된 조건이 없습니다." description="왼쪽 조건 목록에서 필요한 조건을 추가해 주세요." />
                  )
                )}
              </div>
            </div>
          </div>

          {activeTab === 'manual' && <div className="bottom-panel">
            <GeneratedMent 
              selectedConditions={selectedConditions} 
              strategies={strategies}
              activeStrategyId={activeStrategyId}
              onToggleOperator={handleToggleOperator} 
              fixedMentMap={fixedMentMap}
              selectedBroker={selectedBroker}
              isGrouping={isGrouping}
              // setIsGrouping={setIsGrouping}
              checkedLetters={checkedLetters}
              onToggleGroupMode={handleToggleGroupMode}
              onLetterCheck={handleLetterCheck}
              onGroup={handleGroupConditions}
              onClearAllGroups={handleClearAllGroups}
              onSaveDraft={handleSaveStrategy}
              showLogicControls={false}
              // onMentUpdate={handleMentUpdate}
            />
          </div>}
        </div>
      </div>
      <AppToast />
      {confirmDialog && (
        <div className="app-confirm-backdrop" onMouseDown={() => setConfirmDialog(null)}>
          <section className="app-confirm-dialog" role="dialog" aria-modal="true" aria-label={confirmDialog.title} onMouseDown={(event) => event.stopPropagation()}>
            <h3>{confirmDialog.title}</h3>
            <p>{confirmDialog.description}</p>
            <div>
              <button type="button" onClick={() => setConfirmDialog(null)}>취소</button>
              <button type="button" onClick={() => { const action = confirmDialog.onConfirm; setConfirmDialog(null); action(); }}>{confirmDialog.confirmLabel}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
