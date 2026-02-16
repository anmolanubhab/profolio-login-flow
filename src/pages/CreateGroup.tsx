import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { secureUpload } from "@/lib/secure-upload";
import { supabase } from "@/integrations/supabase/client";
import { ImagePlus, Loader2, X } from "lucide-react";

const INDUSTRY_OPTIONS = [
  "Information Technology",
  "Software Development",
  "Design",
  "Finance",
  "HR & Recruitment",
  "Marketing & Advertising",
  "Education",
  "Healthcare",
  "Manufacturing",
  "Sales",
  "Operations",
  "Consulting",
];

const MAX_NAME = 100;
const MAX_DESCRIPTION = 2000;
const MAX_RULES = 4000;
const MAX_INDUSTRIES = 3;

const CreateGroup = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industryQuery, setIndustryQuery] = useState("");
  const [industries, setIndustries] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [rules, setRules] = useState("");
  const [groupType, setGroupType] = useState<"public" | "private">("public");
  const [allowMemberInvites, setAllowMemberInvites] = useState(true);
  const [requirePostApproval, setRequirePostApproval] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleLogoChange = (file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Logo must be 5MB or smaller.");
      return;
    }
    setUploadError(null);
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLogoChange(file);
    }
  };

  const filteredIndustryOptions = INDUSTRY_OPTIONS.filter((opt) =>
    opt.toLowerCase().includes(industryQuery.toLowerCase())
  ).slice(0, 8);

  const toggleIndustry = (value: string) => {
    if (industries.includes(value)) {
      setIndustries(industries.filter((i) => i !== value));
      return;
    }
    if (industries.length >= MAX_INDUSTRIES) return;
    setIndustries([...industries, value]);
  };

  const canSubmit =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;

      if (logoFile) {
        const uploadResult = await secureUpload({
          bucket: "group-logos",
          file: logoFile,
          userId: user.id,
        });

        if (!uploadResult.success || !uploadResult.url) {
          const msg = (uploadResult.error || "").toLowerCase();
          if (msg.includes("bucket") || msg.includes("not found") || msg.includes("exist")) {
            toast({
              title: "Logo bucket missing",
              description: "Continuing without a logo. You can add one later.",
            });
            imageUrl = null;
          } else {
            throw new Error(uploadResult.error || "Logo upload failed");
          }
        } else {
          imageUrl = uploadResult.url;
        }
      }

      const fullPayload = {
        name: name.trim(),
        description: description.trim(),
        image_url: imageUrl,
        owner_user_id: user.id,
        is_public: groupType === "public",
        industry: industries.length > 0 ? industries : null,
        location: location.trim() || null,
        rules: rules.trim() || null,
        allow_member_invites: allowMemberInvites,
        require_post_approval: requirePostApproval,
      } as any;

      const insertAttempt = await supabase
        .from("groups")
        .insert(fullPayload)
        .select("id")
        .single();

      let newGroupId: string | null = insertAttempt.data?.id || null;

      // Fallback: if column(s) missing in schema, insert minimal set and best-effort update extras
      if (insertAttempt.error && !newGroupId) {
        const msg = (insertAttempt.error.message || "").toLowerCase();
        if (
          msg.includes("column") ||
          msg.includes("schema cache") ||
          msg.includes("does not exist")
        ) {
          const minimalInsert = await supabase
            .from("groups")
            .insert({
              name: name.trim(),
              description: description.trim(),
              image_url: imageUrl,
              owner_user_id: user.id,
            })
            .select("id")
            .single();
          if (minimalInsert.error || !minimalInsert.data?.id) {
            throw minimalInsert.error || new Error("Group creation failed");
          }
          newGroupId = minimalInsert.data.id;
          // Best-effort updates for optional columns
          const tryPatch = async (patch: Record<string, any>) => {
            try {
              await supabase.from("groups").update(patch).eq("id", newGroupId as string);
            } catch {}
          };
          await tryPatch({ is_public: groupType === "public" });
          if (industries.length > 0) await tryPatch({ industry: industries });
          if (location.trim()) await tryPatch({ location: location.trim() });
          if (rules.trim()) await tryPatch({ rules: rules.trim() });
          await tryPatch({ allow_member_invites: allowMemberInvites });
          await tryPatch({ require_post_approval: requirePostApproval });

          toast({
            title: "Created with basic fields",
            description:
              "Backend schema is outdated. Group created without some advanced options. Run the groups enhancements migration to enable all fields.",
          });
        } else {
          throw insertAttempt.error;
        }
      }

      if (newGroupId) {
        try {
          await supabase
            .from("group_members")
            .insert({ group_id: newGroupId, user_id: user.id, role: "owner" });
        } catch {
        }

        toast({
          title: "Group created",
          description: "Your group is ready. Customize it and invite members.",
        });

        navigate(`/groups?group=${newGroupId}`);
      }
    } catch (err: any) {
      toast({
        title: "Unable to create group",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  const discoverabilityText =
    groupType === "public"
      ? "Public groups can appear in Discover and anyone can see member posts."
      : "Private groups are invite-only and member posts stay visible only to members.";

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="min-h-screen bg-white">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12 lg:py-14">
          <header className="mb-8 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#1D2226]">
              Create Group
            </h1>
            <p className="mt-2 text-sm sm:text-base text-[#5E6B7E] max-w-2xl">
              Build a community around your passion, profession, or purpose.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-10">
            <section className="flex flex-col sm:flex-row items-start gap-6">
              <div className="relative">
                <Avatar className="h-24 w-24 sm:h-32 sm:w-32 rounded-full border border-gray-200 shadow-sm">
                  <AvatarImage src={logoPreview || undefined} />
                  <AvatarFallback className="rounded-full bg-gradient-to-br from-[#0077B5]/10 to-[#E1306C]/10 text-[#833AB4] text-2xl">
                    {name.trim().charAt(0).toUpperCase() || "G"}
                  </AvatarFallback>
                </Avatar>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoFile(null);
                      setLogoPreview(null);
                      setUploadError(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm"
                  >
                    <X className="h-3 w-3 text-gray-600" />
                  </button>
                )}
              </div>
              <div className="flex-1">
                <Label className="text-sm font-medium text-[#1D2226]">
                  Group logo
                </Label>
                <p className="text-xs text-[#5E6B7E] mb-3">
                  Upload a square logo. PNG or JPG, up to 5MB.
                </p>
                <div
                  className="border border-dashed border-gray-300 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleLogoChange(file);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
                      <ImagePlus className="h-4 w-4 text-[#0A66C2]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1D2226]">
                        Drag and drop or click to upload
                      </p>
                      <p className="text-xs text-[#5E6B7E]">
                        Recommended 400x400px.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Edit logo
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                </div>
                {uploadError && (
                  <p className="mt-2 text-xs text-red-600">{uploadError}</p>
                )}
              </div>
            </section>

            <section className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="group-name" className="text-sm font-medium text-[#1D2226]">
                    Group name *
                  </Label>
                  <span className="text-xs text-[#5E6B7E]">
                    {name.length}/{MAX_NAME}
                  </span>
                </div>
                <Input
                  id="group-name"
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, MAX_NAME);
                    setName(val);
                    if (val.trim().length === 0) {
                      setNameError("Group name is required.");
                    } else {
                      setNameError(null);
                    }
                  }}
                  onBlur={() => {
                    if (name.trim().length === 0) setNameError("Group name is required.");
                  }}
                  placeholder="Example: Product Leaders – India"
                  className="h-11 text-sm"
                />
                {nameError && <p className="mt-1 text-xs text-red-600">{nameError}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="group-description" className="text-sm font-medium text-[#1D2226]">
                    Description *
                  </Label>
                  <span className="text-xs text-[#5E6B7E]">
                    {description.length}/{MAX_DESCRIPTION}
                  </span>
                </div>
                <Textarea
                  id="group-description"
                  value={description}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, MAX_DESCRIPTION);
                    setDescription(val);
                    const el = e.target as HTMLTextAreaElement;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                    if (val.trim().length === 0) {
                      setDescriptionError("Description is required.");
                    } else {
                      setDescriptionError(null);
                    }
                  }}
                  onBlur={() => {
                    if (description.trim().length === 0) setDescriptionError("Description is required.");
                  }}
                  placeholder="Describe the purpose of this group, who it is for, and how members should engage."
                  className="min-h-[120px] text-sm resize-y"
                />
                {descriptionError && <p className="mt-1 text-xs text-red-600">{descriptionError}</p>}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-[#1D2226]">
                      Industry (up to 3)
                    </Label>
                    <span className="text-xs text-[#5E6B7E]">
                      {industries.length}/{MAX_INDUSTRIES}
                    </span>
                  </div>
                  <Input
                    value={industryQuery}
                    onChange={(e) => setIndustryQuery(e.target.value)}
                    placeholder="Search industries"
                    className="h-9 text-sm"
                  />
                  {industryQuery && (
                    <div className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto bg-white shadow-sm">
                      {filteredIndustryOptions.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          No matches.
                        </div>
                      )}
                      {filteredIndustryOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50"
                          onClick={() => toggleIndustry(opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {industries.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {industries.map((ind) => (
                        <Badge
                          key={ind}
                          variant="secondary"
                          className="flex items-center gap-1 text-xs"
                        >
                          {ind}
                          <button
                            type="button"
                            onClick={() =>
                              setIndustries(industries.filter((i) => i !== ind))
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="group-location" className="text-sm font-medium text-[#1D2226]">
                    Location
                  </Label>
                  <p className="text-xs text-[#5E6B7E] mb-1.5">
                    City, region, or country (optional).
                  </p>
                  <Input
                    id="group-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Example: Bengaluru, India"
                    className="h-11 text-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="group-rules" className="text-sm font-medium text-[#1D2226]">
                    Group rules
                  </Label>
                  <span className="text-xs text-[#5E6B7E]">
                    {rules.length}/{MAX_RULES}
                  </span>
                </div>
                <Textarea
                  id="group-rules"
                  value={rules}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, MAX_RULES);
                    setRules(val);
                    const el = e.target as HTMLTextAreaElement;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                  placeholder="Share guidelines to keep conversations relevant, respectful, and useful."
                  className="min-h-[120px] text-sm resize-y"
                />
              </div>
            </section>

            <section className="grid gap-8 md:grid-cols-2">
              <div className="space-y-4">
                <Label className="text-sm font-medium text-[#1D2226]">
                  Group type
                </Label>
                <RadioGroup
                  value={groupType}
                  onValueChange={(value) =>
                    setGroupType(value as "public" | "private")
                  }
                  className="gap-3"
                >
                  <div className="flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-3">
                    <RadioGroupItem value="public" id="type-public" className="mt-1" />
                    <div>
                      <Label
                        htmlFor="type-public"
                        className="text-sm font-medium text-[#1D2226]"
                      >
                        Public
                      </Label>
                      <p className="text-xs text-[#5E6B7E] mt-0.5">
                        Anyone can find the group, see its members, and view posts.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-3">
                    <RadioGroupItem value="private" id="type-private" className="mt-1" />
                    <div>
                      <Label
                        htmlFor="type-private"
                        className="text-sm font-medium text-[#1D2226]"
                      >
                        Private
                      </Label>
                      <p className="text-xs text-[#5E6B7E] mt-0.5">
                        Only members can see posts. Group can be hidden from Discover.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-medium text-[#1D2226]">
                  Discoverability
                </Label>
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-xs text-[#5E6B7E]">
                  {discoverabilityText}
                </div>

                <div className="mt-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#1D2226]">
                        Allow member invites
                      </p>
                      <p className="text-xs text-[#5E6B7E]">
                        Let members invite their connections to join this group.
                      </p>
                    </div>
                    <Switch
                      checked={allowMemberInvites}
                      onCheckedChange={setAllowMemberInvites}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#1D2226]">
                        Require post approval
                      </p>
                      <p className="text-xs text-[#5E6B7E]">
                        New posts must be approved by admins before they are visible.
                      </p>
                    </div>
                    <Switch
                      checked={requirePostApproval}
                      onCheckedChange={setRequirePostApproval}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-[#5E6B7E]">
                By creating a group, you agree to follow community policies and keep
                discussions professional.
              </p>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto rounded-full"
                  onClick={() => navigate("/groups")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full sm:w-auto rounded-full bg-[#0A66C2] hover:bg-[#004182] text-white px-8"
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create
                </Button>
              </div>
            </section>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default CreateGroup;
