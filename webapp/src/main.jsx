import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import "./fonts";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/reading.css";
import "./styles/pages.css";
import { persistor, store } from "./state/store";
import { whenGita } from "./data/gita";
import App from "./App";

if (window.gitaDesktop) document.documentElement.classList.add("is-app");
if (window.gitaDesktop?.platform === "darwin") document.documentElement.classList.add("is-mac-app");
whenGita(); // start opening the database right away

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PersistGate>
    </Provider>
  </StrictMode>
);
