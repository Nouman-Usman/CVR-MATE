"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTr, useApiErrorMessage } from "@/lib/i18n/tr";
import { useSendQuote } from "@/lib/hooks/use-quotes";

/**
 * Sending a quote is the moment it stops being internal, so this collects a real
 * recipient rather than firing on a bare button press. It also surfaces the two
 * outcomes that used to be invisible: a missing seller CVR (which makes the
 * document incomplete as a Danish offer) and a delivery failure after the quote
 * has already been marked sent.
 */
export function SendQuoteDialog({
  quoteId,
  open,
  onOpenChange,
  defaultRecipient,
  customerName,
  missingSellerFields = [],
  onSent,
}: {
  quoteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRecipient?: string | null;
  customerName?: string | null;
  /** Seller fields absent from the brand profile, e.g. ["cvr", "address"]. */
  missingSellerFields?: string[];
  onSent?: () => void;
}) {
  const { tr } = useTr();
  const errorMessage = useApiErrorMessage();
  const send = useSendQuote(quoteId);

  const [to, setTo] = useState(defaultRecipient ?? "");
  const [message, setMessage] = useState("");
  const [sentUrl, setSentUrl] = useState<string | null>(null);

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());

  function submit() {
    if (!emailLooksValid) {
      toast.error(tr("Angiv en gyldig e-mail", "Enter a valid email address"));
      return;
    }
    send.mutate(
      { to: to.trim(), message: message.trim() || undefined },
      {
        onSuccess: (res) => {
          setSentUrl(res.quoteUrl);
          if (res.emailed) {
            toast.success(tr("Tilbud sendt", "Quote sent"));
          } else {
            // The quote IS sent and the link works — say exactly that rather
            // than implying nothing happened.
            toast.warning(
              tr(
                "Tilbuddet er sendt, men e-mailen kunne ikke leveres. Del linket manuelt.",
                "The quote was sent, but the email could not be delivered. Share the link manually."
              )
            );
          }
          onSent?.();
        },
        onError: (e) => toast.error(errorMessage(e)),
      }
    );
  }

  function close() {
    onOpenChange(false);
    // Reset only after the dialog is dismissed, so the link stays visible while
    // it is open.
    setTimeout(() => setSentUrl(null), 200);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tr("Send tilbud", "Send quote")}</DialogTitle>
          <DialogDescription>
            {customerName
              ? tr(
                  `${customerName} modtager et link til tilbuddet.`,
                  `${customerName} will receive a link to the quote.`
                )
              : tr(
                  "Kunden modtager et link, hvor tilbuddet kan accepteres eller afvises.",
                  "The customer receives a link where they can accept or decline."
                )}
          </DialogDescription>
        </DialogHeader>

        {sentUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              {tr("Tilbuddet er sendt. Link til kunden:", "The quote is sent. Customer link:")}
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={sentUrl}
                aria-label={tr("Kundelink", "Customer link")}
                className="flex-1 px-2.5 py-2 rounded-lg border border-border text-xs bg-muted/40 text-foreground"
              />
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 shrink-0"
                onClick={() => {
                  navigator.clipboard?.writeText(sentUrl);
                  toast.success(tr("Kopieret", "Copied"));
                }}
              >
                <Copy className="size-3.5" />
                {tr("Kopiér", "Copy")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {missingSellerFields.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {tr(
                  `Din virksomhedsprofil mangler: ${missingSellerFields.join(", ")}. Tilbuddet sendes uden disse oplysninger.`,
                  `Your company profile is missing: ${missingSellerFields.join(", ")}. The quote will be sent without them.`
                )}
              </p>
            )}
            <label className="block text-xs text-muted-foreground" htmlFor="send-quote-to">
              {tr("Modtager", "Recipient")} <span className="text-destructive">*</span>
              <input
                id="send-quote-to"
                type="email"
                autoFocus
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="navn@virksomhed.dk"
                className="mt-1 w-full px-2.5 py-2 rounded-lg border border-border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <label className="block text-xs text-muted-foreground" htmlFor="send-quote-message">
              {tr("Besked (valgfri)", "Message (optional)")}
              <textarea
                id="send-quote-message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 w-full px-2.5 py-2 rounded-lg border border-border text-sm bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {sentUrl ? (
            <Button className="rounded-xl" onClick={close}>
              {tr("Luk", "Close")}
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                className="rounded-xl"
                onClick={close}
                disabled={send.isPending}
              >
                {tr("Annullér", "Cancel")}
              </Button>
              <Button
                className="rounded-xl gap-1.5"
                onClick={submit}
                disabled={send.isPending || !emailLooksValid}
              >
                {send.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                {tr("Send", "Send")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
