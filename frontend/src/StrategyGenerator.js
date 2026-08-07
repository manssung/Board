import React, { useState, useEffect, useRef } from 'react';
import './css/StrategyGenerator.css';
import BrokerSelector from '../src/components/BrokerSelector';
import ConditionSearch from '../src/components/Condition Search';
import ConditionList from '../src/components/Condition List';
import SelectedConditions from '../src/components/Selected Conditions';
import GeneratedMent from '../src/components/Generated Ment';
import fixedMentMap from './data/fixedMentMap.js';
import brokerMap from './data/brokerMap.js';
import { useBrokerData } from './hooks/useBrokerData';
import { generateMent } from './util/generateMent.js';
import { useAiStrategyGenerator } from './hooks/useAiStrategyGenerator';
import { useAiWorkflow } from './hooks/useAiWorkflow';
import {
  addCondition,
  getConditionIndex,
  getConditionLabel,
  groupOrConditions,
  toggleConditionOperator,
  updateConditionComment,
} from './util/conditionEditor';
import { useSavedStrategies } from './hooks/useSavedStrategies';
import SavedStrategies from './components/SavedStrategies';
import AppToast, { showToast } from './components/AppToast';
import AiDraftList from './components/AiDraftList';
import WorkspaceEmptyState from './components/WorkspaceEmptyState';

/* Legacy copy kept only for migration reference.
const groupOrConditions = (conditions) => {
  const groupedConditions = conditions.map(condition => ({ ...condition, groupIds: [] }));

  // 조건이 둘뿐인 "A or B"는 괄호 없이 표현합니다.
  if (groupedConditions.length < 3) {
    return groupedConditions;
  }

  let index = 0;

  while (index < groupedConditions.length - 1) {
    if (groupedConditions[index].operator !== 'or') {
      index += 1;
      continue;
    }

    const groupStart = index;
    while (index < groupedConditions.length - 1 && groupedConditions[index].operator === 'or') {
      index += 1;
    }

    const groupId = `ai-or-${Date.now()}-${groupStart}`;
    for (let memberIndex = groupStart; memberIndex <= index; memberIndex += 1) {
      groupedConditions[memberIndex].groupIds = [groupId];
    }
  }

  return groupedConditions;
};

*/
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// 이미지 첨부 기능은 검토 후 다시 공개할 수 있도록 코드만 보관합니다.
const ENABLE_IMAGE_ATTACHMENT = false;

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
  const [selectedConditions, setSelectedConditions] = useState([]);
  //const [allConditions, setAllConditions] = useState([]);
  const [customMent, setCustomMent] = useState("");
  const [warning, setWarning] = useState("");
  const [autoMent, setAutoMent] = useState("");
  const [fixedType, setFixedType] = useState("");
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
  const [imageAttachment, setImageAttachment] = useState(null);
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const [isRestoringSavedStrategy, setIsRestoringSavedStrategy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const { savedStrategies, saveStrategy, deleteSavedStrategy } = useSavedStrategies();

  const [isMentManuallyEdited, setIsMentManuallyEdited] = useState(false);

// ✨ 1. 괄호로 묶을 항목(A, B, C...)을 저장할 상태
  const [checkedLetters, setCheckedLetters] = useState(new Set());
  const [isGrouping, setIsGrouping] = useState(false);
  const { allConditions, isLoading, error } = useBrokerData(selectedBroker);

  useEffect(() => { //증권사 데이터 불러오기
  if (isRestoringSavedStrategy) {
    setIsRestoringSavedStrategy(false);
    return;
  }
  setSelectedConditions([]);
  setAutoMent("");
  setCustomMent("");
  setFixedType("");
  setSearch("");
  setCheckedLetters(new Set());
  resetAiWorkflow();
  setCustomerQuery('');
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
    setSelectedConditions([]);
    resetAiWorkflow();
    setCustomMent("");
    setAutoMent("");
  };
  
  const handleReset = () => { //초기화 버튼
  setSelectedConditions([]);
  resetAiWorkflow();
  setCustomerQuery('');
  setImageAttachment(null);
  setAttachmentInputKey(key => key + 1);
  setCustomMent('');
  setAutoMent('');
  setFixedType('');
  setCheckedLetters(new Set());
  setIsMentManuallyEdited(false);
  };

  const handleSaveStrategy = () => {
    if (!customerQuery.trim() && selectedConditions.length === 0 && aiDraftConditions.length === 0 && !fixedType) {
      showToast('저장할 고객 문의 또는 조건식을 먼저 작성해 주세요.', 'error');
      return;
    }

    const saved = saveStrategy({
      title: customerQuery.trim().slice(0, 44) || `${selectedBroker || '미선택'} 조건식`,
      selectedBroker,
      customerQuery,
      selectedConditions,
      aiDraftConditions,
      customMent,
      autoMent,
      fixedType,
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
    setSelectedConditions(Array.isArray(item.selectedConditions) ? item.selectedConditions : []);
    restoreAiWorkflow(item.aiDraftConditions, item.selectedConditions);
    setCustomMent(item.customMent || '');
    setAutoMent(item.autoMent || '');
    setFixedType(item.fixedType || '');
    setActiveTab('manual');
    setCheckedLetters(new Set());
    setIsGrouping(false);
  };

  const handleDeleteSavedStrategy = (id) => {
    if (!deleteSavedStrategy(id)) {
      showToast('저장 목록을 정리하지 못했습니다.', 'error');
    }
  };

 
  useEffect(() => { //멘트 바로 수정
  if (fixedType && selectedConditions.length === 0) {
    const ment = generateMent(fixedType);
    setAutoMent(ment);
    setCustomMent(ment);
  }
  }, [selectedConditions, fixedType]);

  const handleCommentChange = (index, newComment) => {
  setSelectedConditions(prev => updateConditionComment(prev, index, newComment));
      setIsMentManuallyEdited(false);
      setCustomMent("");
      setFixedType("");
    };

  const handleConditionClick = (condition) => {
    setSelectedConditions(prev => addCondition(prev, condition));
    enterConditionEditing();
    
    // 고정 멘트 관련 상태 초기화
    setWarning("");
    setFixedType("");
    setAutoMent("");
    setCustomMent("");
    setIsMentManuallyEdited(false);
  };

  /////괄호 기능//////////
  const handleLetterCheck = (letter) => {
    setCheckedLetters(prev => {
      const newChecked = new Set(prev);
      if (newChecked.has(letter)) {
        newChecked.delete(letter);
      } else {
        newChecked.add(letter);
      }
      return newChecked;
    });
  };



  const handleGroupConditions = () => {
    if (checkedLetters.size < 2) {
      showToast('괄호로 묶을 항목을 2개 이상 선택해주세요.', 'error');
      setCheckedLetters(new Set())
      return;
    }

    const sortedIndices = Array.from(checkedLetters)
      .map(letter => getConditionIndex(letter))
      .sort((a, b) => a - b);

    // 인덱스가 1씩 증가하는지(연속된 숫자인지) 확인합니다.
    for (let i = 0; i < sortedIndices.length - 1; i++) {
      if (sortedIndices[i + 1] - sortedIndices[i] !== 1) {
        showToast('연속된 조건끼리만 그룹으로 묶을 수 있습니다.', 'error');
        setCheckedLetters(new Set());
        return;
      }
    }

    const firstIndex = sortedIndices[0];
    const lastIndex = sortedIndices[sortedIndices.length - 1];

    const sharedSelectedGroupIds = sortedIndices
      .map(index => selectedConditions[index].groupIds || [])
      .reduce((sharedIds, groupIds) => sharedIds.filter(id => groupIds.includes(id)));

    if (sharedSelectedGroupIds.length > 0) {
      showToast('이미 같은 괄호 그룹으로 묶인 조건입니다.', 'error');
      setCheckedLetters(new Set());
      return;
    }
    
    // 3-1. 왼쪽 경계 확인: 선택된 첫 항목이 바로 앞 항목과 그룹을 공유하는지?
    if (firstIndex > 0) {
      const currentItem = selectedConditions[firstIndex];
      const prevItem = selectedConditions[firstIndex - 1];
      
      // 두 항목이 공통으로 가진 그룹 ID가 하나라도 있다면?
      const sharedGroups = currentItem.groupIds.filter(id => prevItem.groupIds.includes(id));
      if (sharedGroups.length > 0) {
        showToast('기존 괄호를 가로질러 그룹을 만들 수 없습니다. 앞쪽 괄호 범위를 확인해 주세요.', 'error');
        setCheckedLetters(new Set());
        return;
      }
    }

    // 3-2. 오른쪽 경계 확인: 선택된 마지막 항목이 바로 뒤 항목과 그룹을 공유하는지?
    if (lastIndex < selectedConditions.length - 1) {
      const currentItem = selectedConditions[lastIndex];
      const nextItem = selectedConditions[lastIndex + 1];
      
      // 두 항목이 공통으로 가진 그룹 ID가 하나라도 있다면?
      const sharedGroups = currentItem.groupIds.filter(id => nextItem.groupIds.includes(id));
      if (sharedGroups.length > 0) {
        showToast('기존 괄호를 가로질러 그룹을 만들 수 없습니다. 뒤쪽 괄호 범위를 확인해 주세요.', 'error');
        setCheckedLetters(new Set());
        return;
      }
    }

const newGroupId = Date.now();
    setSelectedConditions(prev => 
      prev.map((item, index) => {
        const letter = getConditionLabel(index);
        const currentGroupIds = item.groupIds || [];
        return checkedLetters.has(letter) 
          ? { ...item, groupIds: [...currentGroupIds, newGroupId] } 
          : item;
      })
    );
    setCheckedLetters(new Set());
  };


  const handleUngroupConditions = () => {
    if(checkedLetters.size === 0) return

    let targetGroupId = null;
    // const indicesArray = Array.from(checkedIndices);
    // const firstCheckedItem = selectedConditions[indicesArray[0]];
    const sampleIndex = getConditionIndex(Array.from(checkedLetters)[0]);
    const sampleItem = selectedConditions[sampleIndex];
    
    if (sampleItem && sampleItem.groupIds && sampleItem.groupIds.length > 0) {
      targetGroupId = sampleItem.groupIds[sampleItem.groupIds.length - 1];
    }

    if (!targetGroupId) {
      showToast("해제할 그룹이 없습니다.", 'error');
      return;
    }
    
    setSelectedConditions(prev =>
      prev.map((item, index) => {
      const letter = getConditionLabel(index);
          // ✨ 해당 ID만 필터링하여 제거
       return checkedLetters.has(letter) 
          ? { ...item, groupIds: [] } 
          : item;
      })
    );
    setCheckedLetters(new Set());
    setIsGrouping(false);
  };

  const handleToggleGroupMode = () => {
    if (isGrouping) {
      setCheckedLetters(new Set());
    }
    setIsGrouping(!isGrouping); // 모드 토글
  };

  //괄호 초기화//
  const handleClearAllGroups = () => {
    const hasGroups = selectedConditions.some(item => item.groupIds && item.groupIds.length > 0);

    // 2. 괄호가 없으면 알림 표시 후 종료
    if (!hasGroups) {
      showToast("삭제할 괄호가 없습니다.", 'error');
      return;
    }
    setConfirmDialog({
      title: '모든 그룹을 해제하시겠습니까?',
      description: '설정된 괄호가 모두 삭제됩니다.',
      confirmLabel: '모든 그룹 해제',
      onConfirm: () => {
        setSelectedConditions(prev => prev.map(item => ({ ...item, groupIds: [] })));
        setCheckedLetters(new Set());
      },
    });
  };

  //and / or
 const handleToggleOperator = (index) => {
    // index에 해당하는 조건의 operator를 'and' -> 'or', 'or' -> 'and'로 변경
    setSelectedConditions(prev => toggleConditionOperator(prev, index));
    setIsMentManuallyEdited(false); // 멘트가 자동으로 다시 생성되도록 설정
  };


  const handleMoveCondition = (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedConditions.length) return;
 
    setSelectedConditions(prev => {
      const updated = [...prev];
      [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
      // ✨ 순서가 바뀌면 기존 괄호(그룹) 구조가 인덱스 기준이라 깨지므로 전체 초기화합니다.
      return updated.map(item => ({ ...item, operator: 'and', groupIds: [] }));
    });
    setCheckedLetters(new Set());
    setIsGrouping(false);
    setIsMentManuallyEdited(false);
    setCustomMent("");
    setFixedType("");
  };
 
  const handleRemoveCondition = (index) => {
    const isLastCondition = selectedConditions.length === 1;
    setSelectedConditions(prev => 
      prev
        .filter((_, i) => i !== index) // 선택한 항목 삭제
        .map(item => ({ ...item, operator: 'and', groupIds: [] })) // ✨ 모든 괄호와 연결 연산자 초기화
    );
    setIsMentManuallyEdited(false);
    setCustomMent("");
    setFixedType("");
    setCheckedLetters(new Set()); // 선택 상태도 초기화
    setIsGrouping(false);
    if (isLastCondition) markEditingEmpty();
  };
  

  useEffect(() => { //멘트 바로 수정
    if (fixedType && selectedConditions.length === 0) {
      //  필요한 모든 재료를 객체 형태로 전달해줍니다.
      const ment = generateMent({ typeOverride: fixedType, fixedMentMap, selectedBroker });
      setAutoMent(ment);
      setCustomMent(ment);
    }
  }, [selectedConditions, fixedType, selectedBroker]); 


  const filteredConditions = allConditions?.filter(
    c => (
      c?.path?.toLowerCase().includes(search.toLowerCase()) ||
      c?.detail?.toLowerCase().includes(search.toLowerCase()) ||
      c?.type?.toLowerCase().includes(search.toLowerCase())
    )
  ) || [];

   const effectiveMent = customMent || autoMent || generateMent({
     selectedConditions,
     fixedMentMap,
     selectedBroker,
     fixedType
     });

const runAiGeneration = async () => {
    // ✨ 중요: 함수 호출 시 3번째 인자로 'selectedBroker'를 전달합니다!
    setSelectedConditions([]);
    startAiWorkflow();
    setCustomMent('');
    setAutoMent('');
    setFixedType('');
    setCheckedLetters(new Set());
    const matchedConditions = await generateStrategy(customerQuery, allConditions, selectedBroker, ENABLE_IMAGE_ATTACHMENT ? imageAttachment : null);

    if (matchedConditions === null) {
      failAiWorkflow();
      return;
    }

    // 2. 결과 처리 (여러 개의 매칭 결과를 모두 반영)
    if (matchedConditions && matchedConditions.length > 0) {
      const newConditionItems = groupOrConditions(matchedConditions.map((cond, i) => ({
        ...cond,
        id: Date.now() + i, // ✨ 여러 개를 한 번에 추가해도 id가 겹치지 않도록
        operator: cond.nextOperator === 'or' ? 'or' : 'and',
        comment: cond.detail,
      })));

      setFixedType("");
      setAiRecommendations(newConditionItems, { request: customerQuery, count: newConditionItems.length });
      showToast(`AI가 조건 ${newConditionItems.length}개를 추천했습니다. 오른쪽에서 검토 후 적용해 주세요.`, 'success');

    } else {
      setNoAiResults();
      showToast("AI가 적절한 조건을 찾지 못했습니다.\n질문을 더 구체적으로 적어주세요.", 'error');
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
    if (selectedConditions.length > 0 || aiDraftConditions.length > 0) {
      setConfirmDialog({
        title: '새 AI 추천을 시작할까요?',
        description: '현재 선택한 조건과 추천 초안은 초기화됩니다.',
        confirmLabel: '새 추천 시작',
        onConfirm: runAiGeneration,
      });
      return;
    }
    runAiGeneration();
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
    setFixedType('');
    setCustomMent('');
    if (isLastDraft) {
      setActiveTab('manual');
    }
  };

  const handleApplyAllAiDrafts = () => {
    if (aiDraftConditions.length === 0) return;
    setSelectedConditions(prev => [...prev, ...aiDraftConditions]);
    applyAllDrafts();
    setFixedType('');
    setCustomMent('');
    setActiveTab('manual');
  };

  const handleDiscardAiDraft = (index) => {
    const isLastDraft = aiDraftConditions.length === 1;
    discardDraft(index, selectedConditions.length > 0);
    if (isLastDraft) {
      setActiveTab('manual');
    }
  };

  const handleAiExample = (query) => {
    setCustomerQuery(query);
  };

const parseMentForComments = (text, originalConditions) => {
  const lines = text.split('\n');
  const updatedConditions = originalConditions.map(cond => ({ ...cond }));
  
  lines.forEach(line => {
    const match = line.match(/^([A-Za-z])\s*:\s*(.*)/);
    if (match) {
      const index = getConditionIndex(match[1]);
      if (index >= 0 && index < updatedConditions.length) {
        const content = match[2];
        const parts = content.split(' : ');
        const newComment = parts.length > 1 ? parts.slice(1).join(' : ') : '';
        if (updatedConditions[index]) {
          updatedConditions[index].comment = newComment.trim();
        }
      }
    }
  });
  return updatedConditions;
};

// ✨ '편집 완료' 핸들러 다시 추가
  const handleMentUpdate = (newMent) => {
    const updatedConditions = parseMentForComments(newMent, selectedConditions);
    setSelectedConditions(updatedConditions);
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
            <p className="app-description">문의 내용을 입력하면 AI가 조건 후보를 제안합니다. 검토 후 적용해 주세요.</p>
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
                    <div><strong>사용 방법</strong><p>아래 순서대로 진행하면 됩니다.</p></div>
                    <button type="button" onClick={() => setIsHelpOpen(false)} aria-label="사용 방법 닫기">×</button>
                  </div>
                  <div className="usage-help-steps">
                    <article className="usage-help-step">
                      <div className="help-screen help-query-screen">
                        <span className="help-mini-title">고객 문의 입력</span>
                        <i>거래량이 많고 시가총액이 큰 종목을 찾아줘</i>
                        <b>AI 조건 추천 받기</b>
                      </div>
                      <span className="help-step-number">01</span>
                      <h4>문의 입력</h4>
                      <p>고객이 원하는 조건을 입력합니다.</p>
                    </article>
                    <article className="usage-help-step">
                      <div className="help-screen help-result-screen">
                        <span className="help-mini-title">AI 추천 결과</span>
                        <i>거래량 증가 <em>적용</em></i>
                        <i>시가총액 1,000억 이상 <em>적용</em></i>
                        <b>추천 조건 적용</b>
                      </div>
                      <span className="help-step-number">02</span>
                      <h4>추천 조건 검토</h4>
                      <p>필요한 조건만 적용합니다.</p>
                    </article>
                    <article className="usage-help-step">
                      <div className="help-screen help-edit-screen">
                        <span className="help-mini-title">조건식 편집</span>
                        <i>+ 부족한 조건 직접 추가</i>
                        <i>상세 조건값 수정</i>
                        <b>수정 내용 반영</b>
                      </div>
                      <span className="help-step-number">03</span>
                      <h4>직접 추가·수정</h4>
                      <p>부족한 조건과 상세값을 보완합니다.</p>
                    </article>
                    <article className="usage-help-step">
                      <div className="help-screen help-group-screen">
                        <span className="help-mini-title">조건식 편집</span>
                        <div><b>A</b><i>AND</i><strong>( B <small>OR</small> C )</strong></div>
                        <em>그룹 편집 시작</em>
                      </div>
                      <span className="help-step-number">04</span>
                      <h4>조건식 확정</h4>
                      <p>조건식을 확인하고 답변을 복사합니다.</p>
                    </article>
                  </div>
                  <section className="usage-help-save-note">
                    <strong>작업 보관</strong>
                    <div className="help-save-visual">
                      <div className="help-save-screen">
                        <span>답변 멘트</span>
                        <b>임시저장</b>
                      </div>
                      <i>→</i>
                      <div className="help-save-screen">
                        <span>최근 작업</span>
                        <b>불러오기</b>
                      </div>
                    </div>
                    <p><b>답변 멘트에서 임시저장</b>을 누르면 현재 작업이 저장됩니다. 상단 <b>최근 작업</b>에서 다시 불러올 수 있으며, 저장본은 24시간 동안 유지됩니다.</p>
                  </section>
                </section>
              </div>
            )}
          </div>
        </header>
        <div className="main-content">
          <div className={`top-panel ${activeTab === 'ai' ? 'ai-workflow-layout' : ''}`}>
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
                     onChange={(event) => {
                       if (event.target.value) insertMent(event.target.value);
                     }}
                     className="workspace-select"
                     aria-label="답변 템플릿 선택"
                   >
                     <option value="">답변 템플릿 선택</option>
                     {mentButtons.map((ment) => <option key={ment} value={ment}>{ment}</option>)}
                   </select>
                 </div>
               )}
                </div>

              <div className="panel-content">
                {activeTab === 'manual' && aiWorkflowPhase === 'completed_empty' && selectedConditions.length === 0 && (
                  <WorkspaceEmptyState className="manual-empty-state" icon="✓" title="추천 조건을 모두 제외했습니다." description="왼쪽 조건 목록에서 직접 조건을 추가해 계속 편집할 수 있습니다." />
                )}
                {activeTab === 'manual' && aiWorkflowPhase !== 'completed_empty' && (
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
                {activeTab === 'ai' && (
                  <div className="ai-workflow">
                    <div className="ai-workflow-heading">
                      <span className="ai-workflow-icon">✦</span>
                      <div>
                        <h3>고객 문의 입력</h3>
                        <p>고객이 원하는 종목 조건을 자연스럽게 작성해 주세요.</p>
                      </div>
                    </div>
                    <button type="button" className="ai-clear-query-button" onClick={() => setCustomerQuery('')} disabled={!customerQuery}>문의 지우기</button>
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
                      <div className="ai-inline-result">최근 AI 추천: {lastAiResult.count}개 조건 초안을 만들었습니다. 검토 후 적용해 주세요.</div>
                    )}
                    <textarea
                      className="ment-box ai-query-input"
                      rows={7}
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
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
                      {isAiLoading || isLoading ? 'AI가 조건을 분석하고 있습니다...' : 'AI 조건 추천 받기'}
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
                    <span className="ai-workflow-icon">✦</span>
                    <div><h3>AI 추천 결과</h3><p>추천 조건을 적용하면 조건식 편집 화면으로 이동합니다.</p></div>
                  </div>
                )}
                {activeTab === 'manual' && (
                  <div className="ai-results-title">
                    <span className="ai-workflow-icon">✓</span>
                    <div><h3>선택된 조건</h3><p>조건의 순서와 상세 설정값을 검토해 주세요.</p></div>
                  </div>
                )}
                <button className="reset-button" onClick={handleReset}>전체 초기화</button>
              </div>
              <div className="panel-content">
                {activeTab === 'ai' && aiWorkflowPhase === 'idle' && (
                  <WorkspaceEmptyState className="ai-empty-state" icon="✦" title="AI가 조건 후보를 추천해 드립니다." description="고객 문의를 입력하고 AI 조건 추천 받기를 눌러 시작하세요." />
                )}
                {activeTab === 'ai' && aiWorkflowPhase === 'loading' && (
                  <WorkspaceEmptyState className="ai-empty-state ai-loading-state" icon="⋯" title="AI가 조건을 분석하고 있습니다." description="증권사 조건 목록과 고객 문의를 비교하고 있습니다." />
                )}
                {activeTab === 'ai' && aiWorkflowPhase === 'no_result' && (
                  <WorkspaceEmptyState className="ai-empty-state ai-no-result-state" icon="?" title="추천할 조건을 찾지 못했습니다." description="문의 내용을 조금 더 구체적으로 작성하거나 조건 목록을 확인해 주세요." />
                )}
                {activeTab === 'ai' && aiWorkflowPhase === 'error' && (
                  <WorkspaceEmptyState className="ai-empty-state ai-error-state" icon="!" title="AI 추천을 완료하지 못했습니다." description="안내 팝업의 내용을 확인한 뒤 잠시 후 다시 시도해 주세요." />
                )}
                {activeTab === 'ai' && aiWorkflowPhase === 'editing' && (
                  <div className="ai-return-state">
                    <span>✓</span>
                    <strong>조건식 편집이 진행 중입니다.</strong>
                    <p>현재 {selectedConditions.length}개 조건이 적용되어 있습니다.<br />새 AI 추천을 시작하면 기존 조건은 초기화됩니다.</p>
                  </div>
                )}
                {activeTab === 'ai' && ['review', 'partial_review'].includes(aiWorkflowPhase) && (
                  <AiDraftList
                    drafts={aiDraftConditions}
                    isPartial={aiWorkflowPhase === 'partial_review'}
                    onApplyAll={handleApplyAllAiDrafts}
                    onApply={handleApplyAiDraft}
                    onDiscard={handleDiscardAiDraft}
                  />
                )}
                {activeTab === 'manual' && (
                  selectedConditions.length > 0 ? (
                    <SelectedConditions selectedConditions={selectedConditions} onRemove={handleRemoveCondition} onCommentChange={handleCommentChange} onMove={handleMoveCondition} />
                  ) : (
                    <WorkspaceEmptyState className="manual-empty-state" icon="＋" title="적용된 조건이 없습니다." description="왼쪽 조건 목록에서 필요한 조건을 추가해 주세요." />
                  )
                )}
              </div>
            </div>
          </div>

          <div className="bottom-panel">
            <GeneratedMent 
              selectedConditions={selectedConditions} 
              onToggleOperator={handleToggleOperator} 
              fixedMentMap={fixedMentMap}
              selectedBroker={selectedBroker}
              fixedType={fixedType}
              ment={effectiveMent}
              isGrouping={isGrouping}
              // setIsGrouping={setIsGrouping}
              checkedLetters={checkedLetters}
              onToggleGroupMode={handleToggleGroupMode}
              onLetterCheck={handleLetterCheck}
              onGroup={handleGroupConditions}
              onUngroup={handleUngroupConditions}
              onClearAllGroups={handleClearAllGroups}
              onSaveDraft={handleSaveStrategy}
              // onMentUpdate={handleMentUpdate}
            />
          </div>
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
