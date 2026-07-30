import type { Preview } from "@storybook/nextjs-vite";

import { ThemeProvider } from "../contexts/ThemeContext";
import "../app/globals.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div
          style={{
            minHeight: "100vh",
            minWidth: "100%",
            padding: 32,
            color: "var(--fit-text-primary)",
            background: "var(--fit-surface)",
          }}
        >
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
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
