import type { Preview } from "@storybook/nextjs-vite";

import { ThemeProvider } from "../contexts/ThemeContext";
import "../app/globals.css";

const DETERMINISTIC_CAPTURE_CSS = `
  [data-fittrack-capture="true"] *,
  [data-fittrack-capture="true"] *::before,
  [data-fittrack-capture="true"] *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }

  [data-fittrack-capture="true"] {
    color-scheme: dark;
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  [data-fittrack-capture="true"] * {
    font-family: inherit !important;
  }
`;

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const captureEnabled = context.parameters.deterministicCapture !== false;

      return (
      <ThemeProvider>
        {captureEnabled ? <style>{DETERMINISTIC_CAPTURE_CSS}</style> : null}
        <div
          data-fittrack-capture={captureEnabled ? "true" : undefined}
          style={{
            minHeight: "100vh",
            minWidth: "100%",
            padding: 32,
            color: "var(--fit-text-primary)",
            background: "var(--fit-surface)",
            fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
          }}
        >
          <Story />
        </div>
      </ThemeProvider>
      );
    },
  ],
  parameters: {
    layout: "fullscreen",
    deterministicCapture: true,
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
  },
};

export default preview;
