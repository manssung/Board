import React, { useState, useEffect } from 'react';
import './StrategyQnA.css';
import BrokerSelector from '../src/components/BrokerSelector';
import ConditionSearch from '../src/components/Condition Search';
import ConditionList from '../src/components/Condition List';
import SelectedConditions from '../src/components/Selected Conditions';
import GeneratedMent from '../src/components/Generated Ment';

const brokers = ["LS증권", "미래에셋증권", "NH증권", "신한증권", "교보증권", "KB증권"];

export default function StrategyQnA() {
  const [selectedBroker, setSelectedBroker] = useState("");
  const [search, setSearch] = useState("");
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [allConditions, setAllConditions] = useState([]);
  const [customMent, setCustomMent] = useState("");
  const [warning, setWarning] = useState("");

  useEffect(() => {
    const brokerMap = {      
      "신한증권": "shinhan_condition.json",
      "KB증권": "/kb_condition.json",
      "NH증권": "/nh_condition.json",
      "교보증권": "/kyobo_condition.json",
      "LS증권": "/ls_condition.json",
      "미래에셋증권": "/mirae_condition.json"
    };

    setSelectedConditions([]);

    if (brokerMap[selectedBroker]) {
      fetch(brokerMap[selectedBroker])
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.text();
        })
        .then(text => {
          const json = JSON.parse(text);
          const enriched = json.map(item => ({
            ...item,
            broker: selectedBroker, // ✅ broker 필드 수동 주입
            name: item.name || item.path,
            type: item.type || extractTypeFromPath(item.path) || ''
          }));
          setAllConditions(enriched);
        })
        .catch(err => console.error('조건 데이터 로딩 오류:', err));
    } else {
      setAllConditions([]);
    }
  }, [selectedBroker]);

  const extractTypeFromPath = (path = '') => {
    const match = path.match(/^([^>]+)>/);
    return match ? match[1].trim() : '';
  };

const handleConditionClick = (condition) => {
  setSelectedConditions(prev => [...prev, condition]);
  setWarning("");
};


  const handleRemoveCondition = (index) => {
    setSelectedConditions(prev => prev.filter((_, i) => i !== index));
  };

  const generateMent = () => {
    if (selectedConditions.length === 0) {
      return "※ 조건을 하나 이상 선택해주세요.";
    }
    let ment = "안녕하십니까 전략Q&A담당자입니다.\n먼저 전략Q&A게시판을 이용해주시는 고객님께 감사인사드립니다.\n\n문의하신 내용에 대해 답변드립니다.\n\n";
    selectedConditions.forEach((c, i) => {
      ment += `${String.fromCharCode(65 + i)} : ${c.type}>${c.path} : \n`;
    });
    ment += `\n조건식 ${selectedConditions.map((_, i) => String.fromCharCode(65 + i)).join(" and ")} 입니다.\n\n감사합니다.`;
    return ment;
  };

  const filteredConditions = allConditions?.filter(
    c =>
      (
        c?.path?.toLowerCase().includes(search.toLowerCase()) ||
        c?.detail?.toLowerCase().includes(search.toLowerCase()) ||
        c?.type?.toLowerCase().includes(search.toLowerCase())
      )
  ) || [];

  const effectiveMent = customMent || generateMent();

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

        <ConditionList
          conditions={filteredConditions}
          onConditionClick={handleConditionClick}
          warning={warning}
        />

        <div className="selected-conditions-box">
          <SelectedConditions
            selectedConditions={selectedConditions}
            onRemove={handleRemoveCondition}
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
