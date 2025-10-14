import React from 'react';
import '../css/BrokerSelector.css';

export default function BrokerSelector({ brokers = [], selectedBroker, onChange }) {
  return (
<div className="broker-selector-container"> 
      {/* <label htmlFor="broker-select">증권사 선택</label>  // 제목이 위에 있으므로 라벨은 생략 가능 */}
      <select 
        id="broker-select"
        value={selectedBroker} 
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">증권사 선택</option>
        {brokers.map(broker => (
          <option key={broker} value={broker}>
            {broker}
          </option>
        ))}
      </select>
    </div>
  );
}
