"use client";

import { useTranslations } from "next-intl";
import {
  isPlainNavKey,
  type NavId,
  type NavLabelKey,
} from "@/lib/navigation";

export function useNavLabel() {
  const t = useTranslations("nav");
  return (key: NavLabelKey) => {
    if (isPlainNavKey(key)) {
      return t(key);
    }
    return t(`${key}.label`);
  };
}

export function useNavDescription() {
  const t = useTranslations("nav");
  return (id: NavId) => t(`${id}.description`);
}
