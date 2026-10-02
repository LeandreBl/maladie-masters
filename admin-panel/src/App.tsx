import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth-context";
import { LocaleProvider } from "./i18n";
import { RealtimeProvider } from "./realtime-context";
import { PanelRoutes } from "./routes/PanelRoutes";
import { ThemeProvider } from "./theme-context";
import { ToastProvider } from "./toast-context";

/**
 * Provider order matters: toasts translate their messages, and the auth
 * provider reports failures through a toast — so locale wraps toasts, and
 * toasts wrap auth.
 */
export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <ToastProvider>
          <AuthProvider>
            <RealtimeProvider>
              <BrowserRouter>
                <PanelRoutes />
              </BrowserRouter>
            </RealtimeProvider>
          </AuthProvider>
        </ToastProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
