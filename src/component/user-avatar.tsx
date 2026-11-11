import { Avatar } from "heroui-native";
import type { JSX } from "react";
import type { Author } from "../api/types";
import { displayName, initials } from "../lib/format";
import { fileUrl } from "../services/api";

interface UserAvatarProps {
  user: Pick<Author, "firstName" | "lastName" | "username" | "image">;
  size?: "sm" | "md" | "lg";
}

export function UserAvatar({ user, size = "md" }: UserAvatarProps): JSX.Element {
  const uri = fileUrl(user.image);
  return (
    <Avatar size={size} color="accent" alt={displayName(user as Author)}>
      {uri ? <Avatar.Image source={{ uri }} /> : null}
      <Avatar.Fallback>{initials(user)}</Avatar.Fallback>
    </Avatar>
  );
}
