import React, { useState, useEffect } from 'react';
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
  const [activeTab, setActiveTab] = useState('manual'); 

  const [isMentManuallyEdited, setIsMentManuallyEdited] = useState(false);

// ✨ 1. 괄호로 묶을 항목(A, B, C...)을 저장할 상태
  const [checkedLetters, setCheckedLetters] = useState(new Set());
  const [isGrouping, setIsGrouping] = useState(false);
  const { allConditions, isLoading, error } = useBrokerData(selectedBroker);

  useEffect(() => { //증권사 데이터 불러오기
  setSelectedConditions([]);
  setAutoMent("");
  setCustomMent("");
  setFixedType("");
  setSearch("");
  setCheckedLetters(new Set());
}, [selectedBroker]);


  const insertMent = (type) => { //멘트 삽입 함수
    if (!selectedBroker) {
      alert("먼저 증권사를 선택해주세요.");
      return;
    }
    setFixedType(type);
    setSelectedConditions([]);
    setCustomMent("");
    setAutoMent("");
  };
  
  const handleReset = () => { //초기화 버튼
  setSelectedConditions([]);
  setCustomMent('');
  setAutoMent('');
  setFixedType('');
  setCheckedLetters(new Set());
  setIsMentManuallyEdited(false);
  };

 
  useEffect(() => { //멘트 바로 수정
  if (fixedType && selectedConditions.length === 0) {
    const ment = generateMent(fixedType);
    setAutoMent(ment);
    setCustomMent(ment);
  }
  }, [selectedConditions, fixedType]);

  const handleCommentChange = (index, newComment) => {
  setSelectedConditions(prev =>
    prev.map((cond, i) =>
      i === index ? { ...cond, comment: newComment } : cond
    )
      );
      setIsMentManuallyEdited(false);
      setCustomMent("");
      setFixedType("");
    };

  const handleConditionClick = (condition) => {
    const newCondition = { ...condition, comment: ""}
    setSelectedConditions(prev => [...prev, {...condition, comment: undefined, operator : 'and', groupIds: []}]);
    
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
      alert('괄호로 묶을 항목을 2개 이상 선택해주세요.');
      setCheckedLetters(new Set())
      return;
    }

    const sortedIndices = Array.from(checkedLetters)
      .map(letter => letter.charCodeAt(0) - 'A'.charCodeAt(0))
      .sort((a, b) => a - b);

    // 인덱스가 1씩 증가하는지(연속된 숫자인지) 확인합니다.
    for (let i = 0; i < sortedIndices.length - 1; i++) {
      if (sortedIndices[i + 1] - sortedIndices[i] !== 1) {
        alert('연속된 조건끼리만 그룹으로 묶을 수 있습니다.\n');
        setCheckedLetters(new Set());
        return;
      }
    }

    const firstIndex = sortedIndices[0];
    const lastIndex = sortedIndices[sortedIndices.length - 1];
    
    // 3-1. 왼쪽 경계 확인: 선택된 첫 항목이 바로 앞 항목과 그룹을 공유하는지?
    if (firstIndex > 0) {
      const currentItem = selectedConditions[firstIndex];
      const prevItem = selectedConditions[firstIndex - 1];
      
      // 두 항목이 공통으로 가진 그룹 ID가 하나라도 있다면?
      const sharedGroups = currentItem.groupIds.filter(id => prevItem.groupIds.includes(id));
      if (sharedGroups.length > 0) {
        alert('기존에 설정된 괄호를 가로질러 그룹을 만들 수 없습니다.\n(앞쪽 괄호의 범위를 확인해주세요.)');
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
        alert('기존에 설정된 괄호를 가로질러 그룹을 만들 수 없습니다.\n(뒤쪽 괄호의 범위를 확인해주세요.)');
        setCheckedLetters(new Set());
        return;
      }
    }

const newGroupId = Date.now();
    setSelectedConditions(prev => 
      prev.map((item, index) => {
        const letter = String.fromCharCode('A'.charCodeAt(0) + index);
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
    const sampleIndex = Array.from(checkedLetters)[0].charCodeAt(0) - 'A'.charCodeAt(0);
    const sampleItem = selectedConditions[sampleIndex];
    
    if (sampleItem && sampleItem.groupIds && sampleItem.groupIds.length > 0) {
      targetGroupId = sampleItem.groupIds[sampleItem.groupIds.length - 1];
    }

    if (!targetGroupId) {
      alert("해제할 그룹이 없습니다.");
      return;
    }
    
    setSelectedConditions(prev =>
      prev.map((item, index) => {
      const letter = String.fromCharCode('A'.charCodeAt(0) + index);
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
      alert("삭제할 괄호가 없습니다.");
      return;
    }
 if (window.confirm("설정된 모든 괄호를 삭제하시겠습니까?")) {
      setSelectedConditions(prev =>
        prev.map(item => ({ ...item, groupIds: [] })) // 모든 groupIds 초기화
      );
      setCheckedLetters(new Set()); // 선택 해제
    }
  };

  //and / or
 const handleToggleOperator = (index) => {
    // index에 해당하는 조건의 operator를 'and' -> 'or', 'or' -> 'and'로 변경
    const newConditions = selectedConditions.map((item, i) => {
      if (i === index) {
        return { ...item, operator: item.operator === 'and' ? 'or' : 'and' };
      }
      return item;
    });
    setSelectedConditions(newConditions);
    setIsMentManuallyEdited(false); // 멘트가 자동으로 다시 생성되도록 설정
  };


  const handleMoveCondition = (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedConditions.length) return;
 
    setSelectedConditions(prev => {
      const updated = [...prev];
      [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
      // ✨ 순서가 바뀌면 기존 괄호(그룹) 구조가 인덱스 기준이라 깨지므로 전체 초기화합니다.
      return updated.map(item => ({ ...item, groupIds: [] }));
    });
    setCheckedLetters(new Set());
    setIsGrouping(false);
    setIsMentManuallyEdited(false);
    setCustomMent("");
    setFixedType("");
  };
 
  const handleRemoveCondition = (index) => {
    setSelectedConditions(prev => 
      prev
        .filter((_, i) => i !== index) // 선택한 항목 삭제
        .map(item => ({ ...item, groupIds: [] })) // ✨ 모든 괄호 초기화
    );
    setIsMentManuallyEdited(false);
    setCustomMent("");
    setFixedType("");
    setCheckedLetters(new Set()); // 선택 상태도 초기화
    setIsGrouping(false);
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

  /*
   const effectiveMent = customMent || autoMent || generateMent({
     selectedConditions,
     fixedMentMap,
     selectedBroker,
     fixedType
     });

   const handleMentChange = (newMent) => {
     setCustomMent(newMent);
     setIsMentManuallyEdited(true); // ✨ 사용자가 직접 수정했음을 기록

     const updated = parseMentAndUpdateConditions(newMent, selectedConditions);
     setSelectedConditions(updated);
   };
*/
const handleAiGenerate = async () => {
    // 1. 유효성 검사
    if (!selectedBroker) {
      alert("먼저 증권사를 선택해주세요.");
      return;
    }
    if (!customerQuery.trim()) {
      alert("고객 문의 내용을 입력해주세요.");
      return;
    }
    if (!allConditions || allConditions.length === 0) {
      alert("선택하신 증권사의 조건 데이터가 없습니다.");
      return;
    }

    setSelectedConditions([]);

    // ✨ 중요: 함수 호출 시 3번째 인자로 'selectedBroker'를 전달합니다!
    const matchedConditions = await generateStrategy(customerQuery, allConditions, selectedBroker);

    // 2. 결과 처리 (여러 개의 매칭 결과를 모두 반영)
    if (matchedConditions && matchedConditions.length > 0) {
      const newConditionItems = groupOrConditions(matchedConditions.map((cond, i) => ({
        ...cond,
        id: Date.now() + i, // ✨ 여러 개를 한 번에 추가해도 id가 겹치지 않도록
        operator: cond.nextOperator === 'or' ? 'or' : 'and',
        comment: cond.detail,
      })));

      setSelectedConditions(prev => [...prev, ...newConditionItems]);
      setFixedType("");
      alert(`AI가 조건 ${newConditionItems.length}개를 찾아냈습니다!\n${newConditionItems.map(c => `- ${c.path}`).join('\n')}`);

    } else {
      alert("AI가 적절한 조건을 찾지 못했습니다.\n질문을 더 구체적으로 적어주세요.");
    }
  };

  //새로운 멘트
const parseMentForComments = (text, originalConditions) => {
  const lines = text.split('\n');
  const updatedConditions = originalConditions.map(cond => ({ ...cond }));
  
  lines.forEach(line => {
    const match = line.match(/^([A-Z])\s*:\s*(.*)/);
    if (match) {
      const index = match[1].charCodeAt(0) - 'A'.charCodeAt(0);
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
        <h2 className="title">전략 Q&A 조건 생성기</h2>
        <div className="main-content">
          <div className="top-panel">
            <div id="left-panel" className="panel">
              <div className="tabs-container">
                <button className={`tab-button ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>조건 생성</button>
                {/* <button className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => alert('현재 개발중입니다.')}>AI 자동 생성</button> */}
                <button className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>AI 자동 생성</button>
              </div>
              
              <div className="broker-actions-container">
               <BrokerSelector brokers={brokers} selectedBroker={selectedBroker} onChange={setSelectedBroker} />
               {/*} <div className="fixed-ment-buttons">
                  <button className="notice-button" onClick={() => insertMent('조건선물')}>조건선물</button>
                  <button className="notice-button" onClick={() => insertMent('작성불가')}>작성불가</button>
                  <button className="notice-button" onClick={() => insertMent('고객센터')}>고객센터</button>
                  {/* 필요에 따라 버튼 추가 
                </div> */}
               <div className="fixed-ment-buttons">
                  {mentButtons.map((ment, idx) => (
                    <button 
                      key={idx} 
                      className="notice-button" 
                      onClick={() => insertMent(ment)}
                    >
                      {ment}
                    </button>
                  ))}
                </div>
                </div>

              <div className="panel-content">
                {activeTab === 'manual' && (
                  <>
                  <div className="list-header">
                        <h3>조건 선택</h3>
                        <ConditionSearch search={search} onSearch={setSearch} />
                  </div>
                    <ConditionList conditions={filteredConditions} onConditionClick={handleConditionClick} />
                  </>
                )}
                {activeTab === 'ai' && (
                  <div id="ai-tab">
                    <div className="ai-section">
                      <h3>고객 문의 내용</h3>
                      <textarea
                        className="ment-box"
                        rows={8}
                        value={customerQuery}
                        onChange={(e) => setCustomerQuery(e.target.value)}
                        placeholder="고객의 전략 문의 내용을 여기에 붙여넣으세요."
                      />
                      <button className="generate-button" onClick={handleAiGenerate} disabled={isAiLoading || isLoading}>
                        {isAiLoading || isLoading ? '분석 중...' : 'AI로 조건 생성'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div id="right-panel" className="panel">
              <div className="panel-header">
                <h3>선택된 조건</h3>
                <button className="reset-button" onClick={handleReset}>초기화</button>
              </div>
              <div className="panel-content">
                <SelectedConditions selectedConditions={selectedConditions} onRemove={handleRemoveCondition} onCommentChange={handleCommentChange} onMove={handleMoveCondition} />
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
              // onMentUpdate={handleMentUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
