import { overviewDoc } from "./overview";
import { dashboardDoc } from "./dashboard";
import { searchDoc } from "./search";
import { companyDoc } from "./company";
import { savedCompaniesDoc } from "./saved-companies";
import { savedSearchesDoc } from "./saved-searches";
import { triggersDoc } from "./triggers";
import { todosDoc } from "./todos";
import { exportsDoc } from "./exports";
import { integrationsDoc } from "./integrations";
import { settingsDoc } from "./settings";
import type { DocPage } from "../types";

export const ALL_DOCS: Record<string, DocPage> = {
  overview:          overviewDoc,
  dashboard:         dashboardDoc,
  search:            searchDoc,
  company:           companyDoc,
  "saved-companies": savedCompaniesDoc,
  "saved-searches":  savedSearchesDoc,
  triggers:          triggersDoc,
  todos:             todosDoc,
  exports:           exportsDoc,
  integrations:      integrationsDoc,
  settings:          settingsDoc,
};
