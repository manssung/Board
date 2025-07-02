import React from 'react';

export default function BrokerSelector({ brokers = [], selectedBroker, onChange }) {
  return (
    <div className="column">
      <label>증권사 선택</label>
      <select value={selectedBroker} onChange={(e) => onChange(e.target.value)}>
        <option value="">선택하세요</option>
        {(brokers || []).map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    </div>
  );
}
