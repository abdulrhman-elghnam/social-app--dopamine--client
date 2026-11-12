import { router, Stack } from "expo-router";
import {
  Button,
  FieldError,
  Label,
  Radio,
  RadioGroup,
  TextArea,
  TextField,
  Description,
  useToast,
} from "heroui-native";
import { useState, type JSX } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { userApi } from "../../api/posts";
import type { Gender, UpdateProfileInput, UserProfile } from "../../api/types";
import { DateField } from "../../component/date-field";
import { FormField } from "../../component/form-field";
import { LoadingView } from "../../component/state-views";
import { useAuth } from "../../context/auth-context";
import { schemas, validateForm } from "../../lib/validation";
import { ApiError, errorMessage } from "../../services/api";

interface Form {
  firstName: string;
  lastName: string;
  username: string;
  bio: string;
  phone: string;
  DOB: string;
  gender: Gender | "";
}

const BIO_MAX = 500;

function initialForm(profile: UserProfile): Form {
  return {
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    username: profile.username ?? "",
    bio: profile.bio ?? "",
    phone: profile.phone ?? "",
    // Stored as an ISO datetime; the form works in YYYY-MM-DD.
    DOB: profile.DOB ? profile.DOB.slice(0, 10) : "",
    gender: profile.gender === "male" ? "MALE" : profile.gender === "female" ? "FEMALE" : "",
  };
}

/** `PATCH /users/me` — only the fields that changed are sent. */
export default function EditProfileScreen(): JSX.Element {
  const { profile } = useAuth();
  if (!profile) return <LoadingView />;
  return <EditProfileForm profile={profile} />;
}

function EditProfileForm({ profile }: { profile: UserProfile }): JSX.Element {
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const { patchProfile } = useAuth();
  const [initial] = useState(() => initialForm(profile));
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);

  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) => {
      setForm((current) => ({ ...current, [key]: value }));
      setErrors((current) => ({ ...current, [key]: undefined }));
    };

  const dirty = (Object.keys(form) as (keyof Form)[]).some((key) => form[key] !== initial[key]);

  async function save(): Promise<void> {
    const result = validateForm(schemas.editProfile, form);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    const values = result.data;
    const changes: UpdateProfileInput = {};
    if (values.firstName !== initial.firstName) changes.firstName = values.firstName;
    if (values.lastName !== initial.lastName) changes.lastName = values.lastName;
    if (values.username !== initial.username) changes.username = values.username;
    if (values.bio !== initial.bio) changes.bio = values.bio;
    if (values.phone && values.phone !== initial.phone) changes.phone = values.phone;
    if (values.DOB && values.DOB !== initial.DOB) changes.DOB = values.DOB;
    if (values.gender && values.gender !== initial.gender) changes.gender = values.gender;

    if (Object.keys(changes).length === 0) {
      router.back();
      return;
    }

    setSaving(true);
    try {
      const { data } = await userApi.update(changes);
      if (data) patchProfile(data);
      toast.show({ variant: "success", label: "Profile updated" });
      router.back();
    } catch (error) {
      // 409: username taken.
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ username: errorMessage(error, "That username is taken") });
      } else {
        toast.show({
          variant: "danger",
          label: "Couldn't save profile",
          description: errorMessage(error),
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen
        options={{
          title: "Edit profile",
          headerRight: () => (
            <Button size="sm" variant="ghost" isDisabled={saving || !dirty} onPress={save}>
              {saving ? "Saving…" : "Save"}
            </Button>
          ),
        }}
      />
      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-5"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row gap-3">
          <View className="flex-1">
            <FormField
              label="First name"
              value={form.firstName}
              onChangeText={set("firstName")}
              error={errors.firstName}
              autoComplete="given-name"
              maxLength={30}
            />
          </View>
          <View className="flex-1">
            <FormField
              label="Last name"
              value={form.lastName}
              onChangeText={set("lastName")}
              error={errors.lastName}
              autoComplete="family-name"
              maxLength={30}
            />
          </View>
        </View>

        <FormField
          label="Username"
          value={form.username}
          onChangeText={set("username")}
          error={errors.username}
          autoCapitalize="none"
          autoCorrect={false}
          hint="Letters, numbers and underscores."
          maxLength={30}
        />

        <TextField isInvalid={!!errors.bio}>
          <Label>Bio</Label>
          <TextArea
            value={form.bio}
            onChangeText={set("bio")}
            placeholder="Tell people a little about yourself"
            maxLength={BIO_MAX}
            className="min-h-24"
          />
          {errors.bio ? null : (
            <Description>
              {form.bio.length}/{BIO_MAX}
            </Description>
          )}
          <FieldError>{errors.bio}</FieldError>
        </TextField>

        <FormField
          label="Phone"
          value={form.phone}
          onChangeText={set("phone")}
          error={errors.phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="01012345678"
        />

        <DateField
          label="Date of birth"
          value={form.DOB}
          onChange={set("DOB")}
          error={errors.DOB}
        />

        <TextField isInvalid={!!errors.gender}>
          <Label>Gender</Label>
          <RadioGroup
            value={form.gender || undefined}
            onValueChange={(value) => set("gender")(value as Gender)}
            className="flex-row gap-6"
          >
            <RadioGroup.Item value="MALE">
              <Radio />
              <Label>Male</Label>
            </RadioGroup.Item>
            <RadioGroup.Item value="FEMALE">
              <Radio />
              <Label>Female</Label>
            </RadioGroup.Item>
          </RadioGroup>
          <FieldError>{errors.gender}</FieldError>
        </TextField>

        <Button onPress={save} isDisabled={saving || !dirty}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
