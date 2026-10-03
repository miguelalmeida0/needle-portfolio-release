import { React } from '../react.js';
import { Icon } from '../icons.js';
import { useAppState } from '../../app/app.context.js';
export function FeedbackToast() {
    const state = useAppState();
    if (!state.feedbackMessage)
        return null;
    return (React.createElement("div", { className: "feedback-toast", role: "status", "aria-live": "polite" },
        React.createElement(Icon, { name: "check", size: 14 }),
        React.createElement("span", null, state.feedbackMessage)));
}
//# sourceMappingURL=FeedbackToast.js.map