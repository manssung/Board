import { useState, useEffect } from 'react';
import brokerMap from '../data/brokerMap.js';

// XML 파싱 함수
const parseXml = (xmlString) => {
  const parser = new DOMParser();
  // 일부 미래에셋 map XML은 XML 선언 앞에 공백/개행이 포함되어 있습니다.
  // XML 선언은 문서의 첫 문자여야 하므로, 선언 앞의 문자만 제거한 뒤 파싱합니다.
  const normalizedXmlString = xmlString.replace(/^\uFEFF?\s*(?=<\?xml\b)/i, '');
  const xmlDoc = parser.parseFromString(normalizedXmlString, "application/xml");
  const errorNode = xmlDoc.querySelector('parsererror');
  if (errorNode) {
    console.error("XML 파싱 오류:", errorNode.textContent);
    return null;
  }
  return xmlDoc;
};

///미래에셋용 path 생성 함수는 아래 generatePath와 완전히 동일했던 중복 코드라 제거했습니다.
// (기존에 generateMiraePath(conditionNode)로 categoryNode 없이 호출되면서
//  경로가 문서 최상단까지 올라가 버리는 버그가 있었습니다 — generatePath로 통일합니다.)

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

// ✨ 조건 노드 자신 또는 조상 노드에 있는 FILE_NAME 속성을 찾는다.
// (일부 조건은 자기 자신이 아니라 상위 카테고리 노드에 FILE_NAME이 붙어있는 경우가 있어 대비)
const findFileNameAttr = (node) => {
    let current = node;
    while (current && current.getAttribute) {
        const value = current.getAttribute('FILE_NAME');
        if (value) return value;
        current = current.parentElement;
    }
    return null;
};

// ✨ 증권사 3종(미래에셋 국내/해외/공통)이 각자 따로 정의하고 있던 정규화 함수를 하나로 통일.
// 기존엔 미래에셋(국내)만 .toLowerCase()가 있고 나머지엔 없어서, 대소문자 차이로
// detail 매칭이 실패할 수 있었던 부분을 함께 고쳤습니다.
const normalizeKey = (str) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/stochastics/g, 'stochastic')
        .replace(/bands/g, 'band')
        .replace(/[\s\-_/()\[\]%&,]/g, '')
        .replace(/[율률]/g, '');
};

// map.xml의 템플릿과 값으로 상세 설명을 생성하는 함수
const fillTemplate = (templateNode) => {
    if (!templateNode) return '';
    let template = templateNode.getAttribute('COMPLETE_INDEX_NAME') || 
                   templateNode.getAttribute('COMPLETE_INDEX_NAME2') || 
                   templateNode.getAttribute('MAP_NAME') || '';
    
    if (!template) return '';           

    template = template.replace(/\(STERM\)봉전기준/g, '');
    template = template.replace(/\(ETERM\)봉이내/g, '');
    template = template.replace(/\(SCNT1\)~\(SCNT2\)회 발생/g, '');

    // const controls = Array.from(templateNode.querySelectorAll('CONTROL'));
    const controls = Array.from(templateNode.querySelectorAll('CONTROL, PARAM, ITEM, SUB_ITEM'));
    const placeholders = template.match(/\(([^)]+)\)/g) || [];
    placeholders.forEach(placeholder => {
        const packetId = placeholder.substring(1, placeholder.length - 1);
        const control = controls.find(c => 
            c.getAttribute('PACKET_ID') === packetId ||
            c.getAttribute('NAME') === packetId ||
            c.getAttribute('ID') === packetId ||
            c.getAttribute('PARAM_NAME') === packetId
        );
        if (control) {
            let value = control.getAttribute('DEFAULT_VALUE') || 
                        control.getAttribute('DEFAULT') || 
                        control.getAttribute('VALUE') || 
                        control.getAttribute('TEXT') || '';

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

// FILE_NAME + tag matching prevents identically named conditions in separate
// map files from overwriting each other in the text-only fallback map.
const buildDetailMap = (mapUrls, mapXmls) => {
    const detailMap = new Map();
    const ambiguousTags = new Set();

    mapXmls.forEach((mapXml, index) => {
        if (!mapXml) return;

        const mapUrl = mapUrls[index];
        const fileName = mapUrl.substring(mapUrl.lastIndexOf('/') + 1).replace(/\.xml$/i, '');
        const fileKey = fileName.replace(/^map/i, '').toUpperCase();

        mapXml.querySelectorAll('*[MAP_NAME]').forEach(node => {
            const detail = fillTemplate(node);
            const tagKey = node.tagName;
            const mapName = node.getAttribute('MAP_NAME');
            const completeIndexName = node.getAttribute('COMPLETE_INDEX_NAME');

            detailMap.set(`${fileKey}::${tagKey}`, detail);

            if (!ambiguousTags.has(tagKey)) {
                if (!detailMap.has(`TAG:${tagKey}`)) {
                    detailMap.set(`TAG:${tagKey}`, detail);
                } else if (detailMap.get(`TAG:${tagKey}`) !== detail) {
                    detailMap.delete(`TAG:${tagKey}`);
                    ambiguousTags.add(tagKey);
                }
            }

            if (mapName) detailMap.set(normalizeKey(mapName), detail);
            if (completeIndexName) detailMap.set(normalizeKey(completeIndexName), detail);
        });
    });

    return detailMap;
};

const findDetail = (detailMap, conditionNode, conditionName) => {
    const fileName = findFileNameAttr(conditionNode);
    let detail = fileName
        ? detailMap.get(`${fileName.toUpperCase()}::${conditionNode.tagName}`)
        : undefined;

    if (detail === undefined) detail = detailMap.get(`TAG:${conditionNode.tagName}`);
    if (detail === undefined) detail = detailMap.get(normalizeKey(conditionName));

    return detail ?? '';
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
            // ✨ 서로 다른 파일에서 같은 태그 이름이 다른 내용으로 중복 정의된 경우를 추적.
            // (예: mapc2_1-19.xml의 C2_1 "이평간 돌파" vs mapex.xml의 C2_1 "기관 순매수")
            // 이런 태그는 "태그 단독" 폴백에 쓰면 위험하므로 아예 제외시킵니다.
            const ambiguousTags = new Set();
            const mapXmlStrings = xmlStrings.slice(treeUrls.length); 
            for (let i = 0; i < mapXmlStrings.length; i++) {
                const xmlString = mapXmlStrings[i];
                const mapUrl = mapUrls[i];
                const mapXml = parseXml(xmlString);
                if (!mapXml) continue;

                // ✨ [핵심] URL에서 파일키를 추출 (예: '.../mapc2_1-19.xml' → 'C2_1-19')
                // treecommon 쪽 조건 노드의 FILE_NAME 속성과 1:1 대응시키기 위함.
                // 이렇게 파일 단위로 스코프를 나눠야, 서로 다른 카테고리에서 같은 태그 이름(C2_1 등)이
                // 재사용되어도 서로 충돌하지 않습니다.
                const fileNameOnly = mapUrl.substring(mapUrl.lastIndexOf('/') + 1).replace(/\.xml$/i, '');
                const fileKey = fileNameOnly.replace(/^map/i, '').toUpperCase();
                
                mapXml.querySelectorAll('*[MAP_NAME]').forEach(node => {
                    const mapName = node.getAttribute('MAP_NAME');
                    const completeIndexName = node.getAttribute('COMPLETE_INDEX_NAME');
                    const tagKey = node.tagName;

                    // 알맹이 데이터는 한 번만 만들어 둠
                    const detailData = fillTemplate(node); 

                    // ✨ 1순위 키: 파일키 + 태그이름 조합 → 완전히 고유함 (treecommon의 FILE_NAME 속성과 1:1 대응)
                    detailMap.set(`${fileKey}::${tagKey}`, detailData);

                    // 2순위 키: 태그이름 단독 (FILE_NAME 속성이 없는 예외적인 조건 노드를 위한 대비책)
                    if (ambiguousTags.has(tagKey)) {
                        // 이미 모호하다고 판정된 태그면 손대지 않음 (계속 제외 상태 유지)
                    } else if (!detailMap.has(`TAG:${tagKey}`)) {
                        detailMap.set(`TAG:${tagKey}`, detailData);
                    } else if (detailMap.get(`TAG:${tagKey}`) !== detailData) {
                        // ✨ 같은 태그 이름인데 내용이 다르면 → 서로 다른 파일에서 재사용된 것.
                        // 어느 쪽이 맞는지 알 수 없으니 폴백 후보에서 아예 제거해서
                        // "틀린 값이 붙는" 것보다 "빈 값 + 경고"가 나오도록 함.
                        detailMap.delete(`TAG:${tagKey}`);
                        ambiguousTags.add(tagKey);
                    }

                    // 3순위: 텍스트 매칭 (기존 방식, 최후의 fallback)
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

                        // ✨ FIX: 미래에셋(국내)은 트리 파일 자체가 대분류(type) 단위로 쪼개져 있어서,
                        // categoryNode(예: '캔들연속')가 실제로는 하나의 '카테고리' 역할을 합니다.
                        // 경계를 categoryNode로 잡으면 categoryNode 자신의 이름이 path에서 통째로 빠지므로,
                        // 파일 루트(treecommonXml.documentElement)를 경계로 잡아 categoryNode 이름부터 포함시킵니다.
                        const path = generatePath(conditionNode, treecommonXml.documentElement);
                        if (path) {
                            const conditionName = conditionNode.getAttribute('NAME'); // ✨ FIX: 셀렉터 문자열이 아니라 'NAME' 속성을 읽어야 함
                            const tagKey = conditionNode.tagName;
                            const fileNameAttr = findFileNameAttr(conditionNode); // 예: "C2_1-19"

                            // ✨ 1순위: 파일키 + 태그이름 조합으로 매칭 (같은 태그이름이 다른 카테고리에서
                            // 재사용되어도 절대 충돌하지 않는, 가장 정확한 매칭 방식)
                            // let detail = fileNameAttr
                            //     ? detailMap.get(`${fileNameAttr.toUpperCase()}::${tagKey}`)
                            //     : undefined;

                            // // 2순위: 파일키 매칭 실패 시 태그 이름 단독으로 재시도 (여러 파일에서 같은 태그가
                            // // 서로 다른 내용으로 중복 정의된 경우는 위에서 이미 제외돼 있어 안전함)
                            // if (!detail) {
                            //     detail = detailMap.get(`TAG:${tagKey}`);
                            //     if (detail) {
                            //         console.warn(`⚠️ 파일키 매칭 실패 → 태그 단독으로 대체: [${conditionName}] (태그: ${tagKey}, FILE_NAME: ${fileNameAttr})`);
                            //     }
                            // }

                            // // 3순위: 기존 방식(정규화된 텍스트)으로 재시도
                            // if (!detail) {
                            //     detail = detailMap.get(normalizeKey(conditionName));
                            //     if (detail) {
                            //         console.warn(`⚠️ 태그 매칭도 실패 → 텍스트 매칭으로 대체: [${conditionName}] (태그: ${tagKey})`);
                            //     }
                            // }

                            // // (보너스) 디버깅용: 그래도 못 찾는 건 진짜 데이터가 없는 놈!
                            // if (!detail) {
                            //     console.warn(`진짜 데이터 누락됨: [${conditionName}] (태그: ${tagKey}, 파일: ${fileNameAttr})`);
                            //     detail = ''; // 나중에 UI에서 placeholder로 처리하기 위해 빈칸으로 넘김
                            // }

                            let detail = fileNameAttr
                            ? detailMap.get(`${fileNameAttr.toUpperCase()}::${tagKey}`)
                            : undefined;

                        // 💡 수정됨: !detail 대신 명시적으로 undefined인지 체크합니다. (빈 문자열 ""은 유효한 데이터로 인정)
                        // 2순위: 파일키 매칭 실패 시 태그 이름 단독으로 재시도
                        if (detail === undefined) {
                            detail = detailMap.get(`TAG:${tagKey}`);
                            if (detail !== undefined) {
                                console.warn(`⚠️ 파일키 매칭 실패 → 태그 단독으로 대체: [${conditionName}] (태그: ${tagKey}, FILE_NAME: ${fileNameAttr})`);
                            }
                        }

                        // 3순위: 기존 방식(정규화된 텍스트)으로 재시도
                        if (detail === undefined) {
                            detail = detailMap.get(normalizeKey(conditionName));
                            if (detail !== undefined) {
                                console.warn(`⚠️ 태그 매칭도 실패 → 텍스트 매칭으로 대체: [${conditionName}] (태그: ${tagKey})`);
                            }
                        }

                        // (보너스) 디버깅용: 그래도 못 찾는 건 진짜 데이터가 없는 놈!
                        if (detail === undefined) {
                            console.warn(`진짜 데이터 누락됨: [${conditionName}] (태그: ${tagKey}, 파일: ${fileNameAttr})`);
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

            const treecommonXml = parseXml(xmlStrings[0]);
            const mapXmls = xmlStrings.slice(1).map(s => parseXml(s));
            const exactDetailMap = buildDetailMap(mapUrls, mapXmls);
            
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
                            let detail = findDetail(exactDetailMap, conditionNode, conditionName);
                            
                            // (보너스) 여기서도 못 찾으면 진짜 데이터가 없는 겁니다.
                            if (!detail) {
                                // console.warn(`다른 증권사 누락 데이터: [${conditionName}]`);
                                detail = ''; 
                            }
                            
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

            const treecommonXml = parseXml(xmlStrings[0]);
            const mapXmls = xmlStrings.slice(1).map(s => parseXml(s));
            const exactDetailMap = buildDetailMap(mapUrls, mapXmls);
            
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
                            let detail = findDetail(exactDetailMap, conditionNode, conditionName);
                            
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
