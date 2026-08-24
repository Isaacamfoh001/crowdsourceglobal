"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Trash2, UploadCloud } from "lucide-react";
import { submitTalentApplicationAction } from "../../lib/actions/talent";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";

const WORK_STATUS_OPTIONS = [
  { value: "NOT_WORKING", label: "Not currently working" },
  { value: "FULL_TIME_EMPLOYED", label: "Currently working full-time" },
  { value: "PART_TIME_EMPLOYED", label: "Currently working part-time" },
  { value: "FREELANCE_SELF_EMPLOYED", label: "Freelancing / self-employed" },
  { value: "APPRENTICE_TRAINEE", label: "Apprentice / trainee" },
  { value: "OTHER", label: "Other" },
];

const AVAILABILITY_OPTIONS = [
  { value: "IMMEDIATELY", label: "Immediately" },
  { value: "WITHIN_2_WEEKS", label: "Within 2 weeks" },
  { value: "WITHIN_1_MONTH", label: "Within 1 month" },
  { value: "JUST_EXPLORING", label: "Just exploring opportunities" },
];

const SKILL_OPTIONS = [
  { value: "HAIRDRESSING", label: "Hairdressing" },
  { value: "WIG_MAKING", label: "Wig Making" },
  { value: "WIG_INSTALLATION", label: "Wig Installation" },
  { value: "BRAIDING", label: "Braiding" },
  { value: "HAIR_COLOURING_TREATMENT", label: "Hair Colouring / Treatment" },
  { value: "MAKEUP_ARTISTRY", label: "Makeup Artistry" },
  { value: "LASH_EXTENSIONS", label: "Lash Extensions" },
  { value: "BROWS", label: "Brows" },
  { value: "MANICURE_PEDICURE", label: "Manicure / Pedicure" },
  { value: "NAIL_TECHNOLOGY", label: "Nail Technology" },
  { value: "BARBERING", label: "Barbering" },
  { value: "SKINCARE_BEAUTY_THERAPY", label: "Skincare / Beauty Therapy" },
  { value: "SALON_ASSISTANT", label: "Salon Assistant" },
  { value: "BEAUTY_RETAIL_SALES", label: "Beauty Retail / Sales" },
  { value: "OTHER", label: "Other" },
];

const EXPERIENCE_OPTIONS = [
  { value: "JUST_STARTING", label: "Just starting" },
  { value: "UNDER_1_YEAR", label: "Less than 1 year" },
  { value: "ONE_TO_TWO_YEARS", label: "1–2 years" },
  { value: "THREE_TO_FIVE_YEARS", label: "3–5 years" },
  { value: "FIVE_PLUS_YEARS", label: "5+ years" },
];

const OPPORTUNITY_OPTIONS = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "APPRENTICESHIP", label: "Internship / Apprenticeship" },
  { value: "CONTRACT_FREELANCE", label: "Contract / Freelance" },
  { value: "OPEN_TO_ANY", label: "Open to any" },
];

const STATEMENT_MAX_LENGTH = 750;
const MIN_PHOTOS = 3;
const MAX_PHOTOS = 8;
const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";

const STEPS = ["About you", "Skills & opportunity", "Show your work"] as const;

function ChipOption({
  type,
  name,
  value,
  label,
  onChange,
  required,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  label: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  /** For a radio group: mark just the first option required — HTML treats that as "one of this named group must be checked". */
  required?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-center rounded-full border border-ivory-300 px-4 py-2.5 text-center text-sm font-medium text-espresso-800 transition-colors has-[:checked]:border-forest-700 has-[:checked]:bg-forest-800 has-[:checked]:text-ivory-50">
      <input type={type} name={name} value={value} onChange={onChange} required={required} className="sr-only" />
      {label}
    </label>
  );
}

export function TalentApplicationForm() {
  const [state, formAction, isPending] = useActionState(submitTalentApplicationAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const step0Ref = useRef<HTMLElement>(null);
  const step1Ref = useRef<HTMLElement>(null);
  const step2Ref = useRef<HTMLElement>(null);
  const stepRefs = [step0Ref, step1Ref, step2Ref];
  const [step, setStep] = useState(0);
  const [showOtherSkill, setShowOtherSkill] = useState(false);
  const [statementLength, setStatementLength] = useState(0);
  const [files, setFiles] = useState<{ file: File; caption: string; preview: string }[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");

  const canGoNext = useMemo(() => step < STEPS.length - 1, [step]);

  function goNext() {
    // Validate only the CURRENT step's fields — form.reportValidity() (and
    // even form.checkValidity()) still considers fields inside a `hidden`
    // sibling <section> as constrained in this environment, which blocked
    // advancing past step 1 entirely. Checking each visible field directly
    // sidesteps that: it never touches the other (hidden) steps' fields.
    const container = stepRefs[step]?.current;
    if (container) {
      const fields = Array.from(container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"));
      for (const field of fields) {
        if (!field.reportValidity()) return;
      }
    }
    if (step === 1) {
      const selectedSkills = container?.querySelectorAll<HTMLInputElement>('input[name="skills"]:checked') ?? [];
      if (selectedSkills.length === 0) {
        setStepError("Select at least one skill.");
        return;
      }
      const selectedOpportunities = container?.querySelectorAll<HTMLInputElement>('input[name="opportunityTypes"]:checked') ?? [];
      if (selectedOpportunities.length === 0) {
        setStepError("Select at least one type of opportunity you're looking for.");
        return;
      }
    }
    setStepError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;

    const room = MAX_PHOTOS - files.length;
    const accepted = selected.slice(0, Math.max(0, room));
    setPhotoError(selected.length > accepted.length ? `You can upload up to ${MAX_PHOTOS} photos.` : null);
    setFiles((prev) => [...prev, ...accepted.map((file) => ({ file, caption: "", preview: URL.createObjectURL(file) }))]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCaption(index: number, caption: string) {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, caption } : f)));
  }

  const readyToSubmit = files.length >= MIN_PHOTOS && files.length <= MAX_PHOTOS;

  if (state?.ok) {
    const firstName = fullName.trim().split(/\s+/)[0] || "there";
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-champagne-700 uppercase">Application received</p>
        <h2 className="font-display text-2xl font-medium text-espresso-950 sm:text-3xl">Thanks, {firstName}.</h2>
        <p className="max-w-md text-[15px] leading-relaxed text-espresso-900/65">
          We&apos;ve received your Beauty Talent application ({state.value.applicationNumber}).
          CrownSourceGlobal will review your details and may contact you if a suitable
          opportunity becomes available.
        </p>
        <Link href="/" className="mt-2">
          <Button size="lg" variant="outline">
            Return home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={(formData) => {
        for (const { file, caption } of files) {
          formData.append("workSamplePhotos", file);
          formData.append("workSampleCaptions", caption);
        }
        return formAction(formData);
      }}
      className="flex flex-col gap-8"
    >
      {/* Progress indicator */}
      <ol className="flex items-center gap-1.5" aria-label="Application progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-1.5">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                index === step
                  ? "bg-forest-800 text-ivory-50"
                  : index < step
                    ? "bg-champagne-200 text-forest-900"
                    : "bg-ivory-200 text-espresso-900/40"
              }`}
              aria-current={index === step ? "step" : undefined}
            >
              {index + 1}
            </span>
            <span className={`hidden text-xs font-medium sm:inline ${index === step ? "text-espresso-950" : "text-espresso-900/45"}`}>
              {label}
            </span>
            {index < STEPS.length - 1 ? <span className="h-px flex-1 bg-ivory-300" aria-hidden /> : null}
          </li>
        ))}
      </ol>

      {state && !state.ok ? <FormMessage tone="error">{state.error}</FormMessage> : null}

      {/* Step 1 — About you */}
      <section ref={step0Ref} hidden={step !== 0} className="flex flex-col gap-5">
        <div>
          <h2 className="font-display text-xl font-medium text-espresso-950">About you</h2>
          <p className="mt-1 text-sm text-espresso-900/50">Tell us who you are and how to reach you.</p>
        </div>
        <Input
          label="Full name"
          name="fullName"
          required
          disabled={isPending}
          autoComplete="name"
          onChange={(e) => setFullName(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Phone / WhatsApp number"
            name="phone"
            type="tel"
            required
            disabled={isPending}
            placeholder="e.g. 024 123 4567"
            autoComplete="tel"
          />
          <Input label="Email (optional)" name="email" type="email" disabled={isPending} autoComplete="email" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="City / town" name="city" required disabled={isPending} placeholder="e.g. Accra" />
          <Input label="Region (optional)" name="region" disabled={isPending} placeholder="e.g. Greater Accra" />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-espresso-800">Current work status</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {WORK_STATUS_OPTIONS.map((option, index) => (
              <ChipOption key={option.value} type="radio" name="currentWorkStatus" value={option.value} label={option.label} required={index === 0} />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-espresso-800">Availability</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AVAILABILITY_OPTIONS.map((option, index) => (
              <ChipOption key={option.value} type="radio" name="availability" value={option.value} label={option.label} required={index === 0} />
            ))}
          </div>
        </fieldset>

        <Button type="button" size="lg" fullWidth onClick={goNext} disabled={!canGoNext}>
          Continue
        </Button>
      </section>

      {/* Step 2 — Skills & opportunity */}
      <section ref={step1Ref} hidden={step !== 1} className="flex flex-col gap-5">
        <div>
          <h2 className="font-display text-xl font-medium text-espresso-950">Skills &amp; opportunity</h2>
          <p className="mt-1 text-sm text-espresso-900/50">Select everything that applies.</p>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-espresso-800">What are your beauty skills?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SKILL_OPTIONS.map((option) => (
              <ChipOption
                key={option.value}
                type="checkbox"
                name="skills"
                value={option.value}
                label={option.label}
                onChange={option.value === "OTHER" ? (e) => setShowOtherSkill(e.target.checked) : undefined}
              />
            ))}
          </div>
          {showOtherSkill ? (
            <div className="mt-3">
              <Input label="What's your other skill?" name="otherSkillDescription" disabled={isPending} />
            </div>
          ) : null}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-espresso-800">Experience level</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {EXPERIENCE_OPTIONS.map((option, index) => (
              <ChipOption key={option.value} type="radio" name="experienceLevel" value={option.value} label={option.label} required={index === 0} />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-espresso-800">What kind of opportunity are you looking for?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {OPPORTUNITY_OPTIONS.map((option) => (
              <ChipOption key={option.value} type="checkbox" name="opportunityTypes" value={option.value} label={option.label} />
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
          <label className="flex items-center gap-2 text-sm font-medium text-espresso-800 sm:pb-3">
            <input type="checkbox" name="willingToRelocate" className="size-4 rounded accent-forest-800" disabled={isPending} />
            Willing to relocate
          </label>
          <Input
            label="Preferred work location (optional)"
            name="preferredWorkLocation"
            placeholder="e.g. Accra, open to Tema"
            disabled={isPending}
          />
        </div>

        <div>
          <Textarea
            label="Tell us a little about yourself and the kind of opportunity you want"
            id="statement"
            name="statement"
            rows={5}
            required
            maxLength={STATEMENT_MAX_LENGTH}
            disabled={isPending}
            placeholder="e.g. I've been braiding and installing wigs for about two years and I'm looking for a full-time role at a salon in Accra."
            onChange={(e) => setStatementLength(e.target.value.length)}
          />
          <p className="mt-1 text-right text-xs text-espresso-900/40">
            {statementLength}/{STATEMENT_MAX_LENGTH}
          </p>
        </div>

        {stepError ? <p className="text-sm text-danger-600">{stepError}</p> : null}

        <div className="flex gap-3">
          <Button type="button" variant="outline" size="lg" onClick={goBack}>
            Back
          </Button>
          <Button type="button" size="lg" fullWidth onClick={goNext}>
            Continue
          </Button>
        </div>
      </section>

      {/* Step 3 — Show your work */}
      <section ref={step2Ref} hidden={step !== 2} className="flex flex-col gap-5">
        <div>
          <h2 className="font-display text-xl font-medium text-espresso-950">Let your work speak</h2>
          <p className="mt-1 text-sm text-espresso-900/50">
            Upload clear photos of work you personally completed. Professional photography isn&apos;t
            required — good lighting and a clear view of the finished work is enough.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-espresso-800">Photos of your work</span>
            <span className="text-xs text-espresso-900/50">
              {files.length} of {MAX_PHOTOS} (minimum {MIN_PHOTOS})
            </span>
          </div>

          {files.length > 0 ? (
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {files.map((item, index) => (
                <li key={index} className="flex flex-col gap-1.5">
                  <div className="group relative aspect-square overflow-hidden rounded-lg border border-ivory-300">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local object-URL preview of a not-yet-uploaded file */}
                    <img src={item.preview} alt="" className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      aria-label="Remove photo"
                      disabled={isPending}
                      className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-ivory-50/90 text-espresso-900/65 shadow-soft hover:text-danger-600 disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.caption}
                    onChange={(e) => updateCaption(index, e.target.value)}
                    placeholder="Caption (optional)"
                    disabled={isPending}
                    className="w-full rounded-lg border border-ivory-400 bg-ivory-50 px-2.5 py-1.5 text-xs text-espresso-950 outline-none focus:border-forest-700 focus:ring-2 focus:ring-champagne-200"
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {files.length < MAX_PHOTOS ? (
            <label className="mt-3 flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ivory-400 bg-ivory-50 px-4 py-2.5 text-sm font-medium text-espresso-800 hover:bg-ivory-100">
              <UploadCloud className="size-4 text-espresso-900/35" strokeWidth={1.75} />
              Choose photos
              <input
                type="file"
                multiple
                accept={ACCEPTED_IMAGE_TYPES}
                onChange={handleFileSelect}
                disabled={isPending}
                className="hidden"
              />
            </label>
          ) : null}
          {photoError ? <p className="mt-2 text-xs text-danger-600">{photoError}</p> : null}
        </div>

        <Input
          label="Portfolio / social link (optional)"
          name="portfolioUrl"
          type="url"
          placeholder="https://instagram.com/yourwork"
          disabled={isPending}
        />

        <label className="flex items-start gap-2.5 text-sm text-espresso-800">
          <input
            type="checkbox"
            name="ownershipConfirmed"
            required
            disabled={isPending}
            className="mt-0.5 size-4 rounded accent-forest-800"
          />
          I confirm that the work samples I uploaded show work I personally completed or contributed to.
        </label>

        <p className="text-xs leading-relaxed text-espresso-900/45">
          By submitting, you understand that CrownSourceGlobal may contact you regarding relevant
          beauty opportunities.
        </p>

        <div className="flex gap-3">
          <Button type="button" variant="outline" size="lg" onClick={goBack} disabled={isPending}>
            Back
          </Button>
          <Button type="submit" size="lg" fullWidth disabled={isPending || !readyToSubmit}>
            {isPending ? "Submitting…" : "Submit application"}
          </Button>
        </div>
        {!readyToSubmit ? (
          <p className="text-center text-xs text-espresso-900/45">
            Upload at least {MIN_PHOTOS} photos to submit.
          </p>
        ) : null}
      </section>
    </form>
  );
}
