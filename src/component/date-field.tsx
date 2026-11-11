import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  TextField,
  useThemeColor,
} from "heroui-native";
import { useState, type JSX } from "react";
import { Platform, Pressable, useColorScheme, View } from "react-native";

/** `YYYY-MM-DD` from the *local* calendar date (toISOString would shift it to UTC). */
export const toDateString = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const fromDateString = (value: string): Date | undefined => {
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
};

interface DateFieldProps {
  label: string;
  /** `YYYY-MM-DD` or empty. */
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  /** Date the picker opens on when no value is set yet. */
  initialDate?: Date;
}

/** Read-only HeroUI input that opens the native date picker (dialog on Android, spinner on iOS). */
export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder = "Select a date",
  minimumDate,
  maximumDate,
  initialDate,
}: DateFieldProps): JSX.Element {
  const muted = useThemeColor("muted");
  const scheme = useColorScheme();
  const [iosOpen, setIosOpen] = useState(false);
  const selected = fromDateString(value) ?? initialDate ?? maximumDate ?? new Date();

  const limits = {
    ...(minimumDate ? { minimumDate } : {}),
    ...(maximumDate ? { maximumDate } : {}),
  };

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: selected,
        mode: "date",
        ...limits,
        onChange: (event, date) => {
          if (event.type === "set" && date) onChange(toDateString(date));
        },
      });
    } else {
      // Commit the starting date so "Done" without scrolling still sets a value.
      if (!value) onChange(toDateString(selected));
      setIosOpen((current) => !current);
    }
  };

  const onIosChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (date) onChange(toDateString(date));
  };

  const shown = fromDateString(value);

  return (
    <TextField isInvalid={!!error}>
      <Label>{label}</Label>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value || "not set"}`}
      >
        <View pointerEvents="none">
          <Input
            editable={false}
            value={
              shown
                ? shown.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : ""
            }
            placeholder={placeholder}
          />
          <View className="absolute bottom-0 right-3 top-0 justify-center">
            <Ionicons name="calendar-outline" size={18} color={muted} />
          </View>
        </View>
      </Pressable>

      {Platform.OS === "ios" && iosOpen ? (
        <View className="items-center gap-2">
          <DateTimePicker
            value={selected}
            mode="date"
            display="spinner"
            onChange={onIosChange}
            themeVariant={scheme === "dark" ? "dark" : "light"}
            {...limits}
          />
          <Button
            size="sm"
            variant="secondary"
            onPress={() => setIosOpen(false)}
            className="self-end"
          >
            Done
          </Button>
        </View>
      ) : null}

      {hint && !error ? <Description>{hint}</Description> : null}
      <FieldError>{error}</FieldError>
    </TextField>
  );
}
