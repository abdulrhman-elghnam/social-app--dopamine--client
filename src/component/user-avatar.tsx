import { Avatar } from "heroui-native";
import type { JSX } from "react";
import type { Author } from "../api/types";
import { displayName, initials } from "../lib/format";
import { fileUrl } from "../services/api";

interface UserAvatarProps {
  user: Pick<Author, "firstName" | "lastName" | "username" | "image">;
  /** `xl` (96 px) is for profile headers; HeroUI only ships sm/md/lg. */
  size?: "sm" | "md" | "lg" | "xl";
}

const XL = { width: 96, height: 96, borderRadius: 48 };

export function UserAvatar({ user, size = "md" }: UserAvatarProps): JSX.Element {
  const uri = fileUrl(user.image);
  return (
    <Avatar
      size={size === "xl" ? "lg" : size}
      color="accent"
      alt={displayName(user as Author)}
      style={size === "xl" ? XL : undefined}
    >
      {/* Keyed by uri so a changed photo always remounts and reloads. */}
      {uri ? (
        <Avatar.Image key={uri} source={{ uri }} style={size === "xl" ? XL : undefined} />
      ) : null}
      <Avatar.Fallback>{initials(user)}</Avatar.Fallback>
    </Avatar>
  );
}
