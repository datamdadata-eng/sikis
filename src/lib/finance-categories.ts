export const DEBT_CATEGORIES = ["Uçak Biletleri", "Avans", "Vize + Kitas", "Guest Houselar"] as const;

export const EXPENSE_CATEGORIES = ["Yemek", "Temizlikçi", "Worldcall", "Diğer IT Giderleri"] as const;

export const DEFAULT_DEBT_CATEGORY = "Avans";
export const DEFAULT_EXPENSE_CATEGORY = "Yemek";

export const normalizeDebtCategory = (value: unknown) => {
  const category = String(value ?? "").trim();
  return DEBT_CATEGORIES.includes(category as (typeof DEBT_CATEGORIES)[number])
    ? category
    : DEFAULT_DEBT_CATEGORY;
};

export const normalizeExpenseCategory = (value: unknown) => {
  const category = String(value ?? "").trim();
  return EXPENSE_CATEGORIES.includes(category as (typeof EXPENSE_CATEGORIES)[number])
    ? category
    : DEFAULT_EXPENSE_CATEGORY;
};
