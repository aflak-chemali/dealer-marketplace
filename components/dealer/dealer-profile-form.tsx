"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Loader2, Save, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { becomeDealer } from "@/actions/dealers/become-dealer";
import type { MyDealer } from "@/actions/dealers/get-my-dealer";
import { updateMyDealer } from "@/actions/dealers/update-my-dealer";
import { uploadDealerImage } from "@/actions/dealers/upload-dealer-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/config/routes";
import { compressImage } from "@/lib/helpers/compress-image";
import {
  type DealerProfileFormData,
  dealerProfileSchema,
  slugifyDealerName,
} from "@/schemas/dealer/dealer-profile.schema";

/**
 * Props for {@link DealerProfileForm}.
 */
interface DealerProfileFormProps {
  /** Existing dealer profile when editing; omit to create a new one. */
  dealer?: MyDealer | null;
  /** Called after a successful save. */
  onSaved?: () => void;
}

type FieldName = keyof DealerProfileFormData;

const TEXT_FIELDS: Array<{
  name: FieldName;
  label: string;
  placeholder: string;
  type?: string;
}> = [
  { name: "city", label: "City", placeholder: "Beirut" },
  { name: "address", label: "Address", placeholder: "Street, building" },
  { name: "phone", label: "Phone", placeholder: "+961 1 234 567", type: "tel" },
  {
    name: "whatsappPhone",
    label: "WhatsApp",
    placeholder: "+961 70 123 456",
    type: "tel",
  },
  {
    name: "email",
    label: "Contact email",
    placeholder: "sales@example.com",
    type: "email",
  },
];

/**
 * Create / edit form for a marketplace dealer profile. In edit mode it also
 * lets the dealer upload a logo and a cover image (compressed client-side).
 *
 * @param dealer - Existing profile to edit
 * @param onSaved - Callback after saving
 */
export function DealerProfileForm({ dealer, onSaved }: DealerProfileFormProps) {
  const router = useRouter();
  const isEdit = !!dealer;
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const [logoUrl, setLogoUrl] = useState(dealer?.logoUrl ?? null);
  const [coverUrl, setCoverUrl] = useState(dealer?.coverImageUrl ?? null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DealerProfileFormData>({
    resolver: zodResolver(dealerProfileSchema),
    defaultValues: {
      name: dealer?.name ?? "",
      slug: dealer?.slug ?? "",
      bio: dealer?.bio ?? "",
      phone: dealer?.phone ?? "",
      whatsappPhone: dealer?.whatsappPhone ?? "",
      email: dealer?.email ?? "",
      address: dealer?.address ?? "",
      city: dealer?.city ?? "",
    },
  });

  const slug = watch("slug");
  const nameField = register("name");
  const slugField = register("slug");

  const onSubmit = async (values: DealerProfileFormData) => {
    setSaving(true);
    try {
      const result = isEdit
        ? await updateMyDealer(values)
        : await becomeDealer(values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Dealer profile saved" : "Welcome aboard!");
      onSaved?.();
      if (!isEdit) {
        router.push(ROUTES.ADMIN.ADMIN_SETTINGS);
      }
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleImage =
    (kind: "logo" | "cover") => async (e: ChangeEvent<HTMLInputElement>) => {
      const original = e.target.files?.[0];
      e.target.value = "";
      if (!original) return;

      setUploading(kind);
      try {
        const file = await compressImage(original, {
          maxDimension: kind === "logo" ? 512 : 1600,
        });
        const formData = new FormData();
        formData.append("kind", kind);
        formData.append("file", file);
        const result = await uploadDealerImage(formData);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        if (kind === "logo") setLogoUrl(result.data.url);
        else setCoverUrl(result.data.url);
        toast.success(kind === "logo" ? "Logo updated" : "Cover updated");
        router.refresh();
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setUploading(null);
      }
    };

  return (
    <div className="space-y-6">
      {isEdit && (
        <div className="space-y-3">
          <div className="relative h-36 overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-indigo-500 md:h-48">
            {coverUrl && (
              <Image
                src={coverUrl}
                alt="Cover"
                fill
                sizes="100vw"
                className="object-cover"
              />
            )}
            <Label className="absolute right-3 bottom-3 flex cursor-pointer items-center gap-2 rounded-md bg-white/90 px-3 py-1.5 text-sm shadow hover:bg-white">
              {uploading === "cover" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              Change cover
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImage("cover")}
                disabled={!!uploading}
              />
            </Label>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-white">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Logo"
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <Store className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <Label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
              {uploading === "logo" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              Change logo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImage("logo")}
                disabled={!!uploading}
              />
            </Label>
            {dealer?.slug && (
              <Link
                href={ROUTES.DEALER_PROFILE(dealer.slug)}
                className="ml-auto text-blue-600 text-sm hover:underline"
                target="_blank"
              >
                View public profile
              </Link>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dealer-name">Dealer name</Label>
            <Input
              id="dealer-name"
              placeholder="Acme Motors"
              {...nameField}
              onChange={(e) => {
                nameField.onChange(e);
                if (!slugTouched) {
                  setValue("slug", slugifyDealerName(e.target.value), {
                    shouldValidate: true,
                  });
                }
              }}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-red-500 text-xs">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dealer-slug">Profile URL</Label>
            <Input
              id="dealer-slug"
              placeholder="acme-motors"
              {...slugField}
              onChange={(e) => {
                setSlugTouched(true);
                slugField.onChange(e);
              }}
              className={errors.slug ? "border-red-500" : ""}
            />
            <p className="text-gray-500 text-xs">
              {ROUTES.DEALERS}/{slug || "your-name"}
            </p>
            {errors.slug && (
              <p className="text-red-500 text-xs">{errors.slug.message}</p>
            )}
          </div>
          {TEXT_FIELDS.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={`dealer-${field.name}`}>{field.label}</Label>
              <Input
                id={`dealer-${field.name}`}
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                {...register(field.name)}
                className={errors[field.name] ? "border-red-500" : ""}
              />
              {errors[field.name] && (
                <p className="text-red-500 text-xs">
                  {errors[field.name]?.message}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="dealer-bio">About</Label>
          <Textarea
            id="dealer-bio"
            rows={4}
            placeholder="Tell buyers about your dealership"
            {...register("bio")}
            className={errors.bio ? "border-red-500" : ""}
          />
          {errors.bio && (
            <p className="text-red-500 text-xs">{errors.bio.message}</p>
          )}
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isEdit ? "Save profile" : "Create dealer profile"}
          </Button>
        </div>
      </form>
    </div>
  );
}
