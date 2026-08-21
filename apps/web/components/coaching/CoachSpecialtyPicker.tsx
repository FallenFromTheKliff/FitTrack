"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { coachSpecialtiesQueryOptions } from "@fittrack/query";

import { FitText, FitTextInput } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";
import { COACH_SPECIALTY_OPTIONS } from "@/components/schedule/GymOperationsOverlayShared";

type CoachSpecialtyPickerProps = {
  ariaLabel?: string;
  disabled?: boolean;
  id?: string;
  maxItems?: number;
  onChange: (values: string[]) => void;
  placeholder?: string;
  value: string[];
};

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isSameLabel(left: string, right: string) {
  return (
    normalizeLabel(left).toLocaleLowerCase() ===
    normalizeLabel(right).toLocaleLowerCase()
  );
}

export default function CoachSpecialtyPicker({
  ariaLabel = "Coach specialties",
  disabled = false,
  id = "coach-specialties",
  maxItems = 20,
  onChange,
  placeholder = "Search or add a specialty",
  value,
}: CoachSpecialtyPickerProps) {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const queryParams = useMemo(
    () => ({ page: 1, limit: 20, search: search.trim() || undefined }),
    [search],
  );
  const specialtiesQuery = useQuery({
    ...coachSpecialtiesQueryOptions(webApiClient, queryParams),
    enabled: !disabled,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selectedSet = useMemo(
    () => new Set(value.map((item) => normalizeLabel(item).toLocaleLowerCase())),
    [value],
  );
  const catalogOptions = useMemo(() => {
    const remoteOptions = specialtiesQuery.data?.data ?? [];
    if (remoteOptions.length > 0 || !specialtiesQuery.isError) return remoteOptions;

    return COACH_SPECIALTY_OPTIONS.map((option) => ({
      id: option.value,
      label: option.label,
    }));
  }, [specialtiesQuery.data?.data, specialtiesQuery.isError]);
  const filteredOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return catalogOptions
      .filter((option) =>
        normalizedSearch
          ? option.label.toLocaleLowerCase().includes(normalizedSearch)
          : true,
      )
      .slice(0, 20);
  }, [catalogOptions, search]);
  const exactOption = catalogOptions.find((option) => isSameLabel(option.label, search));
  const canCreate = Boolean(
    search.trim() &&
      !exactOption &&
      !isSameLabel(search, "N/A") &&
      !selectedSet.has(normalizeLabel(search).toLocaleLowerCase()),
  );

  const addSpecialty = (nextValue: string) => {
    const normalizedValue = normalizeLabel(nextValue);
    if (!normalizedValue || isSameLabel(normalizedValue, "N/A")) return;

    const catalogMatch = catalogOptions.find((option) => isSameLabel(option.label, normalizedValue));
    const label = catalogMatch?.label ?? normalizedValue;
    if (
      selectedSet.has(normalizeLabel(label).toLocaleLowerCase()) ||
      value.length >= maxItems
    ) {
      return;
    }

    onChange([...value, label]);
    setSearch("");
    setIsOpen(false);
  };

  const removeSpecialty = (label: string) => {
    onChange(value.filter((item) => !isSameLabel(item, label)));
  };

  return (
    <div ref={rootRef} style={{ display: "grid", gap: 8, minWidth: 0 }}>
      {value.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {value.map((label) => (
            <button
              key={label}
              type="button"
              aria-label={`Remove ${label}`}
              disabled={disabled}
              onClick={() => removeSpecialty(label)}
              style={{
                alignItems: "center",
                backgroundColor: `${colors.brand}14`,
                border: `1px solid ${colors.brand}42`,
                borderRadius: 999,
                color: colors.brand,
                cursor: disabled ? "not-allowed" : "pointer",
                display: "inline-flex",
                fontSize: 11,
                fontWeight: 800,
                gap: 6,
                maxWidth: "100%",
                padding: "7px 10px",
                textAlign: "left",
              }}
            >
              <span style={{ overflowWrap: "anywhere" }}>{label}</span>
              {!disabled ? <span aria-hidden="true">×</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ position: "relative" }}>
        <FitTextInput
          id={id}
          role="combobox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-controls={`${id}-options`}
          aria-expanded={isOpen}
          autoComplete="off"
          value={search}
          disabled={disabled || value.length >= maxItems}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
            } else if (event.key === "Enter" && canCreate) {
              event.preventDefault();
              addSpecialty(search);
            }
          }}
          placeholder={value.length >= maxItems ? "Specialty limit reached" : placeholder}
          style={{
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            color: colors.textPrimary,
            minHeight: 42,
            padding: "10px 12px",
            width: "100%",
          }}
        />

        {isOpen && !disabled ? (
          <div
            id={`${id}-options`}
            role="listbox"
            style={{
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              boxShadow: "0 16px 32px rgba(0, 0, 0, 0.24)",
              display: "grid",
              gap: 4,
              left: 0,
              maxHeight: 220,
              overflowY: "auto",
              padding: 6,
              position: "absolute",
              right: 0,
              top: "calc(100% + 6px)",
              zIndex: 40,
            }}
          >
            {filteredOptions.map((option) => {
              const selected = selectedSet.has(
                normalizeLabel(option.label).toLocaleLowerCase(),
              );
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addSpecialty(option.label)}
                  style={{
                    backgroundColor: selected ? `${colors.brand}12` : colors.surfaceRaised,
                    border: `1px solid ${selected ? `${colors.brand}55` : colors.border}`,
                    borderRadius: 8,
                    color: selected ? colors.brand : colors.textPrimary,
                    cursor: selected ? "default" : "pointer",
                    fontSize: 12,
                    fontWeight: 750,
                    minHeight: 36,
                    padding: "8px 10px",
                    textAlign: "left",
                  }}
                >
                  {option.label}{selected ? " · Added" : ""}
                </button>
              );
            })}
            {canCreate ? (
              <button
                type="button"
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addSpecialty(search)}
                style={{
                  backgroundColor: `${colors.warning}12`,
                  border: `1px solid ${colors.warning}40`,
                  borderRadius: 8,
                  color: colors.warning,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 800,
                  minHeight: 36,
                  padding: "8px 10px",
                  textAlign: "left",
                }}
              >
                Add “{normalizeLabel(search)}”
              </button>
            ) : null}
            {filteredOptions.length === 0 && !canCreate ? (
              <FitText
                excludeGlobalScale
                style={{ color: colors.textMuted, fontSize: 12, padding: "8px 6px" }}
              >
                {specialtiesQuery.isPending ? "Loading specialties…" : "No matching specialties."}
              </FitText>
            ) : null}
          </div>
        ) : null}
      </div>
      <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 11, lineHeight: 1.4 }}>
        Search the shared catalog or add a custom label. {value.length}/{maxItems} selected.
      </FitText>
    </div>
  );
}
