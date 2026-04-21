"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { FitText } from "./FitText";

type Props = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
};

type PaginationItem = number | "start-ellipsis" | "end-ellipsis";

function buildPaginationItems(
  currentPage: number,
  totalPages: number,
  siblingCount: number,
  boundaryCount: number
): PaginationItem[] {
  if (totalPages <= 0) return [];

  const range = (start: number, end: number) => {
    const values: number[] = [];
    for (let value = start; value <= end; value += 1) values.push(value);
    return values;
  };

  const totalPageNumbers = boundaryCount * 2 + siblingCount * 2 + 3;
  if (totalPages <= totalPageNumbers) {
    return range(1, totalPages);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, boundaryCount + 2);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages - boundaryCount - 1);

  const showLeftEllipsis = leftSiblingIndex > boundaryCount + 2;
  const showRightEllipsis = rightSiblingIndex < totalPages - boundaryCount - 1;

  const startPages = range(1, boundaryCount);
  const endPages = range(totalPages - boundaryCount + 1, totalPages);

  if (!showLeftEllipsis) {
    const leftRange = range(1, boundaryCount + siblingCount * 2 + 2);
    return [...leftRange, "end-ellipsis", ...endPages];
  }

  if (!showRightEllipsis) {
    const rightRange = range(totalPages - (boundaryCount + siblingCount * 2 + 1), totalPages);
    return [...startPages, "start-ellipsis", ...rightRange];
  }

  const middleRange = range(leftSiblingIndex, rightSiblingIndex);
  return [...startPages, "start-ellipsis", ...middleRange, "end-ellipsis", ...endPages];
}

export default function FitPagination({
  currentPage,
  totalPages,
  onPageChange,
  ariaLabel = "Pagination navigation",
}: Props) {
  const { colors } = useTheme();
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const update = () => setIsCompact(mediaQuery.matches);

    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  const items = useMemo(
    () => buildPaginationItems(currentPage, totalPages, isCompact ? 0 : 1, 1),
    [currentPage, isCompact, totalPages]
  );

  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label={ariaLabel}
      className="fit-pagination"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        aria-label="Go to previous page"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="fit-pagination-button"
        style={{
          minWidth: 36,
          height: 36,
          padding: "0 10px",
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
          color: colors.textSecondary,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: currentPage === 1 ? "default" : "pointer",
          opacity: currentPage === 1 ? 0.48 : 1,
        }}
      >
        <ChevronLeft size={15} />
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {items.map((item, index) => {
          if (typeof item !== "number") {
            return (
              <div
                key={`${item}-${index}`}
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 36,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.textMuted,
                }}
              >
                <MoreHorizontal size={14} />
              </div>
            );
          }

          const isActive = item === currentPage;
          return (
            <button
              key={item}
              type="button"
              aria-label={`Go to page ${item}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onPageChange(item)}
              className="fit-pagination-button"
              style={{
                minWidth: 36,
                height: 36,
                padding: "0 12px",
                borderRadius: 12,
                border: `1px solid ${isActive ? `${colors.brand}55` : colors.border}`,
                backgroundColor: isActive ? `${colors.brand}18` : colors.surfaceRaised,
                color: isActive ? colors.brand : colors.textSecondary,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <FitText
                as="span"
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? 800 : 700,
                  color: "inherit",
                }}
              >
                {item}
              </FitText>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Go to next page"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="fit-pagination-button"
        style={{
          minWidth: 36,
          height: 36,
          padding: "0 10px",
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surfaceRaised,
          color: colors.textSecondary,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: currentPage === totalPages ? "default" : "pointer",
          opacity: currentPage === totalPages ? 0.48 : 1,
        }}
      >
        <ChevronRight size={15} />
      </button>
      <style>{`
        .fit-pagination-button {
          transition:
            transform 180ms ease,
            border-color 180ms ease,
            box-shadow 180ms ease,
            background-color 180ms ease,
            color 180ms ease;
        }

        .fit-pagination-button:hover:not(:disabled),
        .fit-pagination-button:focus-visible {
          transform: translateY(-1px);
          box-shadow: 0 14px 26px rgba(0, 0, 0, 0.16);
        }

        .fit-pagination-button:focus-visible {
          outline: 2px solid ${colors.brand}55;
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .fit-pagination-button {
            transition: none !important;
          }
        }
      `}</style>
    </nav>
  );
}
