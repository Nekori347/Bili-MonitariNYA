import ReactDOM from "react-dom/client";
import App from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
