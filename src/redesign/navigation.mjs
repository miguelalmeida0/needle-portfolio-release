// Presentation history never changes the search runtime or saved recipes.
export function createNavigation(history, location) {
  const initial = { view: "home", overlay: null, depth: 0 };
  let current = history.state?.needleDesign ?? initial;
  history.replaceState({ ...history.state, needleDesign: current }, "");
  return {
    current: () => current,
    visit(changes, replace = false) {
      const next = {
        ...current,
        ...changes,
        backView: replace ? current.backView : current.view,
        depth: current.depth + (replace ? 0 : 1),
      };
      if (
        next.view === current.view &&
        next.overlay === current.overlay &&
        next.artworkId === current.artworkId
      )
        return current;
      current = next;
      history[replace ? "replaceState" : "pushState"](
        { needleDesign: current },
        "",
        `${location.pathname}${location.search}#${current.view}`,
      );
      return current;
    },
    restore(state) {
      current = state?.needleDesign ?? initial;
      return current;
    },
    back() {
      if (current.depth > 0) history.back();
      else return this.visit({ view: "home", overlay: null }, true);
    },
  };
}

export function backLabel(route) {
  const names = {
    home: "search",
    results: "results",
    map: "map",
    advanced: "semantic map",
  };
  return (
    names[route.backView] ?? (route.view === "results" ? "search" : "results")
  );
}

// The Composer owns submission; this only identifies the matching view change.
export function isSearchSubmission(event, draft, composing = false) {
  if (!draft.trim()) return false;
  if (event.type === "click") {
    const submit = event.target.closest(".search-composer__submit");
    return Boolean(submit && !submit.disabled);
  }
  return (
    event.type === "keydown" &&
    event.key === "Enter" &&
    event.target.tagName === "INPUT" &&
    !composing &&
    !event.isComposing &&
    !event.nativeEvent?.isComposing
  );
}
