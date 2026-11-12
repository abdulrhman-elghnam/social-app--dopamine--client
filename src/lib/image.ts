import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

interface PickOptions {
  /** Crop ratio offered in the picker. */
  aspect: [number, number];
  /** Longest side after resizing, in px. */
  maxSize: number;
}

/**
 * Lets the user pick and crop a photo, then re-encodes it as a resized JPEG.
 * The server only accepts JPEG/PNG ≤ 5 MB (checked by file signature), and phones often hand
 * back HEIC (iOS) or WebP (Android), so the image is always converted. Returns null if cancelled.
 */
export async function pickImage({ aspect, maxSize }: PickOptions): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect,
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > maxSize) {
    context.resize(asset.width >= asset.height ? { width: maxSize } : { height: maxSize });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  context.release();
  rendered.release();
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/**
 * Multipart body with the image under `field`.
 *
 * Expo SDK 58 replaces the global `fetch` with `expo/fetch`, whose multipart encoder only accepts
 * strings, Blobs, or parts exposing `bytes()`; React Native's classic `{ uri, name, type }` part
 * throws "Unsupported FormDataPart implementation". So on native the part reads the file through
 * expo-file-system and states its name and MIME type explicitly (the server's multer filter checks
 * the type, then the file signature).
 */
export async function imageFormData(field: string, image: PickedImage): Promise<FormData> {
  const form = new FormData();
  const name = `${field}.jpg`;
  if (Platform.OS === "web") {
    const blob = await (await fetch(image.uri)).blob();
    form.append(field, blob, name);
  } else {
    const file = new File(image.uri);
    const part = { name, type: "image/jpeg", bytes: () => file.bytes() };
    // The DOM typings only know Blob; expo/fetch reads `name`, `type` and `bytes()`.
    form.append(field, part as unknown as Blob);
  }
  return form;
}
