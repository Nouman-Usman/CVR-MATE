"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import DashboardLayout from "@/components/dashboard-layout";
import { InlineLoader } from "@/components/loading-screen";
import {
  useFollowedPeople,
  useUnfollowPerson,
} from "@/lib/hooks/use-followed-people";

const avatarGradients = [
  "from-blue-600 to-cyan-500",
  "from-violet-600 to-purple-500",
  "from-amber-500 to-orange-400",
  "from-emerald-600 to-teal-500",
  "from-rose-500 to-pink-400",
  "from-indigo-600 to-blue-500",
];

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(
    locale === "da" ? "da-DK" : "en-US",
    { year: "numeric", month: "short", day: "numeric" }
  );
}

export default function FollowedPeoplePage() {
  const { t, locale } = useLanguage();
  const pf = t.personFollow;
  const { data, isLoading } = useFollowedPeople();
  const unfollowMutation = useUnfollowPerson();

  const people = data?.results ?? [];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-[family-name:var(--font-manrope)]">
          {pf.title}
        </h1>
        <p className="text-sm text-slate-400 mt-1">{pf.subtitle}</p>
      </div>

      {/* Loading skeleton */}
      {isLoading && <InlineLoader />}

      {/* Empty state */}
      {!isLoading && people.length === 0 && (
        <div className="bg-white rounded-2xl py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-slate-200 mb-3 block">
            person_search
          </span>
          <p className="text-slate-500 font-medium">{pf.empty}</p>
          <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            {pf.emptyDesc}
          </p>
        </div>
      )}

      {/* People list */}
      {!isLoading && people.length > 0 && (
        <div className="space-y-3">
          {people.map((person, idx) => {
            const grad = avatarGradients[idx % avatarGradients.length];
            const initials = person.personName
              .split(" ")
              .filter((w) => w.length > 0)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={person.id}
                className="bg-white rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-blue-600/[0.04]"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-center gap-3.5">
                    {/* Avatar */}
                    <Link href={`/person/${person.participantNumber}${person.fromVat ? `?fromVat=${person.fromVat}` : ""}`}>
                      <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm`}
                      >
                        {initials}
                      </div>
                    </Link>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/person/${person.participantNumber}${person.fromVat ? `?fromVat=${person.fromVat}` : ""}`}
                        className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {person.personName}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                        <span className="tabular-nums">
                          #{person.participantNumber}
                        </span>
                        <span className="text-slate-200">·</span>
                        <span>
                          {locale === "da" ? "Fulgt siden" : "Following since"}{" "}
                          {formatDate(person.createdAt, locale)}
                        </span>
                        {person.lastCheckedAt && (
                          <>
                            <span className="text-slate-200">·</span>
                            <span className="inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[11px] text-slate-300">
                                schedule
                              </span>
                              {formatDate(person.lastCheckedAt, locale)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Unfollow button */}
                    <button
                      onClick={() => unfollowMutation.mutate(person.participantNumber)}
                      disabled={unfollowMutation.isPending}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">
                        person_remove
                      </span>
                      <span className="hidden sm:inline">
                        {t.personDetail.unfollow}
                      </span>
                    </button>

                    {/* Arrow */}
                    <Link href={`/person/${person.participantNumber}${person.fromVat ? `?fromVat=${person.fromVat}` : ""}`}>
                      <span className="material-symbols-outlined text-lg text-slate-200 hover:text-blue-500 transition-colors shrink-0">
                        arrow_forward
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
