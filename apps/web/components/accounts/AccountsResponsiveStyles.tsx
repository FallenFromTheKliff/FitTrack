"use client";

export default function AccountsResponsiveStyles() {
  return (
    <style>{`
      @keyframes members-create-in {
        0% {
          opacity: 0;
          transform: translateY(12px);
        }

        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .members-create-shell {
        animation: members-create-in 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      @media (prefers-reduced-motion: reduce) {
        .members-create-shell {
          animation: none !important;
        }
      }

      @media (max-width: 1259px) {
        .members-directory-stage {
          grid-template-columns: 1fr !important;
          height: auto !important;
          min-height: 0 !important;
        }

        .members-directory-inspector {
          display: none !important;
        }
      }

      @media (max-width: 860px) {
        .members-directory-toolbar {
          align-items: stretch !important;
          flex-wrap: wrap !important;
        }

        .members-directory-search {
          flex-basis: auto !important;
          width: 100% !important;
          min-width: 0 !important;
          max-width: none !important;
        }

        .members-toolbar-filters,
        .members-toolbar-status-filter {
          width: 100% !important;
        }

        .members-directory-toolbar-left,
        .members-directory-toolbar-right {
          width: 100% !important;
          justify-content: flex-start !important;
        }

        .members-directory-toolbar-left {
          display: grid !important;
          grid-template-columns: minmax(188px, 1fr);
          align-items: center !important;
          gap: 8px !important;
        }

        .members-grid {
          grid-template-columns: 1fr !important;
        }

        .members-kpis {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 10px !important;
        }

        .members-kpis .fit-kpi-card {
          padding: 10px 12px !important;
          min-height: 72px !important;
        }
      }

      @media (max-width: 560px) {
        .members-directory-toolbar {
          gap: 8px !important;
        }

        .members-directory-toolbar-left {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto !important;
        }

        .members-directory-toolbar-right {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 8px !important;
        }

        .members-toolbar-filters,
        .members-toolbar-status-filter {
          grid-column: 1 / -1 !important;
        }

        .members-directory-toolbar-right > button {
          width: 100% !important;
        }
      }

      @media (max-width: 640px) {
        .members-shell {
          gap: 14px !important;
        }

        .members-shell-create {
          gap: 0 !important;
        }

        .members-mobile-meta-grid {
          grid-template-columns: 1fr !important;
        }
      }
    `}</style>
  );
}
