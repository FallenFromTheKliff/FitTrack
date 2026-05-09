"use client";

import type { KeyboardEvent, ReactNode } from "react";

import type { MemberRecord } from "@fittrack/types";

import FitButton from "@/components/fit/FitButton";
import { FitPagination, FitText } from "@/components/fit";
import type { FitTableAction, FitTableColumn } from "@/components/fit/FitTable";
import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  activeRowId?: string;
  actionsHeading?: string;
  emptyMessage?: string;
  filteredCount: number;
  footerNote?: string;
  isAdmin: boolean;
  onPageChange: (page: number) => void;
  onRowClick: (member: MemberRecord) => void;
  page: number;
  pageSize: number;
  pageLoading: boolean;
  renderGridCard?: (member: MemberRecord) => ReactNode;
  renderMobileCard?: (member: MemberRecord) => ReactNode;
  rows: MemberRecord[];
  tableActions?: FitTableAction<MemberRecord>[];
  tableColumns: FitTableColumn<MemberRecord>[];
  toolbar?: ReactNode;
  totalPages: number;
  viewMode: "list" | "grid";
};

function getGridTemplate(hasActions: boolean) {
  return hasActions
    ? "minmax(0, 2.35fr) minmax(104px, 0.82fr) minmax(100px, 0.76fr) minmax(112px, 0.78fr) minmax(128px, 0.9fr) auto"
    : "minmax(0, 2.35fr) minmax(104px, 0.82fr) minmax(100px, 0.76fr) minmax(112px, 0.78fr) minmax(128px, 0.9fr)";
}

export default function MembersDirectoryPanel({
  activeRowId,
  actionsHeading,
  emptyMessage = "No accounts match your current filters.",
  filteredCount,
  footerNote,
  isAdmin,
  onPageChange,
  onRowClick,
  page,
  pageSize,
  pageLoading,
  renderGridCard,
  renderMobileCard,
  rows,
  tableActions,
  tableColumns,
  toolbar,
  totalPages,
  viewMode,
}: Props) {
  const { colors } = useTheme();
  const pageStart = filteredCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = filteredCount === 0 ? 0 : Math.min(filteredCount, page * pageSize);
  const hasActions = Boolean(tableActions?.length);
  const gridTemplateColumns = getGridTemplate(hasActions);

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, member: MemberRecord) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onRowClick(member);
  };

  return (
    <section
      className="members-directory-panel"
      data-members-directory-panel
      style={{
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        gap: 0,
        height: "100%",
        minHeight: 0,
        padding: 0,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: `${colors.surface}f2`,
        boxShadow: "none",
        overflow: "hidden",
      }}
    >
      {toolbar ? (
        <div
          className="members-directory-panel__top"
          style={{
            padding: "14px 12px",
            borderRadius: 0,
            border: "none",
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: `${colors.surfaceRaised}f5`,
          }}
        >
          <div className="members-directory-panel__toolbar">{toolbar}</div>
        </div>
      ) : null}

      <div
        className="members-directory-panel__middle"
        style={{
          display: "grid",
          minHeight: 0,
          padding: 10,
          borderRadius: 0,
          border: "none",
          background: colors.surface,
        }}
      >
        <div
          className="members-directory-panel__desktop"
          style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", minHeight: 0 }}
        >
          {pageLoading ? (
            <div
              key="loading"
              className="members-directory-panel__view-enter"
              style={{
                padding: 18,
            borderRadius: 0,
            border: `1px solid ${colors.border}`,
            backgroundColor: `${colors.surface}e8`,
              }}
            >
              <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
                {isAdmin ? "Loading accounts..." : "Loading staff directory..."}
              </FitText>
            </div>
          ) : rows.length > 0 && viewMode === "grid" ? (
            <div key="grid" className="members-directory-panel__grid members-directory-panel__view-enter">
              {rows.map((member) => {
                const card = renderGridCard?.(member) ?? renderMobileCard?.(member);
                if (!card) return null;
                return (
                  <div
                    key={member.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={member.id === activeRowId}
                    className={
                      member.id === activeRowId
                        ? "members-directory-panel__grid-card members-directory-panel__grid-card-active"
                        : "members-directory-panel__grid-card"
                    }
                    onClick={() => onRowClick(member)}
                    onKeyDown={(event) => handleRowKeyDown(event, member)}
                  >
                    {card}
                  </div>
                );
              })}
            </div>
          ) : rows.length > 0 ? (
            <div
              key="list"
              className="members-directory-panel__list members-directory-panel__view-enter"
              style={{
                display: "grid",
                gridTemplateRows: "auto minmax(0, 1fr)",
                minHeight: 0,
              }}
            >
            <div
              className="members-directory-panel__table-head"
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns,
                padding: "7px 12px 8px",
                backgroundColor: `${colors.surfaceRaised}bd`,
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              {tableColumns.map((column) => {
                const isStatusColumn = column.key === "status";

                return (
                <FitText
                  key={column.key}
                  data-status-header={isStatusColumn ? "true" : undefined}
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: colors.textMuted,
                    letterSpacing: "0.05em",
                    justifySelf: isStatusColumn ? "center" : undefined,
                    textAlign: isStatusColumn ? "center" : undefined,
                  }}
                >
                  {column.heading}
                </FitText>
                );
              })}
              {hasActions ? (
                <FitText
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: colors.textMuted,
                    letterSpacing: "0.05em",
                    textAlign: "right",
                  }}
                >
                  {actionsHeading ?? "Actions"}
                </FitText>
              ) : null}
            </div>
            <div
              className="members-directory-panel__rows"
              style={{ display: "grid", gap: 0, alignContent: "start", minHeight: 0 }}
            >
              {rows.map((member, index) => {
                const isActive = member.id === activeRowId;

                return (
                  <div
                    key={member.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    className={isActive ? "members-directory-panel__row members-directory-panel__row-active" : "members-directory-panel__row"}
                    data-row-index={index + 1}
                    onClick={() => onRowClick(member)}
                    onKeyDown={(event) => handleRowKeyDown(event, member)}
                    style={{
                      display: "grid",
                      gap: 12,
                      gridTemplateColumns,
                      alignItems: "center",
                      minHeight: 44,
                      padding: "7px 12px",
                      borderRadius: 0,
                      border: "none",
                      borderBottom: `1px solid ${colors.border}`,
                      backgroundColor: isActive ? `${colors.brand}12` : "transparent",
                      boxShadow: isActive ? `3px 0 0 ${colors.brand} inset` : "none",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {tableColumns.map((column) => {
                      const isStatusColumn = column.key === "status";

                      return (
                      <div
                        key={column.key}
                        className="members-directory-panel__cell"
                        data-member-status-cell={isStatusColumn ? "true" : undefined}
                        style={{
                          justifySelf: isStatusColumn ? "center" : undefined,
                          textAlign: isStatusColumn ? "center" : undefined,
                        }}
                      >
                        {column.render(member, colors)}
                      </div>
                      );
                    })}
                    {hasActions ? (
                      <div
                        className="members-directory-panel__actions"
                        style={{ display: "flex", justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}
                      >
                        {tableActions?.map((action) => (
                          <FitButton
                            key={`${member.id}-${action.label}`}
                            variant={action.variant}
                            label={action.iconOnly ? undefined : action.label}
                            icon={action.icon}
                            iconSize={action.iconSize ?? 14}
                            iconOnly={action.iconOnly}
                            disabled={action.disabled?.(member)}
                            onClick={(event) => {
                              event.stopPropagation();
                              action.onClick(member);
                            }}
                            style={action.style}
                            aria-label={action.ariaLabel?.(member)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            key="empty"
            className="members-directory-panel__view-enter"
            style={{
              padding: 18,
              borderRadius: 8,
              border: `1px dashed ${colors.border}`,
              backgroundColor: `${colors.surface}d8`,
            }}
          >
            <FitText style={{ fontSize: 13, lineHeight: 1.6, color: colors.textSecondary }}>
              {emptyMessage}
            </FitText>
          </div>
        )}
      </div>

      <div className="members-directory-panel__mobile" style={{ display: "none", gap: 12 }}>
        {pageLoading ? (
          <div
            style={{
              padding: 18,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              backgroundColor: `${colors.surface}e2`,
            }}
          >
            <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
              {isAdmin ? "Loading accounts..." : "Loading staff directory..."}
            </FitText>
          </div>
        ) : rows.length > 0 && renderMobileCard ? (
          rows.map((member) => (
            <div
              key={member.id}
              role="button"
              tabIndex={0}
              aria-pressed={member.id === activeRowId}
              className={
                member.id === activeRowId
                  ? "members-directory-panel__mobile-card members-directory-panel__mobile-card-active"
                  : "members-directory-panel__mobile-card"
              }
              onClick={() => onRowClick(member)}
              onKeyDown={(event) => handleRowKeyDown(event, member)}
            >
              {renderMobileCard(member)}
            </div>
          ))
        ) : (
          <div
            style={{
              padding: 18,
              borderRadius: 8,
              border: `1px dashed ${colors.border}`,
              backgroundColor: `${colors.surface}d8`,
            }}
          >
            <FitText style={{ fontSize: 13, lineHeight: 1.6, color: colors.textSecondary }}>
              {emptyMessage}
            </FitText>
          </div>
        )}
      </div>
      </div>

      {!pageLoading ? (
        <div
          className="members-directory-panel__bottom"
          style={{
            padding: "10px 12px",
            borderRadius: 0,
            border: "none",
            borderTop: `1px solid ${colors.border}`,
            backgroundColor: `${colors.surfaceRaised}f5`,
          }}
        >
          <div
            className="members-directory-panel__footer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <FitText style={{ fontSize: 11.5, color: colors.textSecondary }}>
              Showing {pageStart} - {pageEnd} of {filteredCount}
            </FitText>
            {footerNote ? (
              <FitText style={{ fontSize: 11, color: colors.textMuted }}>
                {footerNote}
              </FitText>
            ) : null}
          </div>
          <FitPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={onPageChange}
            ariaLabel="Account directory pagination"
            showSinglePage
          />
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes members-directory-view-enter {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .members-directory-panel__view-enter {
          animation: members-directory-view-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .members-directory-panel__row {
          transition: border-color 120ms ease, background-color 120ms ease;
        }

        .members-directory-panel__cell,
        .members-directory-panel__identity,
        .members-directory-panel__identity-copy {
          min-width: 0;
        }

        .members-directory-panel__row:focus-visible {
          border-color: ${colors.brand}2f !important;
          outline: 2px solid ${colors.brand}35;
          outline-offset: 2px;
        }

        .members-directory-panel__row-active .members-directory-panel__primary-text {
          font-weight: 800 !important;
        }

        .members-directory-panel__row-active .members-directory-panel__secondary-text {
          color: ${colors.textPrimary} !important;
          opacity: 0.94;
        }

        .members-directory-panel__grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px 10px;
          align-content: start;
          min-height: 0;
        }

        .members-directory-panel__grid-card,
        .members-directory-panel__mobile-card {
          outline: none;
        }

        .members-directory-panel__grid-card-active > .members-grid-card,
        .members-directory-panel__mobile-card-active > .members-account-card {
          border-color: ${colors.brand}66 !important;
          box-shadow: 0 0 0 1px ${colors.brand}22 inset, 0 16px 30px rgba(0, 0, 0, 0.14) !important;
        }

        .members-directory-panel__actions {
          justify-self: end;
        }

        @media (max-width: 1259px) {
          .members-directory-panel {
            height: auto !important;
            min-height: 0 !important;
          }

          .members-directory-panel__desktop {
            display: none !important;
          }

          .members-directory-panel__middle {
            padding: 10px !important;
          }

          .members-directory-panel__mobile {
            display: grid !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .members-directory-panel__view-enter,
          .members-directory-panel__row,
          .members-directory-panel__identity-avatar,
          .members-directory-panel__primary-text,
          .members-directory-panel__secondary-text,
          .members-directory-panel__emphasis-text {
            transition: none !important;
          }
        }

        @media (max-width: 640px) {
          .members-directory-panel__footer {
            align-items: flex-start !important;
          }
        }
      `}</style>
    </section>
  );
}
