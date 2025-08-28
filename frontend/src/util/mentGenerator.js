// src/utils/mentGenerator.js

export const generateMent = ({
  selectedConditions = [],
  fixedMentMap = {},
  selectedBroker = '',
  fixedType = '',
  typeOverride = null
}) => {
  const header =
    "안녕하십니까 전략Q&A담당자입니다.\n" +
    "먼저 전략Q&A게시판을 이용해주시는 고객님께 감사인사드립니다.\n\n" +
    "문의하신 내용에 대해 답변드립니다.\n\n";

  const footer = "\n감사합니다.";

  if (selectedConditions.length > 0) {
    let ment = header;
    selectedConditions.forEach((c, i) => {
      const description = (c.comment && c.comment.trim() !== '') ? c.comment : (c.detail || '');
      ment += `${String.fromCharCode(65 + i)} : ${c.type}>${c.path} : ${description} \n`;
    });
    ment += `\n조건식 ${selectedConditions.map((_, i) => String.fromCharCode(65 + i)).join(" and ")} 입니다.\n`;
    return ment + footer;
  }

  const fixedMent = fixedMentMap[selectedBroker]?.[typeOverride || fixedType];
  if (fixedMent) {
    return header + fixedMent + footer;
  }

  return header + footer;
};