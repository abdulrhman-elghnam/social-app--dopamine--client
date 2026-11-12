import { Ionicons } from "@expo/vector-icons";
import { Label, Radio, RadioGroup, useThemeColor } from "heroui-native";
import type { ComponentProps, JSX } from "react";
import { View } from "react-native";
import { setThemePreference, useThemePreference, type ThemePreference } from "../lib/theme";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
}[] = [
  { value: "system", label: "System", icon: "phone-portrait-outline" },
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
];

/** System / Light / Dark switch; the choice is saved and restored on launch. */
export function ThemePicker(): JSX.Element {
  const muted = useThemeColor("muted");
  const { preference } = useThemePreference();

  return (
    <RadioGroup
      value={preference}
      onValueChange={(value) => setThemePreference(value as ThemePreference)}
      className="gap-3"
    >
      {OPTIONS.map((option) => (
        <RadioGroup.Item key={option.value} value={option.value} className="items-center">
          <Ionicons name={option.icon} size={20} color={muted} />
          <View className="flex-1">
            <Label>{option.label}</Label>
          </View>
          <Radio />
        </RadioGroup.Item>
      ))}
    </RadioGroup>
  );
}
