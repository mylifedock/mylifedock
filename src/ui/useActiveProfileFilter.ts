import { useEffect, useState } from "react";
import { ACTIVE_PROFILE_CHANGE_EVENT, getActiveProfileFilter, setActiveProfileFilter } from "../application/profileService";

/** The family member chosen in one section (Documents, Medical, Emergency Kit) stays chosen in the others. */
export function useActiveProfileFilter(): [string, (id: string) => void] {
  const [activeId, setActiveId] = useState<string>(() => getActiveProfileFilter());

  useEffect(() => {
    function handleChange(e: Event) {
      const id = (e as CustomEvent<{ profileId: string }>).detail?.profileId;
      if (id) setActiveId(id);
    }
    window.addEventListener(ACTIVE_PROFILE_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(ACTIVE_PROFILE_CHANGE_EVENT, handleChange);
  }, []);

  return [
    activeId,
    (id: string) => {
      setActiveId(id);
      setActiveProfileFilter(id);
    },
  ];
}

/**
 * Opens a record once when a search result points at it. Runs during render
 * (React's "adjust state when a prop changes" pattern), so there is no extra
 * effect pass and the form opens on the first paint.
 */
export function useOpenFocusedRecord<R extends { id: string }>(
  focusId: string | undefined,
  items: R[] | undefined,
  open: (record: R) => void,
): void {
  const [handled, setHandled] = useState<string | undefined>(undefined);
  if (focusId && handled !== focusId && items) {
    const record = items.find((r) => r.id === focusId);
    if (record) {
      setHandled(focusId);
      open(record);
    }
  }
}
