import { Button, Typography } from "heroui-native";
import { router } from "expo-router";
import React from "react";
import { ScrollView, TextInput, View } from "react-native";
import { apiRequest } from "../../services/api";

export default function SignupScreen(): React.JSX.Element {
  const [email, setEmail] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [gender, setGender] = React.useState("MALE");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [dob, setDob] = React.useState("2000-01-01");
  const [otp, setOtp] = React.useState("");
  const [registered, setRegistered] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function signup(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      await apiRequest("/authentication/signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          username,
          password,
          confirmPassword,
          fullName,
          gender,
          phoneNumber,
          DOB: dob,
        }),
      });
      setRegistered(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      await apiRequest("/authentication/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      });
      router.replace("/");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    ["Email", email, setEmail, "email-address"],
    ["Username", username, setUsername, "default"],
    ["Full name", fullName, setFullName, "default"],
    ["Phone number", phoneNumber, setPhoneNumber, "phone-pad"],
    ["Date of birth (YYYY-MM-DD)", dob, setDob, "default"],
  ] as const;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-6 py-14 gap-4">
      <Typography.Heading>{registered ? "Verify email" : "Create account"}</Typography.Heading>
      {registered ? (
        <>
          <Typography.Paragraph>Enter the OTP sent to {email}.</Typography.Paragraph>
          <TextInput
            className="rounded-xl border border-divider bg-content1 px-4 py-3 text-foreground"
            placeholder="OTP"
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
          />
          <Button onPress={verifyOtp} isDisabled={loading || !otp}>Verify</Button>
        </>
      ) : (
        <>
          {fields.map(([placeholder, value, setValue, keyboardType]) => (
            <TextInput
              key={placeholder}
              className="rounded-xl border border-divider bg-content1 px-4 py-3 text-foreground"
              placeholder={placeholder}
              keyboardType={keyboardType}
              autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
              value={value}
              onChangeText={setValue}
            />
          ))}
          <TextInput
            className="rounded-xl border border-divider bg-content1 px-4 py-3 text-foreground"
            placeholder="Gender (MALE or FEMALE)"
            value={gender}
            autoCapitalize="characters"
            onChangeText={setGender}
          />
          <TextInput className="rounded-xl border border-divider bg-content1 px-4 py-3 text-foreground" placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          <TextInput className="rounded-xl border border-divider bg-content1 px-4 py-3 text-foreground" placeholder="Confirm password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
          <Button onPress={signup} isDisabled={loading || !email || !username || !password || password !== confirmPassword}>
            {loading ? "Creating..." : "Sign up"}
          </Button>
        </>
      )}
      {error ? <Typography.Paragraph className="text-danger">{error}</Typography.Paragraph> : null}
      <Button variant="ghost" onPress={() => router.replace("/")}>Back to login</Button>
    </ScrollView>
  );
}
