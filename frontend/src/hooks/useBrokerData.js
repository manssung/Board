import { useState, useEffect } from 'react';
import brokerMap from '../data/brokerMap.js';

// XML 파싱 함수
const parseXml = (xmlString) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");
  const errorNode = xmlDoc.querySelector('parsererror');
  if (errorNode) {
    console.error("XML 파싱 오류:", errorNode.textContent);
    return null;
  }
  return xmlDoc;
};

///미래에셋용
const generateMiraePath = (conditionNode, categoryNode) => {
    const pathSegments = [];
    let currentNode = conditionNode;
    // 부모가 최상위 카테고리 노드일 때까지만 반복합니다.
    while (currentNode && currentNode !== categoryNode) {
        const name = currentNode.getAttribute('NAME');
        if (name) {
            pathSegments.unshift(name);
        }
        currentNode = currentNode.parentElement;
    }
    return pathSegments.join('>');
};

// treecommon.xml의 계층 구조를 따라 경로를 생성하는 함수
const generatePath = (conditionNode, categoryNode) => {
    const pathSegments = [];
    let currentNode = conditionNode;
    while(currentNode && currentNode !== categoryNode) {
        const name = currentNode.getAttribute('NAME');
        if(name) {
            pathSegments.unshift(name);
        }
        currentNode = currentNode.parentElement;
    }
    return pathSegments.join('>');
};

// map.xml의 템플릿과 값으로 상세 설명을 생성하는 함수
const fillTemplate = (templateNode) => {
    if (!templateNode) return '';
    let template = templateNode.getAttribute('COMPLETE_INDEX_NAME') || templateNode.getAttribute('COMPLETE_INDEX_NAME2') || '';
    
    template = template.replace(/\(STERM\)봉전기준/g, '');
    template = template.replace(/\(ETERM\)봉이내/g, '');
    template = template.replace(/\(SCNT1\)~\(SCNT2\)회 발생/g, '');

    const controls = Array.from(templateNode.querySelectorAll('CONTROL'));
    const placeholders = template.match(/\(([^)]+)\)/g) || [];
    placeholders.forEach(placeholder => {
        const packetId = placeholder.substring(1, placeholder.length - 1);
        const control = controls.find(c => c.getAttribute('PACKET_ID') === packetId);
        if (control) {
            let value = control.getAttribute('DEFAULT_VALUE');
            const comboItems = control.getAttribute('COMBO_ITEM');
            const comboIndexes = control.getAttribute('COMBO_INDEX');
            if (comboItems && comboIndexes) {
                const items = comboItems.split('/');
                const indexes = comboIndexes.split('/');
                const valueIndex = indexes.indexOf(value);
                if (valueIndex !== -1) value = items[valueIndex];
            }
            template = template.replace(placeholder, value);
        }
    });
    return template.replace(/봉전기준|봉이내|,|회 발생/g, '').replace(/\s+/g, ' ').trim();
};

export function useBrokerData(selectedBroker) {
  const [allConditions, setAllConditions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const processData = async () => {
      const fileInfo = brokerMap[selectedBroker];
      if (!fileInfo) {
        setAllConditions([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
         if (selectedBroker === '미래에셋증권') {
          const treeUrls = fileInfo.tree.map(file => `${process.env.PUBLIC_URL}${file}`);
          const mapUrls = (fileInfo.maps || []).map(file => `${process.env.PUBLIC_URL}${file}`);
          const urls = [...treeUrls, ...mapUrls];

            const responses = await Promise.all(urls.map(url => fetch(url)));
            const xmlStrings = await Promise.all(responses.map(async (res) => {
                if (!res.ok) throw new Error(`${res.url} 파일 로드 실패`);
                const buffer = await res.arrayBuffer();
                const decoder = new TextDecoder('euc-kr');
                return decoder.decode(buffer);
            }));

            const detailMap = new Map();
            const mapXmlStrings = xmlStrings.slice(treeUrls.length); 
            for (const xmlString of mapXmlStrings) {
                const mapXml = parseXml(xmlString);
                if (!mapXml) continue;
                mapXml.querySelectorAll('*[MAP_NAME]').forEach(node => {
                    const mapName = node.getAttribute('MAP_NAME');
                    if (mapName) {
                        detailMap.set(mapName, fillTemplate(node));
                    }
                });
            }

            console.log("미래에셋 mapXmlStrings 개수:", detailMap);

          const conditions = [];
            const treeXmlStrings = xmlStrings.slice(0, treeUrls.length);
            for (const xmlString of treeXmlStrings) {
                const treecommonXml = parseXml(xmlString);
                if (!treecommonXml) continue;

                const topCategories = Array.from(treecommonXml.documentElement.children);
                topCategories.forEach(categoryNode => {
                   //const type = categoryNode.tagName;
                    if (!treecommonXml.documentElement.hasAttribute('TYPE')) return;
                    const type = treecommonXml.documentElement.tagName.replace(/-/g, '/');
                    categoryNode.querySelectorAll('*[NAME]:not(:has(*[NAME]))').forEach(conditionNode => {

                   const path = generateMiraePath(conditionNode);
                        if (path){
                        const conditionName = conditionNode.getAttribute('NAME');
                        const detail = detailMap.get(conditionName) || '';
                            conditions.push({ 
                                type: type, 
                                path: path, 
                                detail: detail,
                                broker: selectedBroker 
                            });
                          }
                    });
                });
            };
            setAllConditions(conditions);
        } else if (Array.isArray(fileInfo) && fileInfo.length > 0) {
          const firstFilePath = fileInfo[0];
          const folderPath = firstFilePath.substring(0, firstFilePath.lastIndexOf('/'));
          const treecommonUrl = `${process.env.PUBLIC_URL}${folderPath}/treecommon.xml`;
          const mapUrls = fileInfo.filter(file => !file.includes('treecommon.xml')).map(file => `${process.env.PUBLIC_URL}${file}`);
          const urls = [treecommonUrl, ...mapUrls];
          // const treecommonUrl = `http://localhost:3001/api/conditions?broker=${selectedBroker}`; //서버 연동
          // const mapUrls = fileInfo.filter(file => !file.includes('treecommon.xml')).map(file => `${process.env.PUBLIC_URL}${file}`);
          // const urls = [treecommonUrl, ...mapUrls];
          const responses = await Promise.all(urls.map(url => fetch(url)));
          const xmlStrings = await Promise.all(responses.map(async (res) => {
              if (!res.ok) throw new Error(`${res.url} 파일 로드 실패`);
              const buffer = await res.arrayBuffer();
              const decoder = new TextDecoder('euc-kr');
              return decoder.decode(buffer);
          }));
          const treecommonXml = parseXml(xmlStrings[0]);
          const mapXmls = xmlStrings.slice(1).map(s => parseXml(s));        
          const conditions = [];

          if (treecommonXml) {
            const topCategories = Array.from(treecommonXml.documentElement.children);
            
            topCategories.forEach(categoryNode => {
              const type = categoryNode.tagName;
              const conditionNodes = categoryNode.querySelectorAll('*[NAME]');

              conditionNodes.forEach(conditionNode => {
                if (conditionNode.tagName.toUpperCase() === 'P') return;

                const path = generatePath(conditionNode, categoryNode);
                const conditionName = conditionNode.getAttribute('NAME');
                let detail = '';

                // ✨ 모든 map.xml 파일에서 일치하는 조건을 찾아 detail을 채웁니다.
                for (const mapXml of mapXmls) {
                    if (!mapXml) continue;
                    const mapNode = mapXml.querySelector(`*[MAP_NAME="${conditionName}"]`);
                    if (mapNode) {
                        detail = fillTemplate(mapNode);
                        break; // 찾았으면 더 이상 찾지 않음
                    }
                }
                conditions.push({
                  type: type,
                  path: path,
                  detail: detail,
                  broker: selectedBroker,
                });
              });
            });
            setAllConditions(conditions);
          }

        } else {
          // JSON 파일 처리 로직
        }
      } catch (err) {
        console.error('데이터 처리 중 오류:', err);
        setError('데이터를 처리하는 데 실패했습니다.');
        setAllConditions([]);
      } finally {
        setIsLoading(false);
      }
    };

    processData();
  }, [selectedBroker]);

  return { allConditions, isLoading, error };
}