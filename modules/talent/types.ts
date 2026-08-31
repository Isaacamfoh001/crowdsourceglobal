export type TalentApplicationStatus = "NEW" | "REVIEWING" | "SHORTLISTED" | "REFERRED" | "CLOSED";
export type TalentCloseOutcome = "PLACED" | "NOT_SELECTED" | "WITHDRAWN" | "OTHER";

export type TalentSkill =
  | "HAIRDRESSING"
  | "WIG_MAKING"
  | "WIG_INSTALLATION"
  | "BRAIDING"
  | "HAIR_COLOURING_TREATMENT"
  | "MAKEUP_ARTISTRY"
  | "LASH_EXTENSIONS"
  | "BROWS"
  | "MANICURE_PEDICURE"
  | "NAIL_TECHNOLOGY"
  | "BARBERING"
  | "SKINCARE_BEAUTY_THERAPY"
  | "SALON_ASSISTANT"
  | "BEAUTY_RETAIL_SALES"
  | "OTHER";

export type TalentExperienceLevel = "JUST_STARTING" | "UNDER_1_YEAR" | "ONE_TO_TWO_YEARS" | "THREE_TO_FIVE_YEARS" | "FIVE_PLUS_YEARS";
export type TalentAvailability = "IMMEDIATELY" | "WITHIN_2_WEEKS" | "WITHIN_1_MONTH" | "JUST_EXPLORING";
export type TalentOpportunityType = "FULL_TIME" | "PART_TIME" | "APPRENTICESHIP" | "CONTRACT_FREELANCE" | "OPEN_TO_ANY";
export type TalentWorkStatus = "NOT_WORKING" | "FULL_TIME_EMPLOYED" | "PART_TIME_EMPLOYED" | "FREELANCE_SELF_EMPLOYED" | "APPRENTICE_TRAINEE" | "OTHER";

export type TalentWorkSampleInput = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  caption?: string;
};

export type TalentApplicationInput = {
  fullName: string;
  phone: string;
  email?: string;
  city: string;
  region?: string;
  currentWorkStatus: TalentWorkStatus;
  experienceLevel: TalentExperienceLevel;
  availability: TalentAvailability;
  skills: TalentSkill[];
  otherSkillDescription?: string;
  opportunityTypes: TalentOpportunityType[];
  willingToRelocate: boolean;
  preferredWorkLocation?: string;
  statement: string;
  portfolioUrl?: string;
  portfolioLinks?: string[];
  ownershipConfirmed: boolean;
};

export type TalentWorkSampleView = {
  id: string;
  caption: string | null;
  mimeType: string;
  createdAt: Date;
};

// --- Admin/staff-only --------------------------------------------------

export type AdminTalentApplicationSummaryView = {
  id: string;
  applicationNumber: string;
  fullName: string;
  city: string;
  region: string | null;
  skills: TalentSkill[];
  experienceLevel: TalentExperienceLevel;
  opportunityTypes: TalentOpportunityType[];
  workSampleCount: number;
  submittedAt: Date;
  status: TalentApplicationStatus;
};

export type AdminTalentApplicationNoteView = {
  id: string;
  note: string;
  authorName: string;
  createdAt: Date;
};

export type AdminTalentApplicationDetailView = {
  id: string;
  applicationNumber: string;
  fullName: string;
  phone: string;
  email: string | null;
  city: string;
  region: string | null;
  currentWorkStatus: TalentWorkStatus;
  experienceLevel: TalentExperienceLevel;
  availability: TalentAvailability;
  skills: TalentSkill[];
  otherSkillDescription: string | null;
  opportunityTypes: TalentOpportunityType[];
  willingToRelocate: boolean;
  preferredWorkLocation: string | null;
  statement: string;
  portfolioUrl: string | null;
  portfolioLinks: string[];
  status: TalentApplicationStatus;
  closeOutcome: TalentCloseOutcome | null;
  statusUpdatedAt: Date | null;
  statusUpdatedByName: string | null;
  submittedAt: Date;
  workSamples: TalentWorkSampleView[];
  notes: AdminTalentApplicationNoteView[];
};

export type AdminTalentListFilter = {
  status?: TalentApplicationStatus;
  skill?: TalentSkill;
  search?: string;
};
