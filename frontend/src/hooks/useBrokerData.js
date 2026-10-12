import { useState, useEffect } from 'react';
import { loadBrokerConditions } from '../util/brokerConditions';

export function useBrokerData(selectedBroker) {
  const [data, setData] = useState({ broker: '', conditions: [], loading: false, error: null });
  useEffect(() => {
    if (!selectedBroker) return undefined;
    let active = true;
    setData({ broker: selectedBroker, conditions: [], loading: true, error: null });
    loadBrokerConditions(selectedBroker).then((conditions) => {
      if (active) setData({ broker: selectedBroker, conditions, loading: false, error: null });
    }).catch((error) => {
      console.error('데이터 처리 중 오류:', error);
      if (active) setData({ broker: selectedBroker, conditions: [], loading: false, error: '데이터를 처리하는 데 실패했습니다.' });
    });
    return () => { active = false; };
  }, [selectedBroker]);
  const current = data.broker === selectedBroker;
  return {
    allConditions: current ? data.conditions : [],
    isLoading: Boolean(selectedBroker && (!current || data.loading)),
    error: current ? data.error : null,
  };
}
