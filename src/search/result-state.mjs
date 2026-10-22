export function textResult(state) {
  const result = state.resultMode === 'truth' && state.exact ? state.exact : state.approximate;
  return state.activeQuery && result?.relevance?.version === 'catalogue-v2' ? result : null;
}
