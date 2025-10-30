// src/util/generateMent.js

export const generateMent = ({
  ment,
  selectedConditions = [],
  fixedMentMap = {},
  selectedBroker = '',
  fixedType = '',
  typeOverride = null,
}) => {
  const header =
    "안녕하십니까 전략Q&A담당자입니다.\n" +
    "먼저 전략Q&A게시판을 이용해주시는 고객님께 감사인사드립니다.\n\n" +
    "문의하신 내용에 대해 답변드립니다.\n\n";

  const footer = "\n감사합니다.";

  if (selectedConditions.length > 0) {
    let ment = header;
    selectedConditions.forEach((c, i) => {
      // comment가 undefined가 아니라면(빈칸 '' 포함), 그 값을 사용합니다.
      const description = c.comment !== undefined ? c.comment : (c.detail || '');
      
      ment += `${String.fromCharCode(65 + i)} : ${c.type}>${c.path} : ${description}\n`;
    });

    // --- ✨ 이 부분이 핵심 수정 ---
    // '조건식' 라인을 동적으로 생성합니다.
    let closingLine = '\n조건식 ';
    selectedConditions.forEach((c, i) => {
      closingLine += String.fromCharCode(65 + i);
      // 마지막 조건이 아닐 경우에만 연산자를 추가합니다.
      if (i < selectedConditions.length - 1) {
        // c.operator 값 ('and' 또는 'or')을 사용합니다.
        closingLine += ` ${c.operator || 'and'} `; 
      }
    });
    closingLine += ' 입니다.\n';

    ment += closingLine;
    return ment + footer;
  }

  const fixedMent = fixedMentMap[selectedBroker]?.[typeOverride || fixedType];
  if (fixedMent) {
    return header + fixedMent + footer;
  }

  return header + footer;
};