import type { DocPage } from "../types";

export const todosDoc: DocPage = {
  slug: "todos",
  title: { en: "Todos", da: "Opgaver" },
  description: {
    en: "Track follow-up tasks linked to companies. Prioritise, assign (Enterprise), and export to iCal.",
    da: "Spor opfølgningsopgaver knyttet til virksomheder. Prioritér, tildel (Enterprise) og eksportér til iCal.",
  },
  sections: [
    {
      id: "creating-tasks",
      title: { en: "Creating a task", da: "Opret en opgave" },
      body: {
        en: "Click 'New task' at the top of the Todos page, or use the inline 'Create task' button on any Company detail page. Tasks created from a company page are automatically linked to that company.",
        da: "Klik på 'Ny opgave' øverst på opgavesiden, eller brug den inline 'Opret opgave'-knap på en virksomhedsdetaljside. Opgaver oprettet fra en virksomhedsside er automatisk knyttet til den pågældende virksomhed.",
      },
      screenshot: {
        slug: "todos/create",
        alt: { en: "Create task dialog", da: "Opret opgave-dialog" },
      },
    },
    {
      id: "priorities",
      title: { en: "Priority levels", da: "Prioritetsniveauer" },
      body: {
        en: "Every task has a priority: High (red), Medium (amber), or Low (blue). Use the filter bar to show only tasks of a specific priority. Tasks are sorted by priority by default.",
        da: "Hver opgave har en prioritet: Høj (rød), Mellem (amber) eller Lav (blå). Brug filterlinjen til kun at vise opgaver med en bestemt prioritet. Opgaver sorteres som standard efter prioritet.",
      },
      screenshot: {
        slug: "todos/list",
        alt: { en: "Todos list with priority badges", da: "Opgaveliste med prioritetsmærker" },
      },
    },
    {
      id: "linked-companies",
      title: { en: "Company links", da: "Virksomhedstilknytninger" },
      body: {
        en: "Tasks linked to a company display the company name as a clickable badge. Click it to open the company detail page without losing your place in the todo list.",
        da: "Opgaver knyttet til en virksomhed viser firmanavnet som et klikbart mærke. Klik på det for at åbne virksomhedsdetaljsiden uden at miste din plads på opgavelisten.",
      },
    },
    {
      id: "task-assignment",
      title: { en: "Team assignment", da: "Teamtildeling" },
      body: {
        en: "On Enterprise plans, tasks can be assigned to any team member. The assignee sees the task in their own Todos list with a team badge.",
        da: "På Enterprise-planer kan opgaver tildeles til et hvilket som helst teammedlem. Den tildelte ser opgaven på sin egen opgaveliste med et team-mærke.",
      },
      badge: "Enterprise",
    },
    {
      id: "ical-export",
      title: { en: "iCal export", da: "iCal-eksport" },
      body: {
        en: "Export all tasks with due dates to an iCal (.ics) file. Import it into Google Calendar, Outlook, or Apple Calendar to see your CVR-MATE tasks alongside your meetings.",
        da: "Eksportér alle opgaver med forfaldsdatoer til en iCal (.ics)-fil. Importér den til Google Kalender, Outlook eller Apple Kalender for at se dine CVR-MATE-opgaver ved siden af dine møder.",
      },
    },
  ],
};
