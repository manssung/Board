// Compatibility exports for existing consumers; all brokers share the parser.
const parser=require('./conditionInputParser');
module.exports={buildKBInputSchema:parser.buildInputSchema,buildKBDetail:parser.buildConditionDetail,readKBValues:parser.readConditionValues,splitKBTemplate:parser.splitConditionTemplate};
