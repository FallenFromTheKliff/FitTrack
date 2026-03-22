"use client";
import { useMemo, useState } from "react";
import { Package, PackagePlus, AlertTriangle, DollarSign, BarChart2, SlidersHorizontal } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useDebounce, useLoadingText, useTimedMessage } from "@fittrack/hooks";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { FEEDBACK_DURATION_MS } from "@/constants/feedback";
import { dashboardStyles } from "@/styles/pageStyles";
import { sleep } from "@/utils/sleep";
import { MONTHLY_SALES, PRODUCTS_LIST, STOCK_STATUS_COLOR, STOCK_FILTER_OPTIONS, ADD_PRODUCT_FIELDS } from "@/data/inventory/inventory";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitPill from "@/components/fit/FitPill";
import { FitInlineFilterChips } from "@/components/fit/FitFilter";
import { FitKpiCard } from "@/components/fit/FitCard";
import FitSearch from "@/components/fit/FitSearch";
import FitSection from "@/components/fit/FitSection";
import FitTable from "@/components/fit/FitTable";
import type { FitTableColumn } from "@/components/fit/FitTable";
import DetailsModal from "@/components/modals/DetailsModal";

type Product = typeof PRODUCTS_LIST[number];

const MIN_ACTION_DELAY_MS = FEEDBACK_DURATION_MS.standard;

const INVENTORY_TABS = [
  { key: "products", label: "Products" },
  { key: "analytics", label: "Analytics" }
] as const;

type InventoryTab = typeof INVENTORY_TABS[number]["key"];

export default function InventoryPage() {
  const { colors } = useTheme();
  const s = dashboardStyles(colors);
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [stockFilter, setStockFilter] = useState<"All" | Product["status"]>("All");
  const debouncedQ = useDebounce(q, 250);
  const [tab, setTab] = useState<InventoryTab>("products");
  const [products, setProducts] = useState(PRODUCTS_LIST);
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();
  const { message, showMessage } = useTimedMessage(2500);
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const addLoadingLabel = useLoadingText("ADDING PRODUCT", addLoading);

  const filtered = useMemo(() => products.filter((p) => {
    const matchesSearch =
        p.name.toLowerCase().includes(debouncedQ.toLowerCase()) ||
        p.sku.toLowerCase().includes(debouncedQ.toLowerCase());
    const matchesStock = stockFilter === "All" ? true : p.status === stockFilter;
    return matchesSearch && matchesStock;
  }), [products, debouncedQ, stockFilter]);

  const topProducts = useMemo(
      () => products.map((p) => ({ name: p.name, value: p.price * p.stock })).sort((a, b) => b.value - a.value),
      [products]
  );
  const totalValue = products.reduce((acc, p) => acc + p.price * p.stock, 0);
  const lowStock = products.filter((p) => p.status === "Low Stock").length;
  const categories = new Set(products.map((p) => p.category)).size;

  const handleAddProduct = async (data: Record<string, string>) => {
    setAddLoading(true);
    await sleep(MIN_ACTION_DELAY_MS);
    const stock = Number(data.stock) || 0;
    const price = Number(data.price) || 0;
    const status: Product["status"] = stock === 0 ? "Out of Stock" : stock <= 10 ? "Low Stock" : "In Stock";
    setProducts((prev) => [
      ...prev,
      { sku: data.sku ?? "", name: data.name ?? "", category: data.category ?? "", stock, status, price }
    ]);
    setAddLoading(false);
    setAddOpen(false);
    showMessage("Product added.");
  };

  const productColumns: FitTableColumn<Product>[] = [
    {
      key: "sku",
      heading: "SKU",
      render: (p, c) => (
          <FitText style={{ fontSize: 13, fontFamily: "monospace", color: c.brand, fontWeight: 600 }}>{p.sku}</FitText>
      )
    },
    {
      key: "name",
      heading: "PRODUCT NAME",
      render: (p) => <FitText style={{ fontSize: 14 }}>{p.name}</FitText>
    },
    {
      key: "category",
      heading: "CATEGORY",
      render: (p, c) => <FitText style={{ fontSize: 14, color: c.textMuted }}>{p.category}</FitText>
    },
    {
      key: "stock",
      heading: "STOCK",
      render: (p) => <FitText style={{ fontSize: 14 }}>{p.stock}</FitText>
    },
    {
      key: "status",
      heading: "STATUS",
      render: (p, c) => (
          <FitPill mode="status" label={p.status} color={STOCK_STATUS_COLOR[p.status] ?? c.textMuted} fontSize={13} />
      )
    },
    {
      key: "price",
      heading: "PRICE",
      render: (p, c) => <FitText style={{ fontSize: 14, color: c.textMuted }}>${p.price.toFixed(2)}</FitText>
    },
    {
      key: "total",
      heading: "TOTAL VALUE",
      render: (p, c) => <FitText style={{ fontSize: 14, color: c.textMuted }}>${(p.price * p.stock).toFixed(2)}</FitText>
    }
  ];

  return (
      <section className={themeTransition} style={fadeIn}>
        {message && (
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end" }}>
              <FitText style={{ fontSize: 13, color: colors.success, fontWeight: 500 }}>{message}</FitText>
            </div>
        )}
        <div
            className="inventory-grid"
            style={{ display: "grid", gridTemplateColumns: "minmax(220px, 260px) 1fr", gap: 20, alignItems: "start" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { icon: Package, label: "Total Products", value: String(products.length), color: colors.brand },
              { icon: AlertTriangle, label: "Low Stock Items", value: String(lowStock), color: colors.warning },
              { icon: DollarSign, label: "Total Value", value: `$${totalValue.toFixed(2)}`, color: colors.success },
              { icon: BarChart2, label: "Categories", value: String(categories), color: colors.brand }
            ].map((item) => (
                <FitKpiCard key={item.label} icon={item.icon} label={item.label} value={item.value} color={item.color} style={s.kpiCard} />
            ))}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: "1 1 360px", minWidth: 240 }}>
                <FitSearch value={q} onChangeText={setQ} placeholder="Search by name or SKU..." />
              </div>
              <FitButton variant="primary" label="ADD PRODUCT" icon={PackagePlus} iconSize={14} onClick={() => setAddOpen(true)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <FitPill
                  options={[...INVENTORY_TABS]}
                  active={tab}
                  onChange={setTab}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FitButton variant="ghost" label="Filter" icon={SlidersHorizontal} iconSize={16} onClick={() => setShowFilters((v) => !v)} />
                <FitInlineFilterChips
                    isOpen={showFilters}
                    options={STOCK_FILTER_OPTIONS}
                    activeValue={stockFilter}
                    onChange={(value) => setStockFilter(value as "All" | Product["status"])}
                    maxWidth={420}
                />
              </div>
            </div>
            {tab === "products" && (
                <FitSection heading="Products">
                  <FitTable columns={productColumns} rows={filtered} getRowKey={(p) => p.sku} />
                </FitSection>
            )}
            {tab === "analytics" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <FitSection heading="Monthly Sales & Revenue">
                    <div style={{ height: 260, padding: "22px 16px 10px" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={MONTHLY_SALES}>
                          <XAxis dataKey="month" stroke={colors.textMuted} tick={{ fontSize: 12 }} />
                          <YAxis stroke={colors.textMuted} tick={{ fontSize: 12 }} />
                          <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                          <Line type="monotone" dataKey="revenue" stroke={colors.brand} strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="cost" stroke={colors.warning} strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </FitSection>
                  <FitSection heading="Top Selling Products">
                    <div style={{ height: 240, padding: "20px 16px 10px" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topProducts} margin={{ bottom: 40 }}>
                          <XAxis dataKey="name" stroke={colors.textMuted} tick={{ fontSize: 11, angle: -15, textAnchor: "end" }} />
                          <YAxis stroke={colors.textMuted} tick={{ fontSize: 12 }} />
                          <Tooltip contentStyle={{ backgroundColor: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8 }} />
                          <Bar dataKey="value" fill={colors.brand} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </FitSection>
                </div>
            )}
          </div>
        </div>
        <DetailsModal
            isOpen={addOpen}
            title="Add Product"
            subtitle="Add a new product to inventory"
            fields={ADD_PRODUCT_FIELDS}
            submitLabel={addLoading ? addLoadingLabel : "ADD PRODUCT"}
            isLoading={addLoading}
            onSubmit={handleAddProduct}
            onCancel={() => setAddOpen(false)}
        />
        <style>{`
        @media (max-width: 860px) { .inventory-grid { grid-template-columns: 1fr !important; } }
      `}</style>
      </section>
  );
}