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
  badgeLabel?: string;
  emptyMessage?: string;
  filteredCount: number;
  footerNote?: string;
  isAdmin: boolean;
  onPageChange: (page: number) => void;
  onRowClick: (member: MemberRecord) => void;
  page: number;
  pageSize: number;
  pageLoading: boolean;
  renderMobileCard?: (member: MemberRecord) => ReactNode;
  rows: MemberRecord[];
  subtitle?: string;
  tableActions?: FitTableAction<MemberRecord>[];
  tableMotionKey?: string;
  tableColumns: FitTableColumn<MemberRecord>[];
  title: string;
  totalPages: number;
};

function getGridTemplate(hasActions: boolean) {
  return hasActions
    ? "minmax(0, 2.4fr) minmax(140px, 1.05fr) minmax(140px, 1fr) minmax(108px, 0.82fr) auto"
    : "minmax(0, 2.55fr) minmax(148px, 1.08fr) minmax(146px, 1fr) minmax(112px, 0.84fr)";
}

export default function MembersDirectoryPanel({
  activeRowId,
  actionsHeading,
  badgeLabel,
  emptyMessage = "No accounts match your current filters.",
  filteredCount,
  footerNote,
  isAdmin,
  onPageChange,
  onRowClick,
  page,
  pageSize,
  pageLoading,
  renderMobileCard,
  rows,
  subtitle,
  tableActions,
  tableMotionKey,
  tableColumns,
  title,
  totalPages,
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
      style={{
        display: "grid",
        gap: 14,
        padding: 18,
        borderRadius: 26,
        border: `1px solid ${colors.border}`,
        background: `linear-gradient(180deg, ${colors.surfaceRaised} 0%, ${colors.surface} 100%)`,
        boxShadow: "0 16px 30px rgba(0,0,0,0.12)",
      }}
    >
      <div
        className="members-directory-panel__header"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4, maxWidth: 720 }}>
          <FitText style={{ fontSize: 20, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.08 }}>
            {title}
          </FitText>
          {subtitle ? (
            <FitText style={{ fontSize: 11.75, lineHeight: 1.45, color: colors.textSecondary }}>
              {subtitle}
            </FitText>
          ) : null}
        </div>
        {badgeLabel ? (
          <FitText style={{ fontSize: 11.5, fontWeight: 600, color: colors.textSecondary }}>
            {badgeLabel}
          </FitText>
        ) : null}
      </div>

      <div key={tableMotionKey} className="members-directory-panel__desktop members-directory-panel__desktop--animated">
        <div
          className="members-directory-panel__table-head"
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns,
            padding: "0 18px 2px",
          }}
        >
          {tableColumns.map((column) => (
            <FitText
              key={column.key}
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: colors.textMuted,
                letterSpacing: "0.05em",
              }}
            >
              {column.heading}
            </FitText>
          ))}
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

        {pageLoading ? (
          <div
            style={{
              padding: 18,
              borderRadius: 20,
              border: `1px solid ${colors.border}`,
              backgroundColor: `${colors.surface}e8`,
            }}
          >
            <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
              {isAdmin ? "Loading accounts..." : "Loading staff directory..."}
            </FitText>
          </div>
        ) : rows.length > 0 ? (
          <div className="members-directory-panel__rows" style={{ display: "grid", gap: 12 }}>
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
                    padding: "14px 18px",
                    borderRadius: 20,
                    border: `1px solid ${isActive ? `${colors.brand}36` : colors.border}`,
                    backgroundColor: isActive ? `${colors.brand}0f` : `${colors.surface}ea`,
                    boxShadow: isActive ? `0 16px 30px -24px ${colors.brand}` : "0 8px 18px rgba(0,0,0,0.06)",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {tableColumns.map((column) => (
                    <div key={column.key} className="members-directory-panel__cell">
                      {column.render(member, colors)}
                    </div>
                  ))}
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
        ) : (
          <div
            style={{
              padding: 18,
              borderRadius: 20,
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
              borderRadius: 18,
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
            <div key={member.id}>{renderMobileCard(member)}</div>
          ))
        ) : (
          <div
            style={{
              padding: 18,
              borderRadius: 18,
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

      {!pageLoading && filteredCount > 0 ? (
        <div
          key={`${tableMotionKey ?? "stable"}-footer`}
          className="members-directory-panel__footer members-directory-panel__footer--animated"
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
          />
        </div>
      ) : null}

      <style>{`
        @keyframes members-directory-panel-surface-in {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.985);
          }

          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes members-directory-row-in {
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.992);
          }

          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes members-directory-footer-in {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .members-directory-panel__desktop--animated {
          animation: members-directory-panel-surface-in 260ms cubic-bezier(0.18, 0.88, 0.24, 1) both;
        }

        .members-directory-panel__desktop--animated .members-directory-panel__row {
          animation: members-directory-row-in 280ms cubic-bezier(0.18, 0.88, 0.24, 1) both;
        }

        .members-directory-panel__desktop--animated .members-directory-panel__row[data-row-index="1"] {
          animation-delay: 45ms;
        }

        .members-directory-panel__desktop--animated .members-directory-panel__row[data-row-index="2"] {
          animation-delay: 80ms;
        }

        .members-directory-panel__desktop--animated .members-directory-panel__row[data-row-index="3"] {
          animation-delay: 115ms;
        }

        .members-directory-panel__desktop--animated .members-directory-panel__row[data-row-index="4"] {
          animation-delay: 150ms;
        }

        .members-directory-panel__desktop--animated .members-directory-panel__row[data-row-index="5"] {
          animation-delay: 185ms;
        }

        .members-directory-panel__footer--animated {
          animation: members-directory-footer-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) 80ms both;
        }

        .members-directory-panel__row {
          transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1), border-color 180ms ease, background-color 180ms ease;
        }

        .members-directory-panel__cell,
        .members-directory-panel__identity,
        .members-directory-panel__identity-copy {
          min-width: 0;
        }

        .members-directory-panel__identity-avatar {
          transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
          transform-origin: center;
        }

        .members-directory-panel__primary-text,
        .members-directory-panel__secondary-text,
        .members-directory-panel__emphasis-text {
          transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), color 180ms ease, letter-spacing 180ms ease, opacity 180ms ease;
          transform-origin: left center;
        }

        .members-directory-panel__row:hover,
        .members-directory-panel__row:focus-visible {
          transform: translateY(-3px) scale(1.006);
          box-shadow: 0 24px 46px rgba(0, 0, 0, 0.16);
          border-color: ${colors.brand}2f !important;
        }

        .members-directory-panel__row:hover .members-directory-panel__identity-avatar,
        .members-directory-panel__row:focus-visible .members-directory-panel__identity-avatar {
          transform: translateY(-1px) scale(1.06);
          box-shadow: 0 16px 24px rgba(0, 0, 0, 0.16);
        }

        .members-directory-panel__row:hover .members-directory-panel__primary-text,
        .members-directory-panel__row:focus-visible .members-directory-panel__primary-text {
          transform: translateX(2px);
          letter-spacing: 0.012em;
          font-weight: 800 !important;
        }

        .members-directory-panel__row:hover .members-directory-panel__secondary-text,
        .members-directory-panel__row:focus-visible .members-directory-panel__secondary-text {
          transform: translateX(2px);
          color: ${colors.textPrimary} !important;
          opacity: 0.94;
        }

        .members-directory-panel__row:hover .members-directory-panel__emphasis-text,
        .members-directory-panel__row:focus-visible .members-directory-panel__emphasis-text {
          transform: translateX(1px);
          color: ${colors.textPrimary} !important;
          font-weight: 700 !important;
        }

        .members-directory-panel__row-active {
          box-shadow: 0 20px 38px rgba(0, 0, 0, 0.16) !important;
        }

        .members-directory-panel__row-active .members-directory-panel__primary-text {
          font-weight: 800 !important;
        }

        .members-directory-panel__row-active .members-directory-panel__secondary-text {
          color: ${colors.textPrimary} !important;
          opacity: 0.94;
        }

        .members-directory-panel__table-head > :last-child,
        .members-directory-panel__actions {
          justify-self: end;
        }

        @media (max-width: 980px) {
          .members-directory-panel__desktop {
            display: none !important;
          }

          .members-directory-panel__mobile {
            display: grid !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .members-directory-panel__desktop--animated,
          .members-directory-panel__desktop--animated .members-directory-panel__row,
          .members-directory-panel__footer--animated {
            animation: none !important;
          }

          .members-directory-panel__row,
          .members-directory-panel__identity-avatar,
          .members-directory-panel__primary-text,
          .members-directory-panel__secondary-text,
          .members-directory-panel__emphasis-text {
            transition: none !important;
          }
        }

        @media (max-width: 640px) {
          .members-directory-panel {
            padding: 14px !important;
          }

          .members-directory-panel__footer {
            align-items: flex-start !important;
          }
        }
      `}</style>
    </section>
  );
}
