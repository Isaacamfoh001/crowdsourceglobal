import { notFound } from "next/navigation";
import { Phone, MessageCircle, Mail, ExternalLink, MapPin } from "lucide-react";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { talentService, TALENT_SKILL_LABELS, TALENT_STATUS_LABELS, TALENT_EXPERIENCE_LABELS, TALENT_AVAILABILITY_LABELS, TALENT_OPPORTUNITY_LABELS, TALENT_WORK_STATUS_LABELS, TALENT_CLOSE_OUTCOME_LABELS } from "../../../../../modules/talent/service";
import { TalentStatusBadge } from "../../../../../components/talent/TalentStatusBadge";
import { StartReviewButton, ShortlistButton, MarkReferredButton, CloseApplicationForm, AddTalentNoteForm } from "../../../../../components/talent/TalentActions";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { BackLink } from "../../../../../components/ui/BackLink";
import { normalizeGhanaPhone } from "../../../../../lib/phone";

type Params = { id: string };

const ADMIN_OPS_ROLES = ["SUPER_ADMIN", "OPS_ADMIN"] as const;

export const metadata = { title: "Application — Beauty Talent — Admin" };
export const dynamic = "force-dynamic";

function formatDateTime(date: Date) {
  return (
    date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " " +
    date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

export default async function AdminTalentDetailPage({ params }: { params: Promise<Params> }) {
  await requireAdminSession("/admin/talent", [...ADMIN_OPS_ROLES]);
  const { id } = await params;
  const application = await talentService.getForAdmin(id);
  if (!application) notFound();

  const normalizedPhone = normalizeGhanaPhone(application.phone);
  const whatsappHref = normalizedPhone ? `https://wa.me/233${normalizedPhone.slice(1)}` : null;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/admin/talent" label="Back to Beauty Talent" />

      <PageHeader
        title={application.fullName}
        description={`${application.applicationNumber} · Submitted ${formatDateTime(application.submittedAt)}`}
        actions={<TalentStatusBadge status={application.status} label={TALENT_STATUS_LABELS[application.status]} />}
      />

      <div className="grid gap-8 border-t border-ivory-300 pt-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col divide-y divide-ivory-200">
          {/* Identity */}
          <div className="pb-6 first:pt-0">
            <h2 className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">Applicant</h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <a href={`tel:${application.phone}`} className="flex items-center gap-1.5 font-medium text-espresso-800 hover:underline">
                <Phone className="size-3.5" strokeWidth={1.75} />
                {application.phone}
              </a>
              {whatsappHref ? (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-medium text-espresso-800 hover:underline">
                  <MessageCircle className="size-3.5" strokeWidth={1.75} />
                  WhatsApp
                </a>
              ) : null}
              {application.email ? (
                <a href={`mailto:${application.email}`} className="flex items-center gap-1.5 font-medium text-espresso-800 hover:underline">
                  <Mail className="size-3.5" strokeWidth={1.75} />
                  {application.email}
                </a>
              ) : null}
              <span className="flex items-center gap-1.5 text-espresso-900/65">
                <MapPin className="size-3.5 text-espresso-900/40" strokeWidth={1.75} />
                {application.city}
                {application.region ? `, ${application.region}` : ""}
              </span>
            </div>
          </div>

          {/* Skills & opportunity */}
          <div className="py-6">
            <h2 className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">Skills &amp; opportunity</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-espresso-900/50">Skills</p>
                <p className="mt-0.5 text-sm font-medium text-espresso-950">
                  {application.skills.map((s) => TALENT_SKILL_LABELS[s]).join(", ")}
                  {application.otherSkillDescription ? ` (${application.otherSkillDescription})` : ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-espresso-900/50">Experience</p>
                <p className="mt-0.5 text-sm font-medium text-espresso-950">{TALENT_EXPERIENCE_LABELS[application.experienceLevel]}</p>
              </div>
              <div>
                <p className="text-xs text-espresso-900/50">Looking for</p>
                <p className="mt-0.5 text-sm font-medium text-espresso-950">
                  {application.opportunityTypes.map((o) => TALENT_OPPORTUNITY_LABELS[o]).join(", ")}
                </p>
              </div>
              <div>
                <p className="text-xs text-espresso-900/50">Availability</p>
                <p className="mt-0.5 text-sm font-medium text-espresso-950">{TALENT_AVAILABILITY_LABELS[application.availability]}</p>
              </div>
              <div>
                <p className="text-xs text-espresso-900/50">Current work status</p>
                <p className="mt-0.5 text-sm font-medium text-espresso-950">{TALENT_WORK_STATUS_LABELS[application.currentWorkStatus]}</p>
              </div>
              <div>
                <p className="text-xs text-espresso-900/50">Willing to relocate</p>
                <p className="mt-0.5 text-sm font-medium text-espresso-950">
                  {application.willingToRelocate ? "Yes" : "No"}
                  {application.preferredWorkLocation ? ` · ${application.preferredWorkLocation}` : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Statement */}
          <div className="py-6">
            <h2 className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">Applicant statement</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-espresso-800">{application.statement}</p>
          </div>

          {/* Work samples */}
          <div className="py-6">
            <h2 className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">
              Work samples ({application.workSamples.length})
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {application.workSamples.map((sample) => (
                <li key={sample.id}>
                  <a
                    href={`/api/talent/work-samples/${sample.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block aspect-square overflow-hidden rounded-lg border border-ivory-300 bg-ivory-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin-authenticated private storage route, not Next's image optimizer */}
                    <img
                      src={`/api/talent/work-samples/${sample.id}`}
                      alt={sample.caption ?? "Work sample"}
                      className="size-full object-cover transition-transform group-hover:scale-105"
                    />
                  </a>
                  {sample.caption ? <p className="mt-1 truncate text-xs text-espresso-900/50">{sample.caption}</p> : null}
                </li>
              ))}
            </ul>
          </div>

          {/* Portfolio link */}
          {application.portfolioUrl ? (
            <div className="py-6 last:pb-0">
              <h2 className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">Portfolio</h2>
              <a
                href={application.portfolioUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-2 flex w-fit items-center gap-1.5 text-sm font-medium text-espresso-800 hover:underline"
              >
                View portfolio
                <ExternalLink className="size-3.5" strokeWidth={1.75} />
              </a>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col divide-y divide-ivory-200 lg:border-l lg:border-ivory-200 lg:pl-8">
          {/* Next action */}
          <div className="pb-6 first:pt-0">
            <h2 className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">Next action</h2>
            <div className="mt-3 flex flex-col items-start gap-3">
              {application.status === "NEW" ? <StartReviewButton id={application.id} /> : null}
              {application.status === "REVIEWING" ? (
                <>
                  <ShortlistButton id={application.id} />
                  <CloseApplicationForm id={application.id} />
                </>
              ) : null}
              {application.status === "SHORTLISTED" ? (
                <>
                  <MarkReferredButton id={application.id} />
                  <CloseApplicationForm id={application.id} />
                </>
              ) : null}
              {application.status === "REFERRED" ? <CloseApplicationForm id={application.id} /> : null}
              {application.status === "CLOSED" ? (
                <p className="text-sm text-espresso-900/50">
                  Closed{application.closeOutcome ? ` — ${TALENT_CLOSE_OUTCOME_LABELS[application.closeOutcome]}` : ""}.
                </p>
              ) : null}
            </div>
            {application.statusUpdatedAt ? (
              <p className="mt-3 text-xs text-espresso-900/35">
                Last updated {formatDateTime(application.statusUpdatedAt)}
                {application.statusUpdatedByName ? ` by ${application.statusUpdatedByName}` : ""}
              </p>
            ) : null}
          </div>

          {/* Internal notes */}
          <div className="pt-6 last:pb-0">
            <h2 className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">Internal notes</h2>
            <p className="mt-1 text-xs text-espresso-900/40">Staff-only — never visible to the applicant.</p>
            {application.notes.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-3">
                {application.notes.map((note) => (
                  <li key={note.id} className="text-sm">
                    <p className="text-espresso-800">{note.note}</p>
                    <p className="mt-0.5 text-xs text-espresso-900/35">
                      {note.authorName} · {formatDateTime(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4">
              <AddTalentNoteForm id={application.id} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
