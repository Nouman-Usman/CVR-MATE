"use client";

import { ContactsSection } from "./crm/ContactsSection";
import { DocumentsSection } from "./crm/DocumentsSection";
import { SegmentsSection } from "./crm/SegmentsSection";
import { ContractsSection } from "./crm/ContractsSection";
import { InteractionsSection } from "./crm/InteractionsSection";
import { NotesSection } from "./crm/NotesSection";
import { ActivitySection } from "./crm/ActivitySection";

/** The full native-CRM panel for a company: contacts, documents, notes, activity. */
export default function CrmTab({ vat }: { vat: string }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
      <div className="lg:col-span-2 space-y-4 sm:space-y-6">
        <ContactsSection vat={vat} />
        <DocumentsSection vat={vat} />
        <SegmentsSection vat={vat} />
        <ContractsSection vat={vat} />
        <InteractionsSection vat={vat} />
        <NotesSection vat={vat} />
      </div>
      <div className="lg:col-span-1">
        <ActivitySection vat={vat} />
      </div>
    </div>
  );
}
