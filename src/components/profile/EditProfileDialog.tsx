import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from "@/components/ui/responsive-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ProfileRow } from "@/components/profile/profileTypes";

const BIO_MAX = 2600;
const HEADLINE_MAX = 220;

const optionalUrl = z
  .string()
  .trim()
  .max(300, "Too long")
  .refine(
    (v) => v === "" || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(v),
    "Enter a valid URL"
  )
  .optional()
  .or(z.literal(""));

const schema = z.object({
  display_name: z.string().trim().max(100, "Max 100 characters").optional().or(z.literal("")),
  full_name: z.string().trim().max(120, "Max 120 characters").optional().or(z.literal("")),
  headline: z.string().trim().max(HEADLINE_MAX, `Max ${HEADLINE_MAX} characters`).optional().or(z.literal("")),
  pronouns: z.string().trim().max(40, "Max 40 characters").optional().or(z.literal("")),
  location: z.string().trim().max(100, "Max 100 characters").optional().or(z.literal("")),
  bio: z.string().trim().max(BIO_MAX, `Max ${BIO_MAX} characters`).optional().or(z.literal("")),
  phone: z.string().trim().max(40, "Max 40 characters").optional().or(z.literal("")),
  address: z.string().trim().max(200, "Max 200 characters").optional().or(z.literal("")),
  website: optionalUrl,
  linkedin_url: optionalUrl,
  github_url: optionalUrl,
  twitter_url: optionalUrl,
  profile_visibility: z.enum(["public", "connections_only", "private"]),
  email_visibility: z.enum(["public", "connections_only", "private"]),
  phone_visibility: z.enum(["public", "connections_only", "private"]),
  open_to_work: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileRow;
  /** profiles.user_id — target row for the update */
  profileUserId: string;
  onSaved: (patch: Partial<ProfileRow>) => void;
  /** which tab to land on ("basics" default) — used by Profile Strength
   *  recommendations so "Add contact details" opens straight on Contact */
  initialTab?: "basics" | "contact" | "visibility";
}

function toDefaults(p: ProfileRow): FormValues {
  return {
    display_name: p.display_name ?? "",
    full_name: p.full_name ?? "",
    headline: p.headline ?? p.profession ?? "",
    pronouns: p.pronouns ?? "",
    location: p.location ?? "",
    bio: p.bio ?? "",
    phone: p.phone ?? "",
    address: p.address ?? "",
    website: p.website ?? "",
    linkedin_url: p.linkedin_url ?? "",
    github_url: p.github_url ?? "",
    twitter_url: p.twitter_url ?? "",
    profile_visibility:
      (p.profile_visibility as FormValues["profile_visibility"]) ?? "public",
    email_visibility:
      (p.email_visibility as FormValues["email_visibility"]) ?? "private",
    phone_visibility:
      (p.phone_visibility as FormValues["phone_visibility"]) ?? "private",
    open_to_work: Boolean(p.open_to_work),
  };
}

const VIS_LABELS: { value: FormValues["email_visibility"]; label: string }[] = [
  { value: "private", label: "Only me" },
  { value: "connections_only", label: "Connections only" },
  { value: "public", label: "Anyone" },
];

export const EditProfileDialog = ({
  open,
  onOpenChange,
  profile,
  profileUserId,
  onSaved,
  initialTab = "basics",
}: EditProfileDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(profile),
  });

  // re-seed when the dialog re-opens or the underlying profile changes
  useEffect(() => {
    if (open) reset(toDefaults(profile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile.id]);

  const bioValue = watch("bio") ?? "";
  const headlineValue = watch("headline") ?? "";
  const visibility = watch("profile_visibility");
  const emailVis = watch("email_visibility");
  const phoneVis = watch("phone_visibility");
  const openToWork = watch("open_to_work");

  const requestClose = () => {
    if (isDirty && !saving) {
      setConfirmDiscardOpen(true);
    } else {
      onOpenChange(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const norm = (s: string) => {
        const t = s.trim();
        return t.length ? t : null;
      };
      const patch: Partial<ProfileRow> = {
        display_name: norm(values.display_name ?? ""),
        full_name: norm(values.full_name ?? ""),
        headline: norm(values.headline ?? ""),
        // keep legacy `profession` in sync so older views stay correct
        profession: norm(values.headline ?? ""),
        pronouns: norm(values.pronouns ?? ""),
        location: norm(values.location ?? ""),
        bio: norm(values.bio ?? ""),
        phone: norm(values.phone ?? ""),
        address: norm(values.address ?? ""),
        website: norm(values.website ?? ""),
        linkedin_url: norm(values.linkedin_url ?? ""),
        github_url: norm(values.github_url ?? ""),
        twitter_url: norm(values.twitter_url ?? ""),
        profile_visibility: values.profile_visibility,
        email_visibility: values.email_visibility,
        phone_visibility: values.phone_visibility,
        open_to_work: values.open_to_work,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", profileUserId);
      if (error) throw error;

      onSaved(patch);
      toast({ title: "Profile updated" });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Couldn’t save",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (name: keyof FormValues) =>
    errors[name] ? (
      <p className="text-xs text-destructive mt-1">
        {errors[name]?.message as string}
      </p>
    ) : null;

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
          else onOpenChange(true);
        }}
      >
        <ResponsiveModalContent
          className="sm:max-w-2xl"
          onInteractOutside={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
        >
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>Edit profile</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Changes are saved to your Profolio profile.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Tabs key={initialTab} defaultValue={initialTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basics">Basics</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="visibility">Visibility</TabsTrigger>
              </TabsList>

              {/* BASICS -------------------------------------------------- */}
              <TabsContent value="basics" className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="display_name">Display name</Label>
                  <Input id="display_name" {...register("display_name")} placeholder="How your name appears" />
                  {fieldError("display_name")}
                </div>
                <div>
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" {...register("full_name")} placeholder="Legal / full name" />
                  {fieldError("full_name")}
                </div>
                <div>
                  <Label htmlFor="headline">Headline</Label>
                  <Textarea
                    id="headline"
                    rows={2}
                    {...register("headline")}
                    placeholder="e.g. Senior Product Designer at Acme · ex-Google"
                  />
                  <div className="flex justify-between">
                    {fieldError("headline") ?? <span />}
                    <span className="text-xs text-muted-foreground mt-1">
                      {headlineValue.length}/{HEADLINE_MAX}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pronouns">Pronouns</Label>
                    <Input id="pronouns" {...register("pronouns")} placeholder="she/her, he/him, they/them" />
                    {fieldError("pronouns")}
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" {...register("location")} placeholder="City, Country" />
                    {fieldError("location")}
                  </div>
                </div>
                <div>
                  <Label htmlFor="bio">About</Label>
                  <Textarea
                    id="bio"
                    rows={6}
                    {...register("bio")}
                    placeholder="Tell people about your work, experience and interests…"
                  />
                  <div className="flex justify-between">
                    {fieldError("bio") ?? <span />}
                    <span className="text-xs text-muted-foreground mt-1">
                      {bioValue.length}/{BIO_MAX}
                    </span>
                  </div>
                </div>
              </TabsContent>

              {/* CONTACT ----------------------------------------------- */}
              <TabsContent value="contact" className="space-y-4 pt-2">
                <div>
                  <Label>Email</Label>
                  <Input value={profile.email ?? ""} disabled readOnly />
                  <p className="text-xs text-muted-foreground mt-1">
                    Email is tied to your account and can’t be changed here.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email_visibility">Email visibility</Label>
                    <Select
                      value={emailVis}
                      onValueChange={(v) =>
                        setValue(
                          "email_visibility",
                          v as FormValues["email_visibility"],
                          { shouldDirty: true }
                        )
                      }
                    >
                      <SelectTrigger id="email_visibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIS_LABELS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" {...register("phone")} placeholder="+1 555 123 4567" />
                    {fieldError("phone")}
                  </div>
                  <div>
                    <Label htmlFor="phone_visibility">Phone visibility</Label>
                    <Select
                      value={phoneVis}
                      onValueChange={(v) =>
                        setValue(
                          "phone_visibility",
                          v as FormValues["phone_visibility"],
                          { shouldDirty: true }
                        )
                      }
                    >
                      <SelectTrigger id="phone_visibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VIS_LABELS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" {...register("address")} placeholder="Street, city…" />
                  {fieldError("address")}
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" {...register("website")} placeholder="https://example.com" />
                  {fieldError("website")}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="linkedin_url">LinkedIn</Label>
                    <Input id="linkedin_url" {...register("linkedin_url")} placeholder="linkedin.com/in/…" />
                    {fieldError("linkedin_url")}
                  </div>
                  <div>
                    <Label htmlFor="github_url">GitHub</Label>
                    <Input id="github_url" {...register("github_url")} placeholder="github.com/…" />
                    {fieldError("github_url")}
                  </div>
                </div>
                <div>
                  <Label htmlFor="twitter_url">X / Twitter</Label>
                  <Input id="twitter_url" {...register("twitter_url")} placeholder="x.com/…" />
                  {fieldError("twitter_url")}
                </div>
                <p className="text-xs text-muted-foreground">
                  Email and phone are only shared according to the visibility
                  you pick above (enforced server-side). Website and social
                  links follow your overall profile visibility.
                </p>
              </TabsContent>

              {/* VISIBILITY ------------------------------------------- */}
              <TabsContent value="visibility" className="space-y-5 pt-2">
                <div>
                  <Label htmlFor="profile_visibility">Profile visibility</Label>
                  <Select
                    value={visibility}
                    onValueChange={(v) =>
                      setValue(
                        "profile_visibility",
                        v as FormValues["profile_visibility"],
                        { shouldDirty: true }
                      )
                    }
                  >
                    <SelectTrigger id="profile_visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public — anyone can view</SelectItem>
                      <SelectItem value="connections_only">
                        Connections only
                      </SelectItem>
                      <SelectItem value="private">Private — only you</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Non-public profiles show a limited header and hide sections
                    from people who aren’t connected.
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="open_to_work">Open to work</Label>
                    <p className="text-xs text-muted-foreground">
                      Shows an “Open to work” badge on your profile.
                    </p>
                  </div>
                  <Switch
                    id="open_to_work"
                    checked={openToWork}
                    onCheckedChange={(c) =>
                      setValue("open_to_work", c, { shouldDirty: true })
                    }
                  />
                </div>
              </TabsContent>
            </Tabs>

            <ResponsiveModalFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={requestClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !isDirty}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </ResponsiveModalFooter>
          </form>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <AlertDialog
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits. If you leave now they’ll be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscardOpen(false);
                onOpenChange(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditProfileDialog;
