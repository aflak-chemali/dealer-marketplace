-- Multi-dealer marketplace (part 2/2): Dealer table, scoping columns,
-- helper functions, triggers, RLS and storage policies, backfill.

-- Dealer table ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."Dealer" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logoUrl" TEXT,
  "coverImageUrl" TEXT,
  "bio" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "whatsappPhone" TEXT,
  "address" TEXT,
  "city" TEXT,
  "status" "DealerStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT "Dealer_ownerId_key" UNIQUE ("ownerId"),
  CONSTRAINT "Dealer_slug_key" UNIQUE ("slug"),
  CONSTRAINT "Dealer_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT "Dealer_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES public."User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Dealer_status_idx" ON public."Dealer"("status");
CREATE INDEX IF NOT EXISTS "Dealer_city_idx" ON public."Dealer"("city");

DROP TRIGGER IF EXISTS set_updated_at_Dealer ON public."Dealer";
CREATE TRIGGER set_updated_at_Dealer
BEFORE UPDATE ON public."Dealer"
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Scoping columns ------------------------------------------------------------
ALTER TABLE public."Car" ADD COLUMN IF NOT EXISTS "dealerId" TEXT
  REFERENCES public."Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Car_dealerId_idx" ON public."Car"("dealerId");

ALTER TABLE public."TestDriveBooking" ADD COLUMN IF NOT EXISTS "dealerId" TEXT
  REFERENCES public."Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "TestDriveBooking_dealerId_idx"
  ON public."TestDriveBooking"("dealerId");

ALTER TABLE public."WorkingHour" ALTER COLUMN "dealershipId" DROP NOT NULL;
ALTER TABLE public."WorkingHour" ADD COLUMN IF NOT EXISTS "dealerId" TEXT
  REFERENCES public."Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "WorkingHour_dealerId_dayOfWeek_key"
  ON public."WorkingHour"("dealerId", "dayOfWeek");

-- Helper functions (SECURITY DEFINER avoids RLS recursion) --------------------
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS TEXT AS $$
  SELECT id FROM public."User" WHERE "supabaseAuthUserId" = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Active dealer owned by the caller (NULL when none or suspended).
CREATE OR REPLACE FUNCTION public.current_dealer_id()
RETURNS TEXT AS $$
  SELECT d.id
  FROM public."Dealer" d
  JOIN public."User" u ON u.id = d."ownerId"
  WHERE u."supabaseAuthUserId" = auth.uid()
    AND d.status = 'ACTIVE'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.dealer_is_active(p_dealer_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Dealer" WHERE id = p_dealer_id AND status = 'ACTIVE'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.owns_dealer(p_dealer_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT p_dealer_id IS NOT NULL AND p_dealer_id = public.current_dealer_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Security fix: users must not be able to change their own role ---------------
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_user IN ('authenticated', 'anon')
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can change user roles';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_role_self_escalation ON public."User";
CREATE TRIGGER prevent_role_self_escalation
BEFORE UPDATE ON public."User"
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_self_escalation();

-- New profiles can never be created with an elevated role by clients.
CREATE OR REPLACE FUNCTION public.prevent_role_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.role := 'USER';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_role_on_insert ON public."User";
CREATE TRIGGER prevent_role_on_insert
BEFORE INSERT ON public."User"
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_on_insert();

-- Only admins may change dealer status or ownership --------------------------
CREATE OR REPLACE FUNCTION public.protect_dealer_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Only administrators can change dealer status';
    END IF;
    IF NEW."ownerId" IS DISTINCT FROM OLD."ownerId" THEN
      RAISE EXCEPTION 'Dealer ownership cannot be changed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_dealer_columns ON public."Dealer";
CREATE TRIGGER protect_dealer_columns
BEFORE UPDATE ON public."Dealer"
FOR EACH ROW
EXECUTE FUNCTION public.protect_dealer_columns();

-- Dealers created by non-admins always start ACTIVE.
CREATE OR REPLACE FUNCTION public.dealer_before_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    NEW.status := 'ACTIVE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dealer_before_insert ON public."Dealer";
CREATE TRIGGER dealer_before_insert
BEFORE INSERT ON public."Dealer"
FOR EACH ROW
EXECUTE FUNCTION public.dealer_before_insert();

-- Promote owner USER -> DEALER after the dealer profile is created.
-- SECURITY DEFINER + runs as the function owner, so the role guard allows it.
CREATE OR REPLACE FUNCTION public.promote_dealer_owner()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public."User"
  SET role = 'DEALER'
  WHERE id = NEW."ownerId" AND role = 'USER';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS promote_dealer_owner ON public."Dealer";
CREATE TRIGGER promote_dealer_owner
AFTER INSERT ON public."Dealer"
FOR EACH ROW
EXECUTE FUNCTION public.promote_dealer_owner();

-- Bookings inherit the car's dealer (clients cannot spoof it).
CREATE OR REPLACE FUNCTION public.booking_set_dealer()
RETURNS TRIGGER AS $$
BEGIN
  SELECT "dealerId" INTO NEW."dealerId" FROM public."Car" WHERE id = NEW."carId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS booking_set_dealer ON public."TestDriveBooking";
CREATE TRIGGER booking_set_dealer
BEFORE INSERT ON public."TestDriveBooking"
FOR EACH ROW
EXECUTE FUNCTION public.booking_set_dealer();

-- Backfill: turn the existing single dealership into the first dealer ----------
DO $$
DECLARE
  v_owner TEXT;
  v_dealer TEXT;
  v_name TEXT;
  v_phone TEXT;
  v_email TEXT;
  v_whatsapp TEXT;
  v_address TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM public."Dealer") THEN
    RETURN;
  END IF;

  SELECT id INTO v_owner FROM public."User"
  WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1;

  IF v_owner IS NULL THEN
    RETURN;
  END IF;

  SELECT name, phone, email, "whatsappPhone", address
  INTO v_name, v_phone, v_email, v_whatsapp, v_address
  FROM public."DealershipInfo" LIMIT 1;

  INSERT INTO public."Dealer" ("ownerId", "name", "slug", "phone", "email",
    "whatsappPhone", "address")
  VALUES (v_owner, COALESCE(v_name, 'My Dealership'), 'main-dealer',
    v_phone, v_email, v_whatsapp, v_address)
  RETURNING id INTO v_dealer;

  UPDATE public."Car" SET "dealerId" = v_dealer WHERE "dealerId" IS NULL;
  UPDATE public."TestDriveBooking" SET "dealerId" = v_dealer
  WHERE "dealerId" IS NULL;

  INSERT INTO public."WorkingHour" ("dealerId", "dayOfWeek", "openTime",
    "closeTime", "isOpen")
  SELECT v_dealer, "dayOfWeek", "openTime", "closeTime", "isOpen"
  FROM public."WorkingHour"
  WHERE "dealershipId" IS NOT NULL AND "dealerId" IS NULL
  ON CONFLICT DO NOTHING;
END $$;

-- RLS: Dealer ----------------------------------------------------------------
ALTER TABLE public."Dealer" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dealers_read" ON public."Dealer";
DROP POLICY IF EXISTS "dealers_insert_self" ON public."Dealer";
DROP POLICY IF EXISTS "dealers_update_owner" ON public."Dealer";
DROP POLICY IF EXISTS "dealers_admin_delete" ON public."Dealer";

CREATE POLICY "dealers_read" ON public."Dealer"
  FOR SELECT TO anon, authenticated
  USING (
    status = 'ACTIVE'
    OR "ownerId" = public.current_app_user_id()
    OR public.is_admin()
  );

CREATE POLICY "dealers_insert_self" ON public."Dealer"
  FOR INSERT TO authenticated
  WITH CHECK ("ownerId" = public.current_app_user_id());

CREATE POLICY "dealers_update_owner" ON public."Dealer"
  FOR UPDATE TO authenticated
  USING ("ownerId" = public.current_app_user_id() OR public.is_admin())
  WITH CHECK ("ownerId" = public.current_app_user_id() OR public.is_admin());

CREATE POLICY "dealers_admin_delete" ON public."Dealer"
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- RLS: Car -------------------------------------------------------------------
DROP POLICY IF EXISTS "cars_public_read" ON public."Car";
DROP POLICY IF EXISTS "cars_admin_insert" ON public."Car";
DROP POLICY IF EXISTS "cars_admin_update" ON public."Car";
DROP POLICY IF EXISTS "cars_admin_delete" ON public."Car";
DROP POLICY IF EXISTS "cars_dealer_insert" ON public."Car";
DROP POLICY IF EXISTS "cars_dealer_update" ON public."Car";
DROP POLICY IF EXISTS "cars_dealer_delete" ON public."Car";

CREATE POLICY "cars_public_read" ON public."Car"
  FOR SELECT TO anon, authenticated
  USING (
    "dealerId" IS NULL
    OR public.dealer_is_active("dealerId")
    OR public.owns_dealer("dealerId")
    OR public.is_admin()
  );

CREATE POLICY "cars_dealer_insert" ON public."Car"
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_dealer("dealerId") OR public.is_admin());

CREATE POLICY "cars_dealer_update" ON public."Car"
  FOR UPDATE TO authenticated
  USING (public.owns_dealer("dealerId") OR public.is_admin())
  WITH CHECK (public.owns_dealer("dealerId") OR public.is_admin());

CREATE POLICY "cars_dealer_delete" ON public."Car"
  FOR DELETE TO authenticated
  USING (public.owns_dealer("dealerId") OR public.is_admin());

-- RLS: TestDriveBooking ------------------------------------------------------
DROP POLICY IF EXISTS "bookings_read" ON public."TestDriveBooking";
DROP POLICY IF EXISTS "bookings_update" ON public."TestDriveBooking";
DROP POLICY IF EXISTS "bookings_delete" ON public."TestDriveBooking";

CREATE POLICY "bookings_read" ON public."TestDriveBooking"
  FOR SELECT TO authenticated
  USING (
    "userId" = public.current_app_user_id()
    OR public.owns_dealer("dealerId")
    OR public.is_admin()
  );

CREATE POLICY "bookings_update" ON public."TestDriveBooking"
  FOR UPDATE TO authenticated
  USING (
    "userId" = public.current_app_user_id()
    OR public.owns_dealer("dealerId")
    OR public.is_admin()
  );

CREATE POLICY "bookings_delete" ON public."TestDriveBooking"
  FOR DELETE TO authenticated
  USING (public.owns_dealer("dealerId") OR public.is_admin());

-- RLS: WorkingHour -----------------------------------------------------------
DROP POLICY IF EXISTS "hours_admin_insert" ON public."WorkingHour";
DROP POLICY IF EXISTS "hours_admin_update" ON public."WorkingHour";
DROP POLICY IF EXISTS "hours_admin_delete" ON public."WorkingHour";
DROP POLICY IF EXISTS "hours_dealer_insert" ON public."WorkingHour";
DROP POLICY IF EXISTS "hours_dealer_update" ON public."WorkingHour";
DROP POLICY IF EXISTS "hours_dealer_delete" ON public."WorkingHour";

CREATE POLICY "hours_dealer_insert" ON public."WorkingHour"
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_dealer("dealerId") OR public.is_admin());

CREATE POLICY "hours_dealer_update" ON public."WorkingHour"
  FOR UPDATE TO authenticated
  USING (public.owns_dealer("dealerId") OR public.is_admin());

CREATE POLICY "hours_dealer_delete" ON public."WorkingHour"
  FOR DELETE TO authenticated
  USING (public.owns_dealer("dealerId") OR public.is_admin());

-- Storage: car images under dealers/{dealerId}/..., plus dealer-assets bucket --
INSERT INTO storage.buckets (id, name, public)
VALUES ('dealer-assets', 'dealer-assets', TRUE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "car_images_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "car_images_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "car_images_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "car_images_dealer_insert" ON storage.objects;
DROP POLICY IF EXISTS "car_images_dealer_update" ON storage.objects;
DROP POLICY IF EXISTS "car_images_dealer_delete" ON storage.objects;
DROP POLICY IF EXISTS "dealer_assets_public_read" ON storage.objects;
DROP POLICY IF EXISTS "dealer_assets_dealer_insert" ON storage.objects;
DROP POLICY IF EXISTS "dealer_assets_dealer_update" ON storage.objects;
DROP POLICY IF EXISTS "dealer_assets_dealer_delete" ON storage.objects;

CREATE POLICY "car_images_dealer_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'car-images'
    AND (
      public.is_admin()
      OR ((storage.foldername(name))[1] = 'dealers'
          AND public.owns_dealer((storage.foldername(name))[2]))
    )
  );

CREATE POLICY "car_images_dealer_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'car-images'
    AND (
      public.is_admin()
      OR ((storage.foldername(name))[1] = 'dealers'
          AND public.owns_dealer((storage.foldername(name))[2]))
    )
  );

CREATE POLICY "car_images_dealer_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'car-images'
    AND (
      public.is_admin()
      OR ((storage.foldername(name))[1] = 'dealers'
          AND public.owns_dealer((storage.foldername(name))[2]))
    )
  );

CREATE POLICY "dealer_assets_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'dealer-assets');

CREATE POLICY "dealer_assets_dealer_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dealer-assets'
    AND (public.is_admin()
         OR public.owns_dealer((storage.foldername(name))[1]))
  );

CREATE POLICY "dealer_assets_dealer_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dealer-assets'
    AND (public.is_admin()
         OR public.owns_dealer((storage.foldername(name))[1]))
  );

CREATE POLICY "dealer_assets_dealer_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'dealer-assets'
    AND (public.is_admin()
         OR public.owns_dealer((storage.foldername(name))[1]))
  );

-- Storage accounting includes dealer logo/cover bytes.
ALTER TABLE public."Dealer" ADD COLUMN IF NOT EXISTS "assetsSizeBytes" BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.get_global_storage_usage()
RETURNS bigint AS $$
  SELECT (
    COALESCE((SELECT SUM("storage_bytes") FROM public."Car"), 0) +
    COALESCE((SELECT SUM("logoSizeBytes") FROM public."DealershipInfo"), 0) +
    COALESCE((SELECT SUM("assetsSizeBytes") FROM public."Dealer"), 0)
  )::bigint;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
