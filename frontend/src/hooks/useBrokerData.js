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

            // 💡 [핵심 1] 정규화 함수 추가: 띄어쓰기 싹 무시하고 소문자로 통일!
            const normalizeKey = (str) => {
                if (!str) return '';
                return str
.toLowerCase()                         // 1. 일단 싹 다 소문자로 변환
        .replace(/stochastics/g, 'stochastic') // 2. stochastics는 무조건 stochastic으로! (s 제거)
        .replace(/bands/g, 'band')             // 3. bands는 무조건 band로! (s 제거)
        .replace(/[\s\-_/()\[\]%&,]/g, '')      // 4. 띄어쓰기 및 온갖 특수기호 싹 무시
        .replace(/[율률]/g, '');       // 3. 영어는 소문자로 통일
            };

            const detailMap = new Map();
            const mapXmlStrings = xmlStrings.slice(treeUrls.length); 
            for (const xmlString of mapXmlStrings) {
                const mapXml = parseXml(xmlString);
                if (!mapXml) continue;
                
                mapXml.querySelectorAll('*[MAP_NAME]').forEach(node => {
                    const mapName = node.getAttribute('MAP_NAME');
                    const completeIndexName = node.getAttribute('COMPLETE_INDEX_NAME');
                    
                    // 알맹이 데이터는 한 번만 만들어 둠
                    const detailData = fillTemplate(node); 

                    // 💡 [핵심 2] 투망 던지기: MAP_NAME이든 COMPLETE_INDEX_NAME이든 둘 다 정규화해서 저장!
                    if (mapName) {
                        detailMap.set(normalizeKey(mapName), detailData);
                    }
                    if (completeIndexName) {
                        detailMap.set(normalizeKey(completeIndexName), detailData);
                    }
                });
            }

            const conditions = [];
            const treeXmlStrings = xmlStrings.slice(0, treeUrls.length);
            for (const xmlString of treeXmlStrings) {
                const treecommonXml = parseXml(xmlString);
                if (!treecommonXml) continue;

                const topCategories = Array.from(treecommonXml.documentElement.children);
                topCategories.forEach(categoryNode => {
                    if (!treecommonXml.documentElement.hasAttribute('TYPE')) return;
                    const type = treecommonXml.documentElement.tagName.replace(/-/g, '/');
                    categoryNode.querySelectorAll('*[NAME]:not(:has(*[NAME]))').forEach(conditionNode => {

                        const path = generateMiraePath(conditionNode);
                        if (path) {
                            const conditionName = conditionNode.getAttribute('*[NAME]:not(:has(*[NAME]))');
                            
                            // 💡 [핵심 3] 정규화된 이름으로 찾기! (볼린저 밴드 오타 문제 해결)
                            let detail = detailMap.get(normalizeKey(conditionName)); 
                            
                            // (보너스) 디버깅용: 그래도 못 찾는 건 진짜 데이터가 없는 놈!
                            if (!detail) {
                                console.warn(`진짜 데이터 누락됨: [${conditionName}]`);
                                detail = ''; // 나중에 UI에서 placeholder로 처리하기 위해 빈칸으로 넘김
                            }

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
         
        } else if (selectedBroker.includes('해외')) {
            const firstFilePath = fileInfo[0];
            const folderPath = firstFilePath.substring(0, firstFilePath.lastIndexOf('/'));
            const treecommonUrl = `${process.env.PUBLIC_URL}${folderPath}/treecommon.xml`;
            const mapUrls = fileInfo.filter(file => !file.includes('treecommon.xml')).map(file => `${process.env.PUBLIC_URL}${file}`);
            const urls = [treecommonUrl, ...mapUrls];
            
            const responses = await Promise.all(urls.map(url => fetch(url)));
            const xmlStrings = await Promise.all(responses.map(async (res) => {
                if (!res.ok) throw new Error(`${res.url} 파일 로드 실패`);
                const buffer = await res.arrayBuffer();
                const decoder = new TextDecoder('euc-kr');
                return decoder.decode(buffer);
            }));

            // 💡 [핵심 1] 궁극의 정규화 함수
            const normalizeKey = (str) => {
                if (!str) return '';
                return str
                .replace(/stochastics/g, 'stochastic') // 2. stochastics는 무조건 stochastic으로! (s 제거)
                .replace(/bands/g, 'band')             // 3. bands는 무조건 band로! (s 제거)
                .replace(/[\s\-_/()\[\]%&,]/g, '')      // 4. 띄어쓰기 및 온갖 특수기호 싹 무시
                .replace(/[율률]/g, '');       // 3. 영어는 소문자로 통일        // 소문자 통일
                    };

            const treecommonXml = parseXml(xmlStrings[0]);
            const mapXmls = xmlStrings.slice(1).map(s => parseXml(s));        
            
            // 💡 [핵심 2] Map(사물함) 만들어서 정규화된 이름으로 데이터 쟁여두기!
            const detailMap = new Map();
            for (const mapXml of mapXmls) {
                if (!mapXml) continue;
                mapXml.querySelectorAll('*[MAP_NAME]').forEach(node => {
                    const detailData = fillTemplate(node);
                    const mapName = node.getAttribute('MAP_NAME');
                    const completeIndexName = node.getAttribute('COMPLETE_INDEX_NAME');

                    // 투망 던지기 (둘 중 하나라도 걸려라!)
                    if (mapName) {
                        detailMap.set(normalizeKey(mapName), detailData);
                    }
                    if (completeIndexName) {
                        detailMap.set(normalizeKey(completeIndexName), detailData);
                    }
                });
            }

            const conditions = [];

            if (treecommonXml) {
                const topCategories = Array.from(treecommonXml.documentElement.children);
                
                topCategories.forEach(categoryNode => {
                    const type = categoryNode.tagName;
                    const conditionNodes = categoryNode.querySelectorAll('*[NAME]:not(:has(*[NAME]))');

                    conditionNodes.forEach(conditionNode => {
                        if (conditionNode.tagName.toUpperCase() === 'P') return;

                        const path = generatePath(conditionNode, categoryNode);
                        if (path) {
                            const conditionName = conditionNode.getAttribute('NAME');
                            
                            // 💡 [핵심 3] 쿼리셀렉터 대신, 정규화된 이름으로 사물함(detailMap)에서 바로 꺼내오기!
                            let detail = detailMap.get(normalizeKey(conditionName));
                            
                            // (보너스) 여기서도 못 찾으면 진짜 데이터가 없는 겁니다.
                            if (!detail) {
                                // console.warn(`다른 증권사 누락 데이터: [${conditionName}]`);
                                detail = ''; 
                            }
                            


                            // let finalPath = path;
                            // let finalType = '해외조건';

                            conditions.push({
                                // type: finalType, // 💡 원래 type 대신 finalType
                                path: path, // 💡 원래 path 대신 잘려나간 finalPath
                                detail: detail,
                                broker: selectedBroker,
                            });
                        }
                    });
                });
                setAllConditions(conditions);
            } 
        } else if (Array.isArray(fileInfo) && fileInfo.length > 0) {
            const firstFilePath = fileInfo[0];
            const folderPath = firstFilePath.substring(0, firstFilePath.lastIndexOf('/'));
            const treecommonUrl = `${process.env.PUBLIC_URL}${folderPath}/treecommon.xml`;
            const mapUrls = fileInfo.filter(file => !file.includes('treecommon.xml')).map(file => `${process.env.PUBLIC_URL}${file}`);
            const urls = [treecommonUrl, ...mapUrls];
            
            const responses = await Promise.all(urls.map(url => fetch(url)));
            const xmlStrings = await Promise.all(responses.map(async (res) => {
                if (!res.ok) throw new Error(`${res.url} 파일 로드 실패`);
                const buffer = await res.arrayBuffer();
                const decoder = new TextDecoder('euc-kr');
                return decoder.decode(buffer);
            }));

            // 💡 [핵심 1] 궁극의 정규화 함수
            const normalizeKey = (str) => {
                if (!str) return '';
                return str
        .replace(/stochastics/g, 'stochastic') // 2. stochastics는 무조건 stochastic으로! (s 제거)
        .replace(/bands/g, 'band')             // 3. bands는 무조건 band로! (s 제거)
        .replace(/[\s\-_/()\[\]%&,]/g, '')      // 4. 띄어쓰기 및 온갖 특수기호 싹 무시
        .replace(/[율률]/g, '');       // 3. 영어는 소문자로 통일        // 소문자 통일
            };

            const treecommonXml = parseXml(xmlStrings[0]);
            const mapXmls = xmlStrings.slice(1).map(s => parseXml(s));        
            
            // 💡 [핵심 2] Map(사물함) 만들어서 정규화된 이름으로 데이터 쟁여두기!
            const detailMap = new Map();
            for (const mapXml of mapXmls) {
                if (!mapXml) continue;
                mapXml.querySelectorAll('*[MAP_NAME]').forEach(node => {
                    const detailData = fillTemplate(node);
                    const mapName = node.getAttribute('MAP_NAME');
                    const completeIndexName = node.getAttribute('COMPLETE_INDEX_NAME');

                    // 투망 던지기 (둘 중 하나라도 걸려라!)
                    if (mapName) {
                        detailMap.set(normalizeKey(mapName), detailData);
                    }
                    if (completeIndexName) {
                        detailMap.set(normalizeKey(completeIndexName), detailData);
                    }
                });
            }

            const conditions = [];

            if (treecommonXml) {
                const topCategories = Array.from(treecommonXml.documentElement.children);
                
                topCategories.forEach(categoryNode => {
                    const type = categoryNode.tagName;
                    const conditionNodes = categoryNode.querySelectorAll('*[NAME]:not(:has(*[NAME]))');

                    conditionNodes.forEach(conditionNode => {
                        if (conditionNode.tagName.toUpperCase() === 'P') return;

                        const path = generatePath(conditionNode, categoryNode);
                        if (path) {
                            const conditionName = conditionNode.getAttribute('NAME');
                            
                            // 💡 [핵심 3] 쿼리셀렉터 대신, 정규화된 이름으로 사물함(detailMap)에서 바로 꺼내오기!
                            let detail = detailMap.get(normalizeKey(conditionName));
                            
                            // (보너스) 여기서도 못 찾으면 진짜 데이터가 없는 겁니다.
                            if (!detail) {
                                // console.warn(`다른 증권사 누락 데이터: [${conditionName}]`);
                                detail = ''; 
                            }

                            conditions.push({
                                type: type,
                                path: path,
                                detail: detail,
                                broker: selectedBroker,
                            });
                        }
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