import {
  addCondition,
  getConditionIndex,
  getConditionLabel,
  groupOrConditions,
  moveConditionAndClearGroups,
  parseMentForComments,
  removeConditionAndClearGroups,
  toggleConditionOperator,
  updateConditionComment,
} from './conditionEditor';

const condition = (path, operator = 'and', groupIds = []) => ({ path, detail: `${path} 상세값`, operator, groupIds });

describe('condition editor rules', () => {
  test('uses lowercase labels after Z', () => {
    expect(getConditionLabel(25)).toBe('Z');
    expect(getConditionLabel(26)).toBe('a');
    expect(getConditionLabel(51)).toBe('z');
    expect(getConditionIndex('a')).toBe(26);
  });

  test('adds a condition with the default AND operator and no group', () => {
    const result = addCondition([], condition('거래량'));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ path: '거래량', operator: 'and', groupIds: [] });
  });

  test('updates only the selected condition comment', () => {
    const result = updateConditionComment([condition('거래량'), condition('시가총액')], 1, '1,000억원 이상');

    expect(result[0].comment).toBeUndefined();
    expect(result[1].comment).toBe('1,000억원 이상');
  });

  test('toggles an operator between AND and OR', () => {
    const firstToggle = toggleConditionOperator([condition('거래량')], 0);
    const secondToggle = toggleConditionOperator(firstToggle, 0);

    expect(firstToggle[0].operator).toBe('or');
    expect(secondToggle[0].operator).toBe('and');
  });

  test('moves a condition and clears every existing group', () => {
    const result = moveConditionAndClearGroups([
      condition('A', 'and', ['group-1']),
      condition('B', 'or', ['group-1']),
    ], 0, 'down');

    expect(result.map(item => item.path)).toEqual(['B', 'A']);
    expect(result.every(item => item.groupIds.length === 0)).toBe(true);
    expect(result.every(item => item.operator === 'and')).toBe(true);
  });

  test('removes a condition and clears groups from remaining conditions', () => {
    const result = removeConditionAndClearGroups([
      condition('A', 'and', ['group-1']),
      condition('B', 'or', ['group-1']),
    ], 0);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ path: 'B', groupIds: [] });
    expect(result[0].operator).toBe('and');
  });

  test('groups a consecutive AI OR recommendation', () => {
    const result = groupOrConditions([
      condition('A', 'and'),
      condition('B', 'or'),
      condition('C', 'and'),
    ]);

    expect(result[0].groupIds).toEqual([]);
    expect(result[1].groupIds).toHaveLength(1);
    expect(result[1].groupIds).toEqual(result[2].groupIds);
  });

  test('keeps two AI OR conditions ungrouped', () => {
    const result = groupOrConditions([condition('A', 'or'), condition('B', 'and')]);

    expect(result.every(item => item.groupIds.length === 0)).toBe(true);
  });

  test('maps edited answer lines back to their condition comments', () => {
    const result = parseMentForComments(
      'A : 거래량 : 10만주 이상\nB : 시가총액 : 1,000억원 이상',
      [condition('거래량'), condition('시가총액')],
    );

    expect(result[0].comment).toBe('10만주 이상');
    expect(result[1].comment).toBe('1,000억원 이상');
  });
});
