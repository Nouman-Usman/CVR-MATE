"use client"

import { Lock, Mail } from "lucide-react"
import { CONTACT_EMAIL, type ComingSoonFeature } from "@/lib/constants"

export function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
      Coming Soon
    </span>
  )
}

interface ComingSoonOverlayProps {
  feature: ComingSoonFeature
  description?: string
}

export function ComingSoonOverlay({ feature, description }: ComingSoonOverlayProps) {
  const titles: Record<ComingSoonFeature, string> = {
    team: "Team Features Coming Soon",
    crm: "CRM Integrations Coming Soon",
  }

  const defaultDescriptions: Record<ComingSoonFeature, string> = {
    team: "Team workspaces, role-based access, and audit logging are coming soon.",
    crm: "HubSpot, Pipedrive, and LeadConnector integrations are coming soon.",
  }

  const subject = `CVR-MATE ${feature === "team" ? "Team Features" : "CRM Integration"} Inquiry`

  return (
    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-50/95 to-amber-100/95 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center space-y-4 px-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-amber-200 p-3">
            <Lock className="w-6 h-6 text-amber-700" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-amber-900">{titles[feature]}</h3>
        <p className="text-sm text-amber-800">{description || defaultDescriptions[feature]}</p>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 transition-colors"
        >
          <Mail className="w-4 h-4" />
          Contact us
        </a>
      </div>
    </div>
  )
}
