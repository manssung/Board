export const groupOrConditions = (conditions) => {
  const groupedConditions = conditions.map(condition => ({ ...condition, groupIds: [] }));
  if (groupedConditions.length < 3) return groupedConditions;

  let index = 0;
  while (index < groupedConditions.length - 1) {
    if (groupedConditions[index].operator !== 'or') {
      index += 1;
      continue;
    }

    const groupStart = index;
    while (index < groupedConditions.length - 1 && groupedConditions[index].operator === 'or') index += 1;

    const groupId = `ai-or-${Date.now()}-${groupStart}`;
    for (let memberIndex = groupStart; memberIndex <= index; memberIndex += 1) {
      groupedConditions[memberIndex].groupIds = [groupId];
    }
  }
  return groupedConditions;
};

export const getConditionLabel = (index) => {
  if (index < 26) return String.fromCharCode('A'.charCodeAt(0) + index);
  if (index < 52) return String.fromCharCode('a'.charCodeAt(0) + index - 26);
  return String(index + 1);
};

export const getConditionIndex = (label) => {
  if (/^[A-Z]$/.test(label)) return label.charCodeAt(0) - 'A'.charCodeAt(0);
  if (/^[a-z]$/.test(label)) return label.charCodeAt(0) - 'a'.charCodeAt(0) + 26;
  return -1;
};

export const addCondition = (conditions, condition) => [
  ...conditions,
  { ...condition, comment: undefined, operator: 'and', groupIds: [] },
];

export const updateConditionComment = (conditions, index, comment) => (
  conditions.map((condition, conditionIndex) => (
    conditionIndex === index ? { ...condition, comment } : condition
  ))
);

export const toggleConditionOperator = (conditions, index) => (
  conditions.map((condition, conditionIndex) => (
    conditionIndex === index
      ? { ...condition, operator: condition.operator === 'and' ? 'or' : 'and' }
      : condition
  ))
);

export const moveConditionPreservingGroups = (conditions, index, direction) => {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= conditions.length) return conditions;

  const updated = [...conditions];
  [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
  return retainValidGroups(updated);
};

// Keep only groups that still contain at least two consecutive conditions.
const retainValidGroups = conditions => {
  const members = new Map();
  conditions.forEach((condition,index)=>(condition.groupIds||[]).forEach(id=>{
    const indices=members.get(id)||[];indices.push(index);members.set(id,indices);
  }));
  const valid = new Set([...members].filter(([,indices])=>indices.length>=2 && indices.at(-1)-indices[0]+1===indices.length).map(([id])=>id));
  return conditions.map(condition=>({...condition,groupIds:(condition.groupIds||[]).filter(id=>valid.has(id))}));
};
export const removeConditionPreservingGroups = (conditions,index) => {
  if(index<0 || index>=conditions.length)return conditions;
  return retainValidGroups(conditions.filter((_,conditionIndex)=>conditionIndex!==index));
};
// Compatibility for older imports; these operations no longer clear unrelated groups.
export const moveConditionAndClearGroups = moveConditionPreservingGroups;
export const removeConditionAndClearGroups = removeConditionPreservingGroups;

export const parseMentForComments = (text, conditions) => {
  const updatedConditions = conditions.map(condition => ({ ...condition }));

  text.split('\n').forEach((line) => {
    const match = line.match(/^([A-Za-z])\s*:\s*(.*)/);
    if (!match) return;

    const index = getConditionIndex(match[1]);
    if (index < 0 || index >= updatedConditions.length) return;

    const parts = match[2].split(' : ');
    updatedConditions[index].comment = (parts.length > 1 ? parts.slice(1).join(' : ') : '').trim();
  });

  return updatedConditions;
};
