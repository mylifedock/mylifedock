import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { FinanceRecord } from "../../infrastructure/database/db";
import { createFinance, deleteFinance, getFinances, updateFinance } from "../../application/financeService";
import { formatCurrency, getPreferredCurrency, isSupportedCurrency, SUPPORTED_CURRENCIES } from "../../application/currencyService";
import { RecordCollection, type FieldDef } from "../components/RecordCollection";
import { PageHeader, SectionTabs } from "../components/PageHeader";
import { SubscriptionsSection } from "./SubscriptionsSection";

type MoneyTab = "accounts" | "subscriptions";

const CATEGORY_LABELS: Record<FinanceRecord["category"], string> = {
  bank: "Bank account",
  card: "Credit / debit card",
  investment: "Investment",
  liability: "Loan / liability",
};

interface AccountDraft {
  category: FinanceRecord["category"];
  institution: string;
  accountType: string;
  identifier: string;
  balance?: number;
  currency: string;
  notes: string;
}

const CURRENCY_OPTIONS = Object.values(SUPPORTED_CURRENCIES).map((c) => ({ value: c.code, label: c.label }));

const ACCOUNT_FIELDS: FieldDef<AccountDraft>[] = [
  {
    key: "category",
    label: "Type",
    type: "select",
    options: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    half: true,
  },
  { key: "institution", label: "Bank / institution", type: "text", required: true, placeholder: "e.g. SBI, HDFC Bank, Zerodha", half: true },
  { key: "accountType", label: "Account or card name", type: "text", placeholder: "e.g. Savings, Visa Signature, PPF", half: true },
  {
    key: "identifier",
    label: "Last 4 digits",
    type: "text",
    inputMode: "numeric",
    maxLength: 4,
    pattern: "\\d{1,4}",
    placeholder: "1234",
    hint: "Only the last 4 digits are stored, never full numbers.",
    half: true,
  },
  { key: "balance", label: "Balance", type: "number", step: "0.01", half: true },
  { key: "currency", label: "Currency", type: "select", options: CURRENCY_OPTIONS, half: true },
  { key: "notes", label: "Notes", type: "textarea" },
];

function AccountsSection({ focusId }: { focusId?: string }) {
  const accounts = useLiveQuery(() => getFinances());

  return (
    <RecordCollection<FinanceRecord, AccountDraft>
      noun="Account"
      items={accounts}
      fields={ACCOUNT_FIELDS}
      attachments
      focusId={focusId}
      emptyDraft={() => ({ category: "bank", institution: "", accountType: "", identifier: "", currency: getPreferredCurrency(), notes: "" })}
      toDraft={(r) => ({
        category: r.category,
        institution: r.institution,
        accountType: r.accountType ?? "",
        identifier: r.identifier ?? "",
        balance: r.balance,
        currency: r.currency && isSupportedCurrency(r.currency) ? r.currency : getPreferredCurrency(),
        notes: r.notes ?? "",
      })}
      create={(d, id) => createFinance(toRecord(d), id)}
      update={(id, d) => updateFinance(id, toRecord(d))}
      remove={deleteFinance}
      card={(r) => ({
        title: r.institution,
        badge: CATEGORY_LABELS[r.category]?.toUpperCase(),
        lines: [
          ["Account", r.accountType],
          ["Ending in", r.identifier],
          ["Balance", r.balance === undefined ? undefined : formatCurrency(r.balance, r.currency && isSupportedCurrency(r.currency) ? r.currency : undefined)],
        ],
        notes: r.notes,
      })}
      empty={{ icon: "💰", title: "No accounts yet", text: "Add bank accounts, cards, investments and loans to keep them in one place." }}
    />
  );
}

function toRecord(d: AccountDraft) {
  return {
    category: d.category,
    institution: d.institution.trim(),
    accountType: d.accountType.trim() || undefined,
    identifier: d.identifier.trim() || undefined,
    balance: d.balance,
    currency: d.currency,
    notes: d.notes.trim() || undefined,
  };
}

/** Accounts and recurring subscriptions in one Money section. */
export function MoneyPage({ initialTab, focusId }: { initialTab?: string; focusId?: string }) {
  const [tab, setTab] = useState<MoneyTab>(initialTab === "subscriptions" ? "subscriptions" : "accounts");

  return (
    <div className="page-container fade-in">
      <PageHeader title="Money" subtitle="Accounts, cards and investments, plus subscriptions with renewal reminders." />
      <SectionTabs<MoneyTab>
        label="Money sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "accounts", label: "Accounts" },
          { id: "subscriptions", label: "Subscriptions" },
        ]}
      />
      {tab === "accounts" ? <AccountsSection focusId={focusId} /> : <SubscriptionsSection focusId={focusId} />}
    </div>
  );
}

export default MoneyPage;
