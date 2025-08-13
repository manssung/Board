import { useState, useEffect } from 'react';
import brokerMap from '../data/brokerMap.js';

const extractTypeFromPath = (path = '') => {
  const match = path.match(/^([^>]+)>/);
  return match ? match[1].trim() : '';
};

export function useBrokerData(selectedBroker) {
  const [allConditions, setAllConditions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (brokerMap[selectedBroker]) {
      setIsLoading(true);
      setError(null);
      fetch(`${process.env.PUBLIC_URL}${brokerMap[selectedBroker]}`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return res.text();
        })
        .then(text => {
          const json = JSON.parse(text);
          const enriched = json.map(item => ({
            ...item,
            broker: selectedBroker,
            name: item.name || item.path,
            type: item.type || extractTypeFromPath(item.path) || ''
          }));
          setAllConditions(enriched);
        })
        .catch(err => {
          console.error('조건 데이터 로딩 오류:', err);
          setError('데이터를 불러오는 데 실패했습니다.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setAllConditions([]);
    }
  }, [selectedBroker]);

  return { allConditions, isLoading, error };
}