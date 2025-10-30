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

  const { allConditions, isLoading, error } = useBrokerData(selectedBroker);

  useEffect(() => { //증권사 데이터 불러오기
  setSelectedConditions([]);
  setAutoMent("");
  setCustomMent("");
  setFixedType("");
  setSearch("");
}, [selectedBroker]);


  const insertMent = (type) => { //멘트 삽입 함수
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
    setSelectedConditions(prev => [...prev, {...condition, comment: undefined, operator : 'and'},]);
    
    // 고정 멘트 관련 상태 초기화
    setWarning("");
    setFixedType("");
    setAutoMent("");
    setCustomMent("");
    setIsMentManuallyEdited(false);
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


  const handleRemoveCondition = (index) => {
    setSelectedConditions(prev => prev.filter((_, i) => i !== index));
    setIsMentManuallyEdited(false);
    setCustomMent("");
    setFixedType("");
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
    if (!selectedBroker || !customerQuery.trim()) {
      alert("증권사와 요청할 내용을 모두 입력해주세요.");
      return;
    }

    // 1. 여기서 AI에게 보낼 프롬프트를 완성합니다.
    const prompt = `
          # 역할:
          당신은 증권사 조건검색 전략 생성 전문가입니다.
          # 임무:
          1. 사용자의 자연어 요청을 분석합니다.
          2. 주어진 '${selectedBroker}'의 '전체 조건 목록'에서 사용자의 요청과 가장 관련이 높은 조건 객체 "하나"를 선택합니다.
          3. 선택한 조건 객체의 'detail' 필드에 있는 숫자 값을 사용자의 요청에 맞게 수정합니다.
          4. 최종적으로, 'detail' 필드가 수정된 "완전한 조건 객체"를 JSON 형식으로 반환합니다.
          # 사용자의 요청:
          "${customerQuery}"
          # 전체 조건 목록 (JSON):
          ${JSON.stringify(allConditions, null, 2)}
          # 지시사항:
          - '전체 조건 목록'에서 가장 적합한 조건 객체를 단 하나만 찾아야 합니다.
          - 찾은 객체의 'detail'에 있는 수치만 사용자의 요청에 맞게 수정하고, 나머지 문구는 그대로 유지해야 합니다.
          - 다른 설명이나 대화 없이, 오직 수정된 **JSON 객체 하나만** 반환해야 합니다.
          - 응답 앞뒤에 \`\`\`json ... \`\`\` 같은 마크다운을 절대 포함하지 마세요.
          # 예시:
          - 사용자의 요청: "거래량 10만주 이상인 종목 찾아줘"
          - '전체 조건 목록'에서 찾은 객체: 
            { "type": "시세분석", "path": "거래량>거래량 범위", "detail": "거래량이 20,000주 이상" }
          - 올바른 반환값 (JSON 형식):
            { "type": "시세분석", "path": "거래량>거래량 범위", "detail": "거래량이 100,000주 이상" }
          `;

    // 2. 완성된 prompt를 훅에 전달하여 AI를 호출합니다.
    const newCondition = await generateStrategy(prompt);
    if (newCondition) {
      setSelectedConditions(prev => [...prev, { ...newCondition, comment: undefined }]);
      setIsMentManuallyEdited(false);
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
  return (
<div className="container">
      <div className="card">
        <h2 className="title">전략 Q&A 조건 생성기</h2>
        <div className="main-content">
          <div className="top-panel">
            <div id="left-panel" className="panel">
              <div className="tabs-container">
                <button className={`tab-button ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>조건 생성</button>
                <button className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => alert('현재 개발중입니다.')}>AI 자동 생성</button>
              </div>
              
              <div className="broker-actions-container">
               <BrokerSelector brokers={brokers} selectedBroker={selectedBroker} onChange={setSelectedBroker} />
               <div className="fixed-ment-buttons">
                  <button className="notice-button" onClick={() => insertMent('조건선물')}>조건선물</button>
                  <button className="notice-button" onClick={() => insertMent('작성불가')}>작성불가</button>
                  <button className="notice-button" onClick={() => insertMent('고객센터')}>고객센터</button>
                  {/* 필요에 따라 버튼 추가 */}
                </div>
                </div>
                <div className="list-header">
                      <h3>조건 선택</h3>
                      <ConditionSearch search={search} onSearch={setSearch} />
                </div>
              <div className="panel-content">
                {activeTab === 'manual' && (
                  <>
                    <ConditionList conditions={filteredConditions} onConditionClick={handleConditionClick} />
                  </>
                )}
                {activeTab === 'ai' && (
                  <div id="ai-tab">
                    <BrokerSelector brokers={brokers} selectedBroker={selectedBroker} onChange={setSelectedBroker} />
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
                <SelectedConditions selectedConditions={selectedConditions} onRemove={handleRemoveCondition} onCommentChange={handleCommentChange} />
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
              // onMentUpdate={handleMentUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
