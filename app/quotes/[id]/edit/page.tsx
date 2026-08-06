"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard-layout";
import { useLanguage } from "@/lib/i18n/language-context";
import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import { useQuote, useUpdateQuote } from "@/lib/hooks/use-quotes";
import { oreToInputString } from "@/lib/money/parse";
import {
  QuoteBuilder,
  emptyBuilderRow,
  type QuoteBuilderValue,
} from "@/components/quotes/QuoteBuilder";
import { ListSkeleton, QueryError, NotFoundState } from "@/components/crm/QueryState";

/**
 * Edit a draft quote. Only drafts are editable — once a quote has been sent, its
 * numbers are what the customer saw, so the API rejects the write and this page
 * refuses to render the form.
 */
export default function EditQuotePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { locale } = useLanguage();
  const { tr } = useTr();
  const errorMessage = useApiErrorMessage();

  const { data, isLoading, isError, error, refetch } = useQuote(id);
  const update = useUpdateQuote(id);

  const quote = data?.quote;
  const company = data?.company ?? null;

  const backLink = (
    <Link href={`/quotes/${id}`} className="text-sm font-semibold text-primary hover:underline">
      {tr("Tilbage til tilbuddet", "Back to the quote")}
    </Link>
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <ListSkeleton rows={5} />
        </div>
      </DashboardLayout>
    );
  }

  if (isError) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <QueryError error={error} onRetry={() => refetch()} />
        </div>
      </DashboardLayout>
    );
  }

  if (!quote) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <NotFoundState
            title={tr("Tilbuddet findes ikke.", "This quote does not exist.")}
            action={
              <Link href="/quotes" className="text-sm font-semibold text-primary hover:underline">
                {tr("Tilbage til tilbud", "Back to quotes")}
              </Link>
            }
          />
        </div>
      </DashboardLayout>
    );
  }

  if (quote.status !== "draft") {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <NotFoundState
            title={tr(
              "Kun kladder kan redigeres. Dublér tilbuddet i stedet.",
              "Only drafts can be edited. Duplicate the quote instead."
            )}
            action={backLink}
          />
        </div>
      </DashboardLayout>
    );
  }

  const initial: QuoteBuilderValue = {
    company: company ? { vat: company.vat, name: company.name } : null,
    issueDate: quote.issueDate ?? "",
    validUntil: quote.validUntil ?? "",
    terms: quote.terms ?? "",
    rows:
      (data?.lines ?? []).length > 0
        ? (data?.lines ?? []).map((l) => ({
            productId: l.productId ?? "",
            description: l.description,
            qty: l.quantity,
            price: oreToInputString(l.unitPrice, locale === "da" ? "da" : "en"),
            discountPct: l.discountPct,
            vatRate: l.vatRate,
          }))
        : [emptyBuilderRow()],
  };

  return (
    <DashboardLayout>
      <QuoteBuilder
        title={tr(`Redigér ${quote.number}`, `Edit ${quote.number}`)}
        submitLabel={tr("Gem ændringer", "Save changes")}
        initial={initial}
        lockCompany
        isPending={update.isPending}
        onCancel={() => router.push(`/quotes/${id}`)}
        onSubmit={(payload) =>
          update.mutate(
            {
              issueDate: payload.issueDate,
              validUntil: payload.validUntil,
              terms: payload.terms,
              lines: payload.lines,
            },
            {
              onSuccess: () => {
                toast.success(tr("Tilbud opdateret", "Quote updated"));
                router.push(`/quotes/${id}`);
              },
              onError: (e) => toast.error(errorMessage(e)),
            }
          )
        }
      />
    </DashboardLayout>
  );
}
