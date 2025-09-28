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
import { generateMent } from './util/mentGenerator';
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


  const { allConditions, isLoading, error } = useBrokerData(selectedBroker);

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
  };

  useEffect(() => { //증권사 데이터 불러오기
  setSelectedConditions([]);
  setAutoMent("");
  setCustomMent("");
  setFixedType("");
  setSearch("");
}, [selectedBroker]);
 

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
    };

  const handleConditionClick = (condition) => {
    const newCondition = { ...condition, comment: ""}
    setSelectedConditions(prev => [...prev, condition]);
    
    // 고정 멘트 관련 상태 초기화
    setWarning("");
    setFixedType("");
    setAutoMent("");
    setCustomMent("");
  };

  const handleRemoveCondition = (index) => {
    setSelectedConditions(prev => prev.filter((_, i) => i !== index));
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

 const handleAiGenerate = async () => { //ai 버튼
    if (!selectedBroker || !customerQuery.trim()) {
      alert("증권사와 요청할 내용을 모두 입력해주세요.");
      return;
    }
      const newConditions = await generateStrategy({
      customerQuery: customerQuery,
      allConditions: allConditions, 
    });

    if (newConditions) {
      setSelectedConditions(prev => [...prev,newConditions]);
    }
  };

  return (
      <div className="container">
      <div className="card">
        <h2 className="title">전략 Q&A 조건 생성기</h2>

        {/* --- 탭 버튼 UI --- */}
        <div className="tabs-container">
          <button 
            className={`tab-button ${activeTab === 'manual' ? 'active' : ''}`}
            onClick={() => setActiveTab('manual')}
          >
            조건 생성
          </button>
          <button 
            className={`tab-button ${activeTab === 'ai' ? 'active' : ''}`}
            // onClick={() => setActiveTab('ai')}
             onClick={() => alert('개발중입니다.')}
          >
            AI 자동 생성
          </button>
        </div>

        {/* --- 탭 내용 (조건부 렌더링) --- */}
        <div className="tab-content">
          {activeTab === 'manual' && (
            <div id="manual-tab">
              {/* ✨ row와 column 구조로 다시 감싸줍니다. */}
              <div className="row align-center">
                <div className="small-column">
                  <BrokerSelector brokers={brokers} selectedBroker={selectedBroker} onChange={setSelectedBroker} />
                </div>
              </div>
              <ConditionList
                conditions={filteredConditions}
                onConditionClick={handleConditionClick}
                searchComponent={
              <ConditionSearch
                search={search}
                onSearch={setSearch}
                />
              }
          warning={warning}
           />
            </div>
          )}

          {activeTab === 'ai' && (
            <div id="ai-tab">
              {/* ✨ row와 column 구조로 다시 감싸줍니다. */}
              <div className="row align-center">
                  <div className="small-column">
                    <BrokerSelector brokers={brokers} selectedBroker={selectedBroker} onChange={setSelectedBroker} />
                  </div>
              </div>
              <div className="ai-section">
                <h3>고객 문의 내용</h3>
                <textarea
                  className="ment-box"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="고객의 전략 문의 내용을 여기에 붙여넣으세요. (예: 거래량 10만주 이상)"
                />
                <button className="generate-button" onClick={handleAiGenerate} disabled={isAiLoading || isLoading}>
                  {isAiLoading || isLoading ? '분석 중...' : 'AI로 조건 생성'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* --- 공통 UI --- */}
        <div className="selected-conditions-header">
          <h3>선택된 조건</h3>
          <button className="reset-button" onClick={handleReset}>초기화</button>
        </div>
        <div className="selected-conditions-box">
          <SelectedConditions
            selectedConditions={selectedConditions}
            onRemove={handleRemoveCondition}
            onCommentChange={handleCommentChange}
          />
        </div>
        
        <GeneratedMent
          ment={effectiveMent}
          onChange={setCustomMent}
        />
      </div>
    </div>
  );
}
