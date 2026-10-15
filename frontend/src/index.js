import React from "react";
import ReactDOM from "react-dom/client";
import StrategyGenerator from "./StrategyGenerator";

import ConditionSettingsPreview from './components/ConditionSettingsPreview';

const root = ReactDOM.createRoot(document.getElementById("root"));
const preview = process.env.NODE_ENV === 'development' && new URLSearchParams(window.location.search).get('preview') === 'condition-settings';
root.render(preview ? <ConditionSettingsPreview /> : <StrategyGenerator />);