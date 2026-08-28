-- M22.1: BeautyProfessionalProfile.heroImageUrl -> heroImage
-- Field now stores an M13 StorageProvider key (real Choose/Take Photo
-- upload), never a pasted external URL — see prisma/schema.prisma's
-- BeautyProfessionalProfile doc comment. A pasted-URL value is not a valid
-- storage key, so this is a genuine semantic change, not a pure rename:
-- any existing value is dropped rather than reinterpreted as a key.
ALTER TABLE "beauty_professional_profile" DROP COLUMN "heroImageUrl";
ALTER TABLE "beauty_professional_profile" ADD COLUMN "heroImage" TEXT;
