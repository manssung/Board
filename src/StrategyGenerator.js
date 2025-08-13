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

  return (
    <div className="container">
      <div className="card">
        <h2 className="title">전략 Q&A 조건 생성기</h2>
        <div className="row align-center">
          <div className="small-column">
            <BrokerSelector
              brokers={brokers}
              selectedBroker={selectedBroker}
              onChange={setSelectedBroker}
            />
          </div>
          <div className="small-column">
            <ConditionSearch
              search={search}
              onSearch={setSearch}
            />
          </div>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <button className="notice-button" onClick={() => insertMent('작성불가')}>작성 불가</button>
          <button className="notice-button" onClick={() => insertMent('고객센터')}>고객센터</button>
        </div>
        <ConditionList
          conditions={filteredConditions}
          onConditionClick={handleConditionClick}
          warning={warning}
        />
        <div className="selected-conditions-header">
        <h3>선택된 조건</h3>
        <button className="reset-button" onClick={handleReset}>
        초기화
        </button>
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
