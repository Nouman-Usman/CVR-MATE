"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard-layout";
import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import { useCreateQuote } from "@/lib/hooks/use-quotes";
import {
  QuoteBuilder,
  emptyBuilderValue,
  QUOTE_DRAFT_KEY,
} from "@/components/quotes/QuoteBuilder";

export default function NewQuotePage() {
  const { tr } = useTr();
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const createQuote = useCreateQuote();

  return (
    <DashboardLayout>
      <QuoteBuilder
        title={tr("Nyt tilbud", "New quote")}
        submitLabel={tr("Opret tilbud", "Create quote")}
        initial={emptyBuilderValue()}
        draftKey={QUOTE_DRAFT_KEY}
        isPending={createQuote.isPending}
        onCancel={() => router.push("/quotes")}
        onSubmit={(payload) =>
          createQuote.mutate(payload, {
            onSuccess: (res) => {
              toast.success(tr("Tilbud oprettet", "Quote created"));
              router.push(`/quotes/${res.quote.id}`);
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </DashboardLayout>
  );
}
